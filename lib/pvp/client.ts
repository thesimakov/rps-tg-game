import type { PvpMatchPublicView } from "./types"

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  return (await res.json()) as T
}

export type PvpEnqueueResponse =
  | { ok: true; status: "queued" }
  | { ok: true; status: "matched"; match: PvpMatchPublicView }
  | { ok: false; error: string }

export async function pvpEnqueue(body: {
  userId: string
  name: string
  avatar: string
  avatarUrl: string
  wins: number
  bet: number
  rounds: 1 | 3 | 5
}) {
  return post<PvpEnqueueResponse>("/api/pvp/enqueue", body)
}

export type PvpPollResponse =
  | { ok: true; status: "idle" }
  | { ok: true; status: "queued" }
  | { ok: true; status: "match"; match: PvpMatchPublicView }
  | { ok: false; error: string }

export async function pvpPoll(userId: string) {
  return post<PvpPollResponse>("/api/pvp/poll", { userId })
}

export async function pvpSubmitMove(userId: string, move: "rock" | "scissors" | "paper") {
  return post<{ ok: boolean; match?: PvpMatchPublicView | null; error?: string }>("/api/pvp/move", {
    userId,
    move,
  })
}

export async function pvpLeave(userId: string) {
  return post<{ ok: boolean; left?: string; winnerUserId?: string | null; error?: string }>(
    "/api/pvp/leave",
    { userId },
  )
}
