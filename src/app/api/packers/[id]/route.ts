import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { ACCOUNT_REGEX, IFSC_REGEX, PHONE_REGEX, normalizeDigits, normalizeIfsc } from "@/lib/validators";

const patchSchema = z.object({
  bank_account_no: z.string().regex(ACCOUNT_REGEX, "Account number must be 9–18 digits"),
  ifsc_code: z.string().regex(IFSC_REGEX, "Invalid IFSC"),
  phone: z.string().regex(PHONE_REGEX, "Phone must be 10 digits"),
});

// Update a packer's bank details. Authorization enforced via RLS:
//   - admin: always allowed
//   - manager: only own store + only when cycle is open
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const normalized = {
    bank_account_no: typeof body.bank_account_no === "string" ? normalizeDigits(body.bank_account_no) : body.bank_account_no,
    ifsc_code: typeof body.ifsc_code === "string" ? normalizeIfsc(body.ifsc_code) : body.ifsc_code,
    phone: typeof body.phone === "string" ? normalizeDigits(body.phone) : body.phone,
  };
  const parsed = patchSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  // Use the session-bound client so RLS evaluates against the calling user.
  const { error, count } = await supabase
    .from("packers")
    .update({
      bank_account_no: parsed.data.bank_account_no,
      ifsc_code: parsed.data.ifsc_code,
      phone: parsed.data.phone,
    }, { count: "exact" })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!count) {
    return NextResponse.json({
      error: "Update rejected. Either the cycle is closed, this packer is not in your store, or it doesn't exist.",
    }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
