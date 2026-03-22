import { NextResponse } from "next/server"
import { updateWithdrawStatus } from "@/lib/withdraw-store"
import { isAdminRequest } from "@/lib/admin-auth"

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
    const body = (await req.json()) as {
      id?: string
      status?: "pending" | "paid" | "rejected"
      txHash?: string
      rejectReason?: string
    }
    const id = typeof body.id === "string" ? body.id : ""
    const status = body.status
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
    }
    const updated = await updateWithdrawStatus(id, {
      status,
      txHash: typeof body.txHash === "string" ? body.txHash.trim() : undefined,
      rejectReason: typeof body.rejectReason === "string" ? body.rejectReason.trim() : undefined,
    })
    if (!updated) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, withdrawal: updated }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
