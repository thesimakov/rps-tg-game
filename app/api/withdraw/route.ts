import { NextResponse } from "next/server"
import { isValidPlayerId, loadPlayer, savePlayer } from "@/lib/player-store"
import { createWithdrawRequest } from "@/lib/withdraw-store"

const IS_STATIC_EXPORT = process.env.NEXT_OUTPUT_EXPORT === "export"
const MIN_WITHDRAW = 10
const MAX_DAILY_WITHDRAW = 10_000
const TON_WALLET_RE = /^(UQ|EQ)[A-Za-z0-9_-]{46,60}$/

export const dynamic = "force-static"

function getUtcDateKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10)
}

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return NextResponse.json({ ok: false, error: "no_server" }, { status: 501 })
  }

  try {
    const body = (await req.json()) as { amount?: number; userId?: string; walletAddress?: string }
    const amount = Math.floor(Number(body.amount))
    const userId = typeof body.userId === "string" ? body.userId : ""
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : ""

    if (!userId || !isValidPlayerId(userId)) {
      return NextResponse.json({ ok: false, error: "invalid_user" }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 })
    }
    if (!TON_WALLET_RE.test(walletAddress)) {
      return NextResponse.json({ ok: false, error: "invalid_wallet" }, { status: 400 })
    }

    const player = await loadPlayer(userId)
    if (!player) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    if (player.status === "blocked") {
      return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 })
    }
    if (player.status === "banned" && (player.banUntil ?? 0) > Date.now()) {
      return NextResponse.json({ ok: false, error: "banned" }, { status: 403 })
    }

    if (player.balance < amount) {
      return NextResponse.json({ ok: false, error: "insufficient_balance" }, { status: 400 })
    }

    const today = getUtcDateKey(Date.now())
    const alreadyToday = player.withdrawTodayDate === today ? player.withdrawTodayAmount ?? 0 : 0
    if (alreadyToday + amount > MAX_DAILY_WITHDRAW) {
      return NextResponse.json(
        { ok: false, error: "daily_limit", limit: MAX_DAILY_WITHDRAW, used: alreadyToday },
        { status: 400 }
      )
    }

    const updated = await savePlayer({
      ...player,
      balance: player.balance - amount,
      tonWalletAddress: walletAddress,
      withdrawTodayAmount: alreadyToday + amount,
      withdrawTodayDate: today,
    })

    const request = await createWithdrawRequest({
      userId,
      amount,
      walletAddress,
    })

    return NextResponse.json(
      { ok: true, balance: updated.balance, requestId: request.id },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
