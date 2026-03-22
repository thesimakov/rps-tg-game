import { NextResponse } from "next/server"
import crypto from "crypto"
import { createTonTopup } from "@/lib/ton-topup-store"
import { isValidPlayerId } from "@/lib/player-store"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
export const dynamic = "force-static"

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }
  try {
    const body = (await req.json()) as { userId?: string; amount?: number }
    const userId = typeof body.userId === "string" ? body.userId : ""
    const amount = Math.floor(Number(body.amount))
    if (!userId || !isValidPlayerId(userId)) {
      return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 })
    }

    const receiver = (process.env.NEXT_PUBLIC_TON_RECEIVER ?? "").trim()
    if (!receiver) {
      return NextResponse.json({ ok: false, error: "no_receiver" }, { status: 500 })
    }

    const coinsPerTonRaw = Number(process.env.NEXT_PUBLIC_TON_COINS_PER_TON ?? "100")
    const coinsPerTon = Number.isFinite(coinsPerTonRaw) && coinsPerTonRaw > 0 ? coinsPerTonRaw : 100
    const tonAmount = amount / coinsPerTon
    const tonNanoAmount = String(Math.max(1, Math.ceil(tonAmount * 1_000_000_000)))
    const id = crypto.randomUUID()
    const memo = `RPS_TOPUP_${id}`
    const request = await createTonTopup({
      id,
      userId,
      coinsAmount: amount,
      tonNanoAmount,
      receiver,
      memo,
    })
    const transferUrl = `https://app.tonkeeper.com/transfer/${encodeURIComponent(receiver)}?amount=${tonNanoAmount}&text=${encodeURIComponent(memo)}`

    return NextResponse.json(
      {
        ok: true,
        request: {
          id: request.id,
          amount: request.coinsAmount,
          tonNanoAmount: request.tonNanoAmount,
          receiver: request.receiver,
          memo: request.memo,
          transferUrl,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
