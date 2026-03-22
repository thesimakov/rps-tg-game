import { classicOutcome, type PvpClassicMove } from "./moves"
import type { PvpMatchPublicView, PvpPublicPlayer, PvpRoundReveal, PvpTotalRounds } from "./types"

const QUEUE_TTL_MS = 3 * 60 * 1000
const ROUND_REVEAL_MS = 2200
const MOVE_TIMEOUT_MS = 45 * 1000

interface InternalMatch {
  id: string
  bet: number
  totalRounds: PvpTotalRounds
  round: number
  scores: [number, number]
  p0: PvpPublicPlayer
  p1: PvpPublicPlayer
  pending: [PvpClassicMove | null, PvpClassicMove | null]
  lastReveal: PvpRoundReveal | null
  status: "playing" | "completed"
  winnerUserId: string | null
  moveDeadlineAt: number
  advanceTimer: ReturnType<typeof setTimeout> | null
  /** Серверные выплаты уже применены к players.json */
  economyApplied: boolean
  completedAt: number | null
}

interface QueueEntry extends PvpPublicPlayer {
  enqueuedAt: number
}

function queueKey(bet: number, rounds: PvpTotalRounds) {
  return `q_${bet}_${rounds}`
}

function randomMove(): PvpClassicMove {
  const a: PvpClassicMove[] = ["rock", "scissors", "paper"]
  return a[Math.floor(Math.random() * 3)]
}

function getGlobalStore() {
  const g = globalThis as unknown as { __rpsPvpStore?: PvpMemoryStore }
  if (!g.__rpsPvpStore) g.__rpsPvpStore = new PvpMemoryStore()
  return g.__rpsPvpStore
}

class PvpMemoryStore {
  private queues = new Map<string, QueueEntry[]>()
  private matches = new Map<string, InternalMatch>()
  private userToMatch = new Map<string, string>()
  private queuedUserIds = new Set<string>()

  pruneQueue(key: string) {
    const q = this.queues.get(key)
    if (!q) return
    const now = Date.now()
    const next = q.filter((e) => now - e.enqueuedAt < QUEUE_TTL_MS)
    if (next.length === 0) this.queues.delete(key)
    else this.queues.set(key, next)
  }

  removeUserFromQueues(userId: string) {
    this.queuedUserIds.delete(userId)
    for (const [k, q] of this.queues.entries()) {
      const next = q.filter((e) => e.userId !== userId)
      if (next.length === 0) this.queues.delete(k)
      else this.queues.set(k, next)
    }
  }

  prependToQueue(bet: number, rounds: PvpTotalRounds, entry: QueueEntry) {
    const key = queueKey(bet, rounds)
    const q = this.queues.get(key) ?? []
    q.unshift(entry)
    this.queues.set(key, q)
    this.queuedUserIds.add(entry.userId)
  }

  /** Синхронно: либо поставить в очередь, либо вернуть пару для матча (без создания матча). */
  dequeuePairOrEnqueue(entry: QueueEntry, bet: number, rounds: PvpTotalRounds): { peer: QueueEntry | null } {
    const key = queueKey(bet, rounds)
    this.removeUserFromQueues(entry.userId)
    this.pruneQueue(key)
    const q = this.queues.get(key) ?? []
    const idx = q.findIndex((e) => e.userId !== entry.userId)
    if (idx >= 0) {
      const peer = q[idx]
      const next = q.filter((_, i) => i !== idx)
      if (next.length === 0) this.queues.delete(key)
      else this.queues.set(key, next)
      this.queuedUserIds.delete(peer.userId)
      this.queuedUserIds.delete(entry.userId)
      return { peer }
    }
    q.push(entry)
    this.queues.set(key, q)
    this.queuedUserIds.add(entry.userId)
    return { peer: null }
  }

  registerMatch(match: InternalMatch) {
    this.matches.set(match.id, match)
    this.userToMatch.set(match.p0.userId, match.id)
    this.userToMatch.set(match.p1.userId, match.id)
  }

  getMatchForUser(userId: string): InternalMatch | null {
    const id = this.userToMatch.get(userId)
    if (!id) return null
    return this.matches.get(id) ?? null
  }

  clearAdvanceTimer(m: InternalMatch) {
    if (m.advanceTimer) {
      clearTimeout(m.advanceTimer)
      m.advanceTimer = null
    }
  }

  finalizeMatch(m: InternalMatch, winnerUserId: string | null) {
    this.clearAdvanceTimer(m)
    m.status = "completed"
    m.winnerUserId = winnerUserId
    m.pending = [null, null]
    m.lastReveal = null
    m.moveDeadlineAt = Date.now() + 60_000
    m.completedAt = Date.now()
  }

  tryResolveRound(m: InternalMatch) {
    const [a, b] = m.pending
    if (a == null || b == null) return

    const out = classicOutcome(a, b)
    if (out === "p0_win") m.scores[0] += 1
    else if (out === "p1_win") m.scores[1] += 1

    m.lastReveal = {
      round: m.round,
      p0Move: a,
      p1Move: b,
      scores: [...m.scores] as [number, number],
    }

    const doneRounds = m.round >= m.totalRounds

    if (doneRounds) {
      let winner: string | null = null
      if (m.scores[0] > m.scores[1]) winner = m.p0.userId
      else if (m.scores[1] > m.scores[0]) winner = m.p1.userId
      const drawMatch = m.scores[0] === m.scores[1]
      this.clearAdvanceTimer(m)
      m.advanceTimer = setTimeout(() => {
        m.advanceTimer = null
        this.finalizeMatch(m, drawMatch ? null : winner)
      }, ROUND_REVEAL_MS)
      return
    }

    this.clearAdvanceTimer(m)
    m.advanceTimer = setTimeout(() => {
      m.advanceTimer = null
      m.round += 1
      m.pending = [null, null]
      m.lastReveal = null
      m.moveDeadlineAt = Date.now() + MOVE_TIMEOUT_MS
    }, ROUND_REVEAL_MS)
  }

  applyTimeouts(m: InternalMatch) {
    if (m.status !== "playing") return
    const now = Date.now()
    if (now < m.moveDeadlineAt) return
    if (m.pending[0] == null) m.pending[0] = randomMove()
    if (m.pending[1] == null) m.pending[1] = randomMove()
    this.tryResolveRound(m)
  }

  submitMove(userId: string, move: PvpClassicMove): { ok: true } | { ok: false; error: string } {
    const m = this.getMatchForUser(userId)
    if (!m || m.status !== "playing") return { ok: false, error: "no_match" }
    this.applyTimeouts(m)
    if (m.status !== "playing") return { ok: false, error: "match_over" }

    let slot: 0 | 1
    if (m.p0.userId === userId) slot = 0
    else if (m.p1.userId === userId) slot = 1
    else return { ok: false, error: "not_in_match" }

    if (m.lastReveal != null) return { ok: false, error: "round_resolving" }
    if (m.pending[slot] != null) return { ok: false, error: "already_moved" }

    m.pending[slot] = move
    if (m.pending[0] != null && m.pending[1] != null) {
      this.tryResolveRound(m)
    }
    return { ok: true }
  }

  toPublic(m: InternalMatch, viewerUserId: string): PvpMatchPublicView {
    return {
      id: m.id,
      bet: m.bet,
      totalRounds: m.totalRounds,
      round: m.round,
      scores: [...m.scores] as [number, number],
      p0: m.p0,
      p1: m.p1,
      pendingMoves: [...m.pending] as [PvpClassicMove | null, PvpClassicMove | null],
      lastReveal: m.lastReveal,
      status: m.status,
      winnerUserId: m.winnerUserId,
      moveDeadlineAt: m.moveDeadlineAt,
    }
  }

  pruneStaleCompleted() {
    const now = Date.now()
    const maxAge = 3 * 60 * 1000
    for (const [id, m] of this.matches.entries()) {
      if (m.status === "completed" && m.completedAt && now - m.completedAt > maxAge) {
        this.userToMatch.delete(m.p0.userId)
        this.userToMatch.delete(m.p1.userId)
        this.matches.delete(id)
      }
    }
  }

  poll(userId: string): { kind: "none" } | { kind: "queued" } | { kind: "match"; view: PvpMatchPublicView } {
    this.pruneStaleCompleted()
    const m = this.getMatchForUser(userId)
    if (m) {
      this.applyTimeouts(m)
      return { kind: "match", view: this.toPublic(m, userId) }
    }
    if (this.queuedUserIds.has(userId)) return { kind: "queued" }
    return { kind: "none" }
  }

  consumeEconomy(matchId: string): InternalMatch | null {
    const m = this.matches.get(matchId)
    if (!m || m.status !== "completed" || m.economyApplied) return null
    m.economyApplied = true
    return m
  }

  /**
   * Убрать из очереди или сдаться в матче (победа сопернику). Матч остаётся в памяти до prune — второй игрок увидит итог в poll.
   */
  leave(userId: string): "queue" | "forfeit" | "idle" {
    this.removeUserFromQueues(userId)
    const mid = this.userToMatch.get(userId)
    if (!mid) return "queue"
    const m = this.matches.get(mid)
    if (!m) {
      this.userToMatch.delete(userId)
      return "idle"
    }
    this.clearAdvanceTimer(m)
    const isP0 = m.p0.userId === userId
    const otherId = isP0 ? m.p1.userId : m.p0.userId
    m.status = "completed"
    m.winnerUserId = otherId
    m.pending = [null, null]
    m.lastReveal = null
    m.completedAt = Date.now()
    m.moveDeadlineAt = Date.now() + 60_000
    return "forfeit"
  }

  createMatchAfterReserve(
    p0: PvpPublicPlayer,
    p1: PvpPublicPlayer,
    bet: number,
    rounds: PvpTotalRounds,
  ): InternalMatch {
    const id = `pvp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
    const m: InternalMatch = {
      id,
      bet,
      totalRounds: rounds,
      round: 1,
      scores: [0, 0],
      p0,
      p1,
      pending: [null, null],
      lastReveal: null,
      status: "playing",
      winnerUserId: null,
      moveDeadlineAt: Date.now() + MOVE_TIMEOUT_MS,
      advanceTimer: null,
      economyApplied: false,
      completedAt: null,
    }
    this.registerMatch(m)
    return m
  }
}

export function pvpDequeueOrEnqueue(entry: QueueEntry, bet: number, rounds: PvpTotalRounds) {
  return getGlobalStore().dequeuePairOrEnqueue(entry, bet, rounds)
}

export function pvpCreateMatch(p0: PvpPublicPlayer, p1: PvpPublicPlayer, bet: number, rounds: PvpTotalRounds) {
  return getGlobalStore().createMatchAfterReserve(p0, p1, bet, rounds)
}

export function pvpPoll(userId: string) {
  return getGlobalStore().poll(userId)
}

export function pvpSubmitMove(userId: string, move: PvpClassicMove) {
  return getGlobalStore().submitMove(userId, move)
}

export function pvpLeave(userId: string) {
  return getGlobalStore().leave(userId)
}

export function pvpRemoveFromQueueOnly(userId: string) {
  getGlobalStore().removeUserFromQueues(userId)
}

export function pvpPrependQueue(bet: number, rounds: PvpTotalRounds, entry: QueueEntry) {
  getGlobalStore().prependToQueue(bet, rounds, entry)
}

export function pvpConsumeEconomy(matchId: string) {
  return getGlobalStore().consumeEconomy(matchId)
}
