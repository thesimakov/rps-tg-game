import { NextResponse } from "next/server"
import { isValidPlayerId } from "@/lib/player-store"
import { listPendingTonTopupsByUser } from "@/lib/ton-topup-store"
import { findTonTxHashByMemo } from "@/lib/ton-verifier"
import { confirmTonTopupByTx } from "@/lib/ton-topup-service"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
export const dynamic = "force-static"

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }
  try {
    const body = (await req.json()) as { userId?: string }
    const userId = typeof body.userId === "string" ? body.userId : ""
    if (!userId || !isValidPlayerId(userId)) {
      return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 })
    }

    const pending = await listPendingTonTopupsByUser(userId, 20)
    if (!pending.length) {
      return NextResponse.json({ ok: true, confirmed: false, reason: "no_pending" }, { headers: { "Cache-Control": "no-store" } })
    }

    for (const item of pending) {
      const txHash =
        (await findTonTxHashByMemo({
          receiver: item.receiver,
          expectedMemo: item.memo,
          expectedNanoAmount: item.tonNanoAmount,
          maxEvents: 50,
        })) ?? ""
      if (!txHash) continue
      const confirmed = await confirmTonTopupByTx({ requestId: item.id, txHash })
      if (confirmed.ok) {
        return NextResponse.json(
          {
            ok: true,
            confirmed: true,
            requestId: item.id,
            txHash,
            credited: confirmed.credited ?? 0,
            balance: confirmed.balance,
          },
          { headers: { "Cache-Control": "no-store" } }
        )
      }
    }

    return NextResponse.json({ ok: true, confirmed: false, reason: "not_found_yet" }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
