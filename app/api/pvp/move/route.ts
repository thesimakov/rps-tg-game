import { NextResponse } from "next/server"
import { isValidPlayerId } from "@/lib/player-store"
import { isPvpClassicMove } from "@/lib/pvp/moves"
import { pvpSubmitMove, pvpPoll } from "@/lib/pvp/memory-store"
import { IS_STATIC_EXPORT } from "@/lib/liveops/api-utils"

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: Request) {
  if (IS_STATIC_EXPORT) {
    return json({ ok: false, error: "no_server" }, 501)
  }

  try {
    const body = (await req.json()) as { userId?: string; move?: string }
    const userId = body.userId?.trim()
    if (!userId || !isValidPlayerId(userId)) {
      return json({ ok: false, error: "invalid_user" }, 400)
    }
    const move = body.move
    if (!move || !isPvpClassicMove(move)) {
      return json({ ok: false, error: "invalid_move" }, 400)
    }

    const res = pvpSubmitMove(userId, move)
    if (!res.ok) {
      return json({ ok: false, error: res.error }, 400)
    }

    const polled = pvpPoll(userId)
    return json({
      ok: true,
      match: polled.kind === "match" ? polled.view : null,
    })
  } catch {
    return json({ ok: false, error: "server_error" }, 500)
  }
}
