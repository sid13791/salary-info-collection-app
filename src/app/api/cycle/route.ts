import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import {
  sql,
  getOpenCycle,
  getActivePackers,
  insertAudit,
  newId,
} from "@/lib/db";
import { MONTH_REGEX } from "@/lib/validators";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), month: z.string().regex(MONTH_REGEX) }),
  z.object({ action: z.literal("close") }),
]);

export async function POST(req: Request) {
  const user = await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.action === "open") {
    if (await getOpenCycle()) {
      return NextResponse.json(
        { error: "A cycle is already open" },
        { status: 409 },
      );
    }

    // If a cycle for this month already exists (closed earlier), reopen it
    // instead of inserting a duplicate. Keeps audit history continuous.
    const existingRows = await sql<{ id: string; status: string }[]>`
      SELECT id, status FROM cycles WHERE month = ${parsed.data.month}
    `;
    const existing = existingRows[0];

    let action: "reopened" | "created";
    try {
      if (existing) {
        await sql`
          UPDATE cycles
          SET status = 'open', opened_at = now(), opened_by = ${user.id},
              closed_at = NULL, closed_by = NULL
          WHERE id = ${existing.id}
        `;
        action = "reopened";
      } else {
        await sql`
          INSERT INTO cycles (id, month, status, opened_by)
          VALUES (${newId()}, ${parsed.data.month}, 'open', ${user.id})
        `;
        action = "created";
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Open failed" },
        { status: 400 },
      );
    }
    await insertAudit({
      packer_id: null,
      field_changed: action === "reopened" ? "cycle_reopen" : "cycle_open",
      old_value: null,
      new_value: parsed.data.month,
      changed_by: user.id,
    });
    return NextResponse.json({ ok: true, action });
  }

  // close
  const open = await getOpenCycle();
  if (!open)
    return NextResponse.json(
      { error: "No open cycle to close" },
      { status: 400 },
    );

  const packers = await getActivePackers();
  try {
    await sql.begin(async (tx) => {
      for (const p of packers) {
        await tx`
          INSERT INTO cycle_packers (
            id, cycle_id, packer_id, emp_id, name, store_id,
            bank_account_no, ifsc_code, phone, is_active
          )
          VALUES (
            ${newId()}, ${open.id}, ${p.id}, ${p.emp_id}, ${p.name}, ${p.store_id},
            ${p.bank_account_no}, ${p.ifsc_code}, ${p.phone}, ${p.is_active}
          )
          ON CONFLICT (cycle_id, packer_id) DO UPDATE SET
            emp_id = excluded.emp_id,
            name = excluded.name,
            store_id = excluded.store_id,
            bank_account_no = excluded.bank_account_no,
            ifsc_code = excluded.ifsc_code,
            phone = excluded.phone,
            is_active = excluded.is_active
        `;
      }
      await tx`
        UPDATE cycles
        SET status = 'closed', closed_at = now(), closed_by = ${user.id}
        WHERE id = ${open.id}
      `;
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Snapshot failed" },
      { status: 500 },
    );
  }

  await insertAudit({
    packer_id: null,
    field_changed: "cycle_close",
    old_value: open.month,
    new_value: null,
    changed_by: user.id,
  });
  return NextResponse.json({ ok: true, snapshotted: packers.length });
}
