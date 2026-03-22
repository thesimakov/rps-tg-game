import { NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin-auth"
import { confirmTonTopupByTx } from "@/lib/ton-topup-service"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
export const dynamic = "force-static"

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }
  try {
    const body = (await req.json()) as { requestId?: string; txHash?: string }
    const requestId = typeof body.requestId === "string" ? body.requestId : ""
    const txHash = typeof body.txHash === "string" ? body.txHash : ""
    const result = await confirmTonTopupByTx({ requestId, txHash })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json(
      { ok: true, balance: result.balance, credited: result.credited, topup: result.topup },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
