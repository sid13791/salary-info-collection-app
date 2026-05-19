import { NextResponse } from "next/server";
import { generateRosterTemplate } from "@/lib/excel/parse-roster";

export async function GET() {
  const buf = generateRosterTemplate();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="roster_template.xlsx"',
    },
  });
}
