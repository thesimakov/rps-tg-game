import { NextResponse } from "next/server"
import { isValidPlayerId } from "@/lib/player-store"
import { pvpLeave, pvpRemoveFromQueueOnly, pvpPoll, pvpConsumeEconomy } from "@/lib/pvp/memory-store"
import { applyPvpMatchEconomy } from "@/lib/pvp/apply-economy"
import { IS_STATIC_EXPORT } from "@/lib/liveops/api-utils"

export const dynamic = "force-dynamic"

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return json({ ok: false, error: "no_server" }, 501)
  }

  try {
    const body = (await req.json()) as { userId?: string }
    const userId = body.userId?.trim()
    if (!userId || !isValidPlayerId(userId)) {
      return json({ ok: false, error: "invalid_user" }, 400)
    }

    const result = pvpLeave(userId)
    if (result === "queue") {
      pvpRemoveFromQueueOnly(userId)
      return json({ ok: true, left: "queue" as const })
    }
    if (result === "idle") {
      return json({ ok: true, left: "none" as const })
    }

    const polled = pvpPoll(userId)
    if (polled.kind === "match" && polled.view.status === "completed") {
      const internal = pvpConsumeEconomy(polled.view.id)
      if (internal) {
        await applyPvpMatchEconomy({
          bet: internal.bet,
          winnerUserId: internal.winnerUserId,
          p0: internal.p0,
          p1: internal.p1,
        })
      }
    }

    return json({
      ok: true,
      left: "match" as const,
      winnerUserId: polled.kind === "match" ? polled.view.winnerUserId : null,
    })
  } catch {
    return json({ ok: false, error: "server_error" }, 500)
  }
}
