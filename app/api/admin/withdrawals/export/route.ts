import { NextResponse } from "next/server"
import { listWithdrawRequests, withdrawRequestsToCsv } from "@/lib/withdraw-store"
import { isAdminRequest } from "@/lib/admin-auth"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
export const dynamic = "force-static"

export async function GET(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }
  try {
    const rows = await listWithdrawRequests(10_000)
    const csv = withdrawRequestsToCsv(rows)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="withdrawals-${Date.now()}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
