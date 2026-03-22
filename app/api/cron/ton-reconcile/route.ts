import { NextResponse } from "next/server"
import { listPendingTonTopups } from "@/lib/ton-topup-store"
import { findTonTxHashByMemo } from "@/lib/ton-verifier"
import { confirmTonTopupByTx } from "@/lib/ton-topup-service"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
const CRON_SECRET = process.env.CRON_SECRET ?? ""
export const dynamic = "force-static"

function isAuthorized(req: Request): boolean {
  if (!CRON_SECRET) return false
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${CRON_SECRET}`
}

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number; maxConfirmations?: number }
    const limit = Math.max(1, Math.min(500, Math.floor(Number(body.limit ?? 150))))
    const maxConfirmations = Math.max(1, Math.min(200, Math.floor(Number(body.maxConfirmations ?? 50))))

    const pending = await listPendingTonTopups(limit)
    let checked = 0
    let confirmed = 0
    let failed = 0
    const details: Array<{ requestId: string; status: "confirmed" | "not_found" | "failed"; txHash?: string; error?: string }> = []

    for (const item of pending) {
      if (confirmed >= maxConfirmations) break
      checked += 1

      const txHash =
        (await findTonTxHashByMemo({
          receiver: item.receiver,
          expectedMemo: item.memo,
          expectedNanoAmount: item.tonNanoAmount,
          maxEvents: 50,
        })) ?? ""

      if (!txHash) {
        details.push({ requestId: item.id, status: "not_found" })
        continue
      }

      const result = await confirmTonTopupByTx({ requestId: item.id, txHash })
      if (result.ok) {
        confirmed += 1
        details.push({ requestId: item.id, status: "confirmed", txHash })
      } else {
        failed += 1
        details.push({ requestId: item.id, status: "failed", txHash, error: result.error })
      }
    }

    return NextResponse.json(
      {
        ok: true,
        pending: pending.length,
        checked,
        confirmed,
        failed,
        details,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
