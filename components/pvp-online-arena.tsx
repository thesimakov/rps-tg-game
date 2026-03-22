"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useGame, type MatchRoundSummary, type Move } from "@/lib/game-context"
import { useI18n } from "@/lib/i18n/context"
import { formatAmount } from "@/lib/format-amount"
import { Coins, Timer } from "lucide-react"
import { PlayerAvatar } from "@/components/player-avatar"
import { isServerPlayerId } from "@/lib/platform-user"
import { pvpPoll, pvpSubmitMove, pvpLeave } from "@/lib/pvp/client"
import type { PvpMatchPublicView } from "@/lib/pvp/types"
import { classicOutcome } from "@/lib/pvp/moves"
import { sendMatchResult } from "@/lib/liveops/client"

const POLL_MS = 550

const MOVE_UI: { key: "rock" | "scissors" | "paper"; icon: string }[] = [
  { key: "rock", icon: "🪨" },
  { key: "scissors", icon: "✂️" },
  { key: "paper", icon: "📄" },
]

function moveLabel(t: (k: "moveRock" | "moveScissors" | "movePaper") => string, key: "rock" | "scissors" | "paper") {
  if (key === "rock") return t("moveRock")
  if (key === "scissors") return t("moveScissors")
  return t("movePaper")
}

function mapRevealToMyOutcome(
  reveal: NonNullable<PvpMatchPublicView["lastReveal"]>,
  youAreP0: boolean,
): "win" | "loss" | "draw" {
  const base = classicOutcome(reveal.p0Move, reveal.p1Move)
  if (base === "draw") return "draw"
  if (youAreP0) return base === "p0_win" ? "win" : "loss"
  return base === "p1_win" ? "win" : "loss"
}

export function PvpOnlineArena() {
  const { t } = useI18n()
  const {
    player,
    opponent,
    setLastResult,
    setScreen,
    currentBet,
    totalRounds,
    toDisplayAmount,
    currencyLabel,
    syncPlayerFromServer,
    prepareOnlinePvp,
  } = useGame()

  const [match, setMatch] = useState<PvpMatchPublicView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const roundsHistoryRef = useRef<MatchRoundSummary[]>([])
  const lastRevealRoundRef = useRef<number | null>(null)
  const finishedMatchIdRef = useRef<string | null>(null)
  const [, setTick] = useState(0)

  const youAreP0 = !!(match && player.id === match.p0.userId)
  const myIdx = youAreP0 ? 0 : 1
  const oppIdx = youAreP0 ? 1 : 0

  const finishMatch = useCallback(
    async (m: PvpMatchPublicView) => {
      if (finishedMatchIdRef.current === m.id) return
      finishedMatchIdRef.current = m.id

      const myScore = player.id === m.p0.userId ? m.scores[0] : m.scores[1]
      const oppScore = player.id === m.p0.userId ? m.scores[1] : m.scores[0]
      let finalOutcome: "win" | "loss" | "draw" = "draw"
      if (myScore > oppScore) finalOutcome = "win"
      else if (myScore < oppScore) finalOutcome = "loss"

      const finalBet = currentBet
      const pot = finalBet * 2
      let finalEarnings = 0
      if (finalOutcome === "win") finalEarnings = pot - finalBet
      else if (finalOutcome === "loss") finalEarnings = -finalBet
      const matchBonus = finalOutcome === "win" ? Math.max(1, Math.round(pot * 0.1)) : 0

      if (isServerPlayerId(player.id) && (finalOutcome === "win" || finalOutcome === "loss")) {
        const moves = roundsHistoryRef.current.map((x) => x.playerMove)
        try {
          await sendMatchResult(player.id, {
            type: "match_finished",
            won: finalOutcome === "win",
            movesUsed: moves.length ? moves : ["rock"],
            skinIdUsed: player.cardSkin,
            betVoices: finalBet,
            bankVoices: finalBet * 2,
            mode: undefined,
          })
        } catch {
          // ignore
        }
      }

      await syncPlayerFromServer()

      const last = roundsHistoryRef.current[roundsHistoryRef.current.length - 1]
      setLastResult({
        playerMove: last?.playerMove ?? null,
        opponentMove: last?.opponentMove ?? null,
        outcome: finalOutcome,
        earnings: finalEarnings,
        bet: finalBet,
        bonus: matchBonus,
        rounds: roundsHistoryRef.current.length ? roundsHistoryRef.current : undefined,
      })

      prepareOnlinePvp(false)
      setScreen("result")
    },
    [currentBet, player.cardSkin, player.id, prepareOnlinePvp, setLastResult, setScreen, syncPlayerFromServer],
  )

  const pollLoop = useCallback(async () => {
    if (!isServerPlayerId(player.id)) return
    const res = await pvpPoll(player.id)
    if (!res.ok) return
    if (res.status !== "match") return

    setMatch(res.match)
    const r = res.match.lastReveal
    if (r && lastRevealRoundRef.current !== r.round) {
      lastRevealRoundRef.current = r.round
      const youP0 = player.id === res.match.p0.userId
      const outcome = mapRevealToMyOutcome(r, youP0)
      const myMove = (youP0 ? r.p0Move : r.p1Move) as Move
      const oppMove = (youP0 ? r.p1Move : r.p0Move) as Move
      roundsHistoryRef.current = [
        ...roundsHistoryRef.current,
        { round: r.round, playerMove: myMove, opponentMove: oppMove, outcome },
      ]
    }

    if (res.match.status === "completed") {
      await finishMatch(res.match)
    }
  }, [finishMatch, player.id])

  useEffect(() => {
    void pollLoop()
    const id = setInterval(() => {
      void pollLoop()
      setTick((x) => x + 1)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [pollLoop])

  useEffect(() => {
    const iv = setInterval(() => setTick((x) => x + 1), 400)
    return () => clearInterval(iv)
  }, [])

  const needMyMove = useMemo(() => {
    if (!match || match.status !== "playing") return false
    if (match.lastReveal) return false
    return match.pendingMoves[myIdx] == null
  }, [match, myIdx])

  const waitingOpp = useMemo(() => {
    if (!match || match.status !== "playing") return false
    if (match.lastReveal) return false
    return match.pendingMoves[myIdx] != null && match.pendingMoves[oppIdx] == null
  }, [match, myIdx, oppIdx])

  const reveal = match?.lastReveal

  const timeLeft = match ? Math.max(0, Math.ceil((match.moveDeadlineAt - Date.now()) / 1000)) : 0

  const handlePick = async (mv: "rock" | "scissors" | "paper") => {
    if (!needMyMove || submitting || !isServerPlayerId(player.id)) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await pvpSubmitMove(player.id, mv)
      if (!res.ok) {
        setError(res.error ?? "move")
        return
      }
      if (res.match) setMatch(res.match)
      else await pollLoop()
    } finally {
      setSubmitting(false)
    }
  }

  const handleForfeit = async () => {
    if (!isServerPlayerId(player.id)) return
    await pvpLeave(player.id)
    await syncPlayerFromServer()
    prepareOnlinePvp(false)
    setScreen("menu")
  }

  if (!opponent || !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <p className="text-muted-foreground text-sm">{t("pvpArenaLoading")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-accent">
          <Coins className="h-5 w-5" />
          <span className="font-extrabold tabular-nums">
            {formatAmount(toDisplayAmount(currentBet))} {currencyLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          <span className="tabular-nums font-mono">{timeLeft}s</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex flex-col items-center flex-1">
          <PlayerAvatar name={player.name} avatar={player.avatar} avatarUrl={player.avatarUrl} size="lg" />
          <span className="text-xs mt-2 font-semibold truncate max-w-[120px]">{t("commonYou")}</span>
        </div>
        <span className="text-2xl font-black text-muted-foreground">VS</span>
        <div className="flex flex-col items-center flex-1">
          <PlayerAvatar name={opponent.name} avatar={opponent.avatar} avatarUrl={opponent.avatarUrl} size="lg" />
          <span className="text-xs mt-2 font-semibold truncate max-w-[120px]">{opponent.name}</span>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground mb-2">
        {t("pvpArenaRound", { current: match.round, total: match.totalRounds })}
      </p>
      <p className="text-center text-lg font-bold mb-4 tabular-nums">
        {youAreP0 ? match.scores[0] : match.scores[1]} — {youAreP0 ? match.scores[1] : match.scores[0]}
      </p>

      {error && <p className="text-center text-sm text-red-400 mb-3">{t("pvpArenaError")}</p>}

      {reveal && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 mb-4 text-center">
          <p className="text-sm font-bold mb-2">{t("pvpArenaReveal")}</p>
          <p className="text-3xl mb-1">
            {(youAreP0 ? reveal.p0Move : reveal.p1Move) === "rock"
              ? "🪨"
              : (youAreP0 ? reveal.p0Move : reveal.p1Move) === "scissors"
                ? "✂️"
                : "📄"}{" "}
            vs{" "}
            {(youAreP0 ? reveal.p1Move : reveal.p0Move) === "rock"
              ? "🪨"
              : (youAreP0 ? reveal.p1Move : reveal.p0Move) === "scissors"
                ? "✂️"
                : "📄"}
          </p>
          <p className="text-sm text-muted-foreground">
            {mapRevealToMyOutcome(reveal, youAreP0) === "win"
              ? t("outcomeWin")
              : mapRevealToMyOutcome(reveal, youAreP0) === "loss"
                ? t("outcomeLoss")
                : t("pvpArenaDraw")}
          </p>
        </div>
      )}

      {match.status === "playing" && needMyMove && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {MOVE_UI.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={submitting}
              onClick={() => void handlePick(m.key)}
              className="flex flex-col items-center justify-center py-4 rounded-2xl border-2 border-border bg-card/60 hover:bg-card active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <span className="text-3xl">{m.icon}</span>
              <span className="text-xs font-bold mt-1">{moveLabel(t, m.key)}</span>
            </button>
          ))}
        </div>
      )}

      {waitingOpp && <p className="text-center text-sm text-muted-foreground mb-4">{t("pvpArenaWaitOpponent")}</p>}

      {match.status === "completed" && (
        <p className="text-center text-sm text-muted-foreground">{t("pvpArenaLoading")}</p>
      )}

      <button
        type="button"
        onClick={() => void handleForfeit()}
        className="mt-auto text-sm text-red-400/90 hover:text-red-300 underline-offset-2"
      >
        {t("pvpArenaForfeit")}
      </button>
    </div>
  )
}
