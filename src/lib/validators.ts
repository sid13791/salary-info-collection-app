import { z } from "zod";

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_REGEX = /^[0-9]{9,18}$/;
export const PHONE_REGEX = /^[0-9]{10}$/;
export const EMP_ID_REGEX = /^[A-Z0-9._-]{1,32}$/;
export const STORE_CODE_REGEX = /^[A-Z0-9_-]{1,16}$/;
export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizeEmpId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeStoreCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeIfsc(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Zod schemas — used by API routes and form validation
export const bankDetailsSchema = z.object({
  bank_account_no: z.string().regex(ACCOUNT_REGEX, "Account number must be 9–18 digits"),
  ifsc_code: z.string().regex(IFSC_REGEX, "IFSC must be 4 letters + 0 + 6 alphanumeric"),
  phone: z.string().regex(PHONE_REGEX, "Phone must be exactly 10 digits"),
});

// Optional version for partial updates (manager can save bank-only and add phone later)
export const bankDetailsPartialSchema = z.object({
  bank_account_no: z.string().regex(ACCOUNT_REGEX).optional().or(z.literal("")),
  ifsc_code: z.string().regex(IFSC_REGEX).optional().or(z.literal("")),
  phone: z.string().regex(PHONE_REGEX).optional().or(z.literal("")),
});

export const packerInputSchema = z.object({
  emp_id: z.string().regex(EMP_ID_REGEX),
  name: z.string().min(1).max(200),
  store_id: z.string().uuid(),
  bank_account_no: z.string().regex(ACCOUNT_REGEX).optional().nullable(),
  ifsc_code: z.string().regex(IFSC_REGEX).optional().nullable(),
  phone: z.string().regex(PHONE_REGEX).optional().nullable(),
});

export type PackerInput = z.infer<typeof packerInputSchema>;
