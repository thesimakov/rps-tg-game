import { NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin-auth"
import { updateTonTopupStatus } from "@/lib/ton-topup-store"

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
    const body = (await req.json()) as { requestId?: string; reason?: string }
    const requestId = typeof body.requestId === "string" ? body.requestId : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : "manual_reject"
    if (!requestId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
    }
    const updated = await updateTonTopupStatus(requestId, { status: "rejected", rejectReason: reason })
    if (!updated) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, topup: updated }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
