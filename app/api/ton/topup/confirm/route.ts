import { NextResponse } from "next/server"
import { confirmTonTopupByTx } from "@/lib/ton-topup-service"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
export const dynamic = "force-static"

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }
  try {
    const body = (await req.json()) as { requestId?: string; txHash?: string }
    const requestId = typeof body.requestId === "string" ? body.requestId : ""
    const txHash = typeof body.txHash === "string" ? body.txHash.trim() : ""
    if (!requestId || !txHash) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
    }
    const result = await confirmTonTopupByTx({ requestId, txHash })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json(
      { ok: true, balance: result.balance, credited: result.credited, alreadyConfirmed: result.alreadyConfirmed ?? false },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
