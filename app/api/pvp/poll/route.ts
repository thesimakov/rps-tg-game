import { NextResponse } from "next/server"
import { isValidPlayerId } from "@/lib/player-store"
import { pvpPoll, pvpConsumeEconomy } from "@/lib/pvp/memory-store"
import { applyPvpMatchEconomy } from "@/lib/pvp/apply-economy"
import { IS_STATIC_EXPORT } from "@/lib/liveops/api-utils"

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

    const polled = pvpPoll(userId)
    if (polled.kind === "none") {
      return json({ ok: true, status: "idle" as const })
    }
    if (polled.kind === "queued") {
      return json({ ok: true, status: "queued" as const })
    }

    const { view } = polled

    if (view.status === "completed") {
      const internal = pvpConsumeEconomy(view.id)
      if (internal) {
        try {
          await applyPvpMatchEconomy({
            bet: internal.bet,
            winnerUserId: internal.winnerUserId,
            p0: internal.p0,
            p1: internal.p1,
          })
        } catch {
          internal.economyApplied = false
        }
      }
    }

    return json({ ok: true, status: "match" as const, match: view })
  } catch {
    return json({ ok: false, error: "server_error" }, 500)
  }
}
