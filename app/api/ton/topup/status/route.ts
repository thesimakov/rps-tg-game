import { NextResponse } from "next/server"
import { getTonTopupById } from "@/lib/ton-topup-store"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
export const dynamic = "force-static"

export async function GET(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id") ?? ""
    if (!id) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 })
    const request = await getTonTopupById(id)
    if (!request) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, request }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
