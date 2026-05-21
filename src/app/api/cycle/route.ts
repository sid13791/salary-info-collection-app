import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import { getDb, getOpenCycle, getActivePackers, insertAudit, newId } from "@/lib/db";
import { MONTH_REGEX } from "@/lib/validators";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), month: z.string().regex(MONTH_REGEX) }),
  z.object({ action: z.literal("close") }),
]);

export async function POST(req: Request) {
  const user = apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const db = getDb();

  if (parsed.data.action === "open") {
    if (getOpenCycle()) {
      return NextResponse.json({ error: "A cycle is already open" }, { status: 409 });
    }

    // If a cycle for this month already exists (closed earlier), reopen it
    // instead of inserting a duplicate. Keeps audit history continuous.
    const existing = db
      .prepare("SELECT id, status FROM cycles WHERE month = ?")
      .get(parsed.data.month) as { id: string; status: string } | undefined;

    let action: "reopened" | "created";
    try {
      if (existing) {
        db.prepare(`
          UPDATE cycles
          SET status = 'open', opened_at = datetime('now'), opened_by = ?,
              closed_at = NULL, closed_by = NULL
          WHERE id = ?
        `).run(user.id, existing.id);
        action = "reopened";
      } else {
        db.prepare(`
          INSERT INTO cycles (id, month, status, opened_by)
          VALUES (?, ?, 'open', ?)
        `).run(newId(), parsed.data.month, user.id);
        action = "created";
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Open failed" }, { status: 400 });
    }
    insertAudit({
      packer_id: null,
      field_changed: action === "reopened" ? "cycle_reopen" : "cycle_open",
      old_value: null,
      new_value: parsed.data.month,
      changed_by: user.id,
    });
    return NextResponse.json({ ok: true, action });
  }

  // close
  const open = getOpenCycle();
  if (!open) return NextResponse.json({ error: "No open cycle to close" }, { status: 400 });

  const packers = getActivePackers();
  const insertSnap = db.prepare(`
    INSERT INTO cycle_packers (id, cycle_id, packer_id, emp_id, name, store_id, bank_account_no, ifsc_code, phone, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cycle_id, packer_id) DO UPDATE SET
      emp_id=excluded.emp_id, name=excluded.name, store_id=excluded.store_id,
      bank_account_no=excluded.bank_account_no, ifsc_code=excluded.ifsc_code,
      phone=excluded.phone, is_active=excluded.is_active
  `);
  const tx = db.exec("BEGIN");
  try {
    for (const p of packers) {
      insertSnap.run(
        newId(),
        open.id,
        p.id,
        p.emp_id,
        p.name,
        p.store_id,
        p.bank_account_no,
        p.ifsc_code,
        p.phone,
        p.is_active,
      );
    }
    db.prepare("UPDATE cycles SET status = 'closed', closed_at = datetime('now'), closed_by = ? WHERE id = ?")
      .run(user.id, open.id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Snapshot failed" }, { status: 500 });
  }

  insertAudit({
    packer_id: null,
    field_changed: "cycle_close",
    old_value: open.month,
    new_value: null,
    changed_by: user.id,
  });
  return NextResponse.json({ ok: true, snapshotted: packers.length });
}
