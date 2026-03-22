import type { PvpClassicMove } from "./moves"

export type PvpTotalRounds = 1 | 3 | 5

export interface PvpPublicPlayer {
  userId: string
  name: string
  avatar: string
  avatarUrl: string
  wins: number
}

export interface PvpRoundReveal {
  round: number
  p0Move: PvpClassicMove
  p1Move: PvpClassicMove
  /** Очки после этого раунда */
  scores: [number, number]
}

export interface PvpMatchPublicView {
  id: string
  bet: number
  totalRounds: PvpTotalRounds
  round: number
  scores: [number, number]
  p0: PvpPublicPlayer
  p1: PvpPublicPlayer
  /** Ожидаем ход в текущем раунде (индекс 0 или 1). */
  pendingMoves: [PvpClassicMove | null, PvpClassicMove | null]
  /** Последний завершённый раунд (пока клиенты показывают анимацию). */
  lastReveal: PvpRoundReveal | null
  status: "playing" | "completed"
  winnerUserId: string | null
  /** Серверный таймаут хода (ms timestamp). */
  moveDeadlineAt: number
}
