import { NextResponse } from "next/server"
import { isValidPlayerId, loadPlayer } from "@/lib/player-store"
import { tryDeductStake, creditWinner } from "@/lib/pvp/balance"
import { pvpDequeueOrEnqueue, pvpCreateMatch, pvpPrependQueue, pvpPoll } from "@/lib/pvp/memory-store"
import type { PvpTotalRounds } from "@/lib/pvp/types"
import { IS_STATIC_EXPORT } from "@/lib/liveops/api-utils"

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return json({ ok: false, error: "no_server" }, 501)
  }

  try {
    const body = (await req.json()) as {
      userId?: string
      name?: string
      avatar?: string
      avatarUrl?: string
      wins?: number
      bet?: number
      rounds?: number
    }

    const userId = body.userId?.trim()
    if (!userId || !isValidPlayerId(userId)) {
      return json({ ok: false, error: "invalid_user" }, 400)
    }

    const bet = typeof body.bet === "number" ? Math.floor(body.bet) : 0
    const rounds = body.rounds as PvpTotalRounds
    if (![1, 3, 5].includes(rounds) || bet < 5) {
      return json({ ok: false, error: "invalid_params" }, 400)
    }

    const self = await loadPlayer(userId)
    if (!self || self.balance < bet) {
      return json({ ok: false, error: "insufficient_balance" }, 400)
    }

    const entry = {
      userId,
      name: typeof body.name === "string" ? body.name.slice(0, 64) : "Player",
      avatar: typeof body.avatar === "string" ? body.avatar.slice(0, 4) : "?",
      avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl.slice(0, 512) : "",
      wins: typeof body.wins === "number" && body.wins >= 0 ? Math.floor(body.wins) : 0,
      enqueuedAt: Date.now(),
    }

    const { peer } = pvpDequeueOrEnqueue(entry, bet, rounds)

    if (!peer) {
      return json({ ok: true, status: "queued" as const })
    }

    const peerPlayer = await tryDeductStake(peer.userId, bet)
    if (!peerPlayer) {
      pvpPrependQueue(bet, rounds, peer)
      return json({ ok: true, status: "queued" as const })
    }

    const selfDeducted = await tryDeductStake(userId, bet)
    if (!selfDeducted) {
      await creditWinner(peer.userId, bet)
      pvpPrependQueue(bet, rounds, peer)
      return json({ ok: false, error: "insufficient_balance" }, 400)
    }

    const p0 = {
      userId: peer.userId,
      name: peer.name,
      avatar: peer.avatar,
      avatarUrl: peer.avatarUrl,
      wins: peer.wins,
    }
    const p1 = {
      userId: entry.userId,
      name: entry.name,
      avatar: entry.avatar,
      avatarUrl: entry.avatarUrl,
      wins: entry.wins,
    }

    pvpCreateMatch(p0, p1, bet, rounds)

    const snap = pvpPoll(userId)
    if (snap.kind !== "match") {
      return json({ ok: false, error: "match_create_failed" }, 500)
    }

    return json({ ok: true, status: "matched" as const, match: snap.view })
  } catch {
    return json({ ok: false, error: "server_error" }, 500)
  }
}
