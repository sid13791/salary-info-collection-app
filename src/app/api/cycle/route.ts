import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRequireAdmin } from "@/lib/auth";
import {
  sql,
  getOpenCycle,
  getActivePackers,
  newId,
} from "@/lib/db";
import { MONTH_REGEX } from "@/lib/validators";
import { requireJsonContentType } from "@/lib/csrf";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), month: z.string().regex(MONTH_REGEX) }),
  z.object({ action: z.literal("close") }),
]);

export async function POST(req: Request) {
  const csrfErr = requireJsonContentType(req);
  if (csrfErr) return csrfErr;

  const user = await apiRequireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (parsed.data.action === "open") {
    const month = parsed.data.month;
    // Use a transaction to atomically check + open. The partial unique index
    // (cycles_one_open_idx) prevents two open cycles at the database level.
    let action: "reopened" | "created";
    try {
      await sql.begin(async (tx) => {
        const [alreadyOpen] = await tx`
          SELECT id FROM cycles WHERE status = 'open' FOR UPDATE
        `;
        if (alreadyOpen) throw new Error("already_open");

        const existingRows = await tx<{ id: string }[]>`
          SELECT id FROM cycles WHERE month = ${month}
        `;
        const existing = existingRows[0];

        if (existing) {
          await tx`
            UPDATE cycles
            SET status = 'open', opened_at = now(), opened_by = ${user.id},
                closed_at = NULL, closed_by = NULL
            WHERE id = ${existing.id}
          `;
          action = "reopened";
        } else {
          await tx`
            INSERT INTO cycles (id, month, status, opened_by)
            VALUES (${newId()}, ${month}, 'open', ${user.id})
          `;
          action = "created";
        }

        await tx`
          INSERT INTO audit_log (packer_id, field_changed, old_value, new_value, changed_by)
          VALUES (NULL, ${action === "reopened" ? "cycle_reopen" : "cycle_open"}, NULL, ${month}, ${user.id})
        `;
      });
    } catch (e) {
      if (e instanceof Error && e.message === "already_open") {
        return NextResponse.json(
          { error: "A cycle is already open" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Open failed" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, action: action! });
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
      // Audit log inside the transaction (WR-07)
      await tx`
        INSERT INTO audit_log (packer_id, field_changed, old_value, new_value, changed_by)
        VALUES (NULL, 'cycle_close', ${open.month}, NULL, ${user.id})
      `;
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Snapshot failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, snapshotted: packers.length });
}
