"use client"

import { useGame, type Move, type MatchRoundSummary } from "@/lib/game-context"
import type { Player } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { useState, useEffect, useRef, useCallback } from "react"
import { Coins, Timer, Zap, Heart, ChevronUp, ChevronDown, ShieldAlert } from "lucide-react"
import { PlayerAvatar, VipBadgeOnFrame } from "@/components/player-avatar"
import { sendMatchResult } from "@/lib/liveops/client"
import { isServerPlayerId } from "@/lib/platform-user"
import { useI18n } from "@/lib/i18n/context"
import type { Translate } from "@/lib/i18n/context"
import { BOSS_REWARD_LABEL_KEY } from "@/lib/i18n/boss-reward-keys"
import { resolveWeeklyEventUi } from "@/lib/i18n/weekly-event-ui"

const BASE_MOVES: { key: Move; icon: string; color: string }[] = [
  { key: "rock", icon: "\uD83E\uDEA8", color: "border-secondary/50 shadow-secondary/10" },
  { key: "scissors", icon: "\u2702\uFE0F", color: "border-destructive/50 shadow-destructive/10" },
  { key: "paper", icon: "\uD83D\uDCC4", color: "border-primary/50 shadow-primary/10" },
]

const FIRE_MOVE: { key: Move; icon: string; color: string } = {
  key: "fire",
  icon: "\uD83D\uDD25",
  color: "border-orange-500/60 shadow-orange-500/20",
}

const WATER_MOVE: { key: Move; icon: string; color: string } = {
  key: "water",
  icon: "\uD83C\uDF0A",
  color: "border-sky-500/50 shadow-sky-500/10",
}

function moveLabel(t: Translate, key: Move): string {
  if (key === "rock") return t("moveRock")
  if (key === "scissors") return t("moveScissors")
  if (key === "paper") return t("movePaper")
  if (key === "water") return t("moveWater")
  return t("moveFire")
}

function getOutcome(p: Move, o: Move): "win" | "loss" | "draw" {
  if (p === o) return "draw"
  const isElementalP = p === "fire" || p === "water" || p === "rock"
  const isElementalO = o === "fire" || o === "water" || o === "rock"
  if (isElementalP && isElementalO) {
    if ((p === "fire" && o === "rock") || (p === "rock" && o === "water") || (p === "water" && o === "fire")) {
      return "win"
    }
    return "loss"
  }
  // Вода: побеждает камень, проигрывает бумаге, ничья с ножницами
  if (p === "water") {
    if (o === "rock") return "win"
    if (o === "paper") return "loss"
    return "draw" // water vs scissors
  }
  if (o === "water") {
    if (p === "rock") return "loss"
    if (p === "paper") return "win"
    return "draw" // scissors vs water
  }
  if (
    (p === "rock" && o === "scissors") ||
    (p === "scissors" && o === "paper") ||
    (p === "paper" && o === "rock")
  ) return "win"
  return "loss"
}

function getRandomMove(): Move {
  const m: Move[] = ["rock", "scissors", "paper"]
  return m[Math.floor(Math.random() * 3)]
}

/** Ход, который бьёт переданный ход (для правила: против робота при ставке >100 игрок проигрывает) */
function getMoveThatBeats(move: Move): Move {
  if (move === "rock") return "paper"
  if (move === "scissors") return "rock"
  if (move === "water") return "paper" // paper beats water
  if (move === "fire") return "water"
  return "scissors"
}

function getRandomMoveFrom(list: Move[]): Move {
  if (list.length === 0) return getRandomMove()
  return list[Math.floor(Math.random() * list.length)]
}

function getBossMove(history: Move[], allowedMoves: Move[]): Move {
  const pool: Move[] = allowedMoves.length ? allowedMoves : (["rock", "scissors", "paper"] as Move[])
  if (history.length < 2) {
    return getRandomMoveFrom(pool)
  }
  const count = new Map<Move, number>()
  for (const m of history) count.set(m, (count.get(m) ?? 0) + 1)
  let predicted: Move = history[history.length - 1]
  let best = -1
  for (const [move, v] of count.entries()) {
    if (v > best) {
      best = v
      predicted = move
    }
  }
  const counter = getMoveThatBeats(predicted)
  if (Math.random() < 0.7 && pool.includes(counter)) return counter
  return getRandomMoveFrom(pool)
}

function getBossChestReward(pityCounter: number) {
  type BossChestReward = {
    rarity: "rare" | "epic" | "legendary"
    rewardId: string
    rewardCoins: number
    rewardRating: number
  }
  const rewards: BossChestReward[] = [
    { rarity: "rare" as const, rewardId: "rare_obsidian_rock", rewardCoins: 500, rewardRating: 120 },
    { rarity: "rare" as const, rewardId: "rare_phantom_scissors", rewardCoins: 550, rewardRating: 130 },
    { rarity: "epic" as const, rewardId: "epic_aurora_paper", rewardCoins: 800, rewardRating: 180 },
    { rarity: "epic" as const, rewardId: "epic_solar_blade", rewardCoins: 850, rewardRating: 200 },
    { rarity: "legendary" as const, rewardId: "legendary_void_hand", rewardCoins: 1300, rewardRating: 300 },
  ]
  if (pityCounter >= 9) {
    const legendaryPool = rewards.filter((r) => r.rarity === "legendary")
    return legendaryPool[Math.floor(Math.random() * legendaryPool.length)]
  }
  const roll = Math.random()
  // 70% rare, 25% epic, 5% legendary
  let pool = rewards.filter((r) => r.rarity === "rare")
  if (roll > 0.7 && roll <= 0.95) pool = rewards.filter((r) => r.rarity === "epic")
  if (roll > 0.95) pool = rewards.filter((r) => r.rarity === "legendary")
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Текст исхода раунда для подсказки на арене + тон для стиля */
function getRoundOutcomeHint(
  t: Translate,
  playerMove: Move,
  opponentMove: Move,
  outcome: "win" | "loss" | "draw"
): { message: string; tone: "win" | "loss" | "neutral" } {
  if (outcome === "draw") return { message: "", tone: "neutral" }
  const winner = outcome === "win" ? playerMove : opponentMove
  const loser = outcome === "win" ? opponentMove : playerMove
  if (winner === "rock" && loser === "scissors") return { message: t("outcomeRockCrushesScissors"), tone: "neutral" }
  if (winner === "scissors" && loser === "paper") return { message: t("outcomeScissorsCutPaper"), tone: "neutral" }
  if (winner === "paper" && loser === "rock") return { message: t("outcomePaperCoversRock"), tone: "neutral" }
  if (winner === "water" && loser === "rock") return { message: t("outcomeWaterErodesRock"), tone: "neutral" }
  if (winner === "paper" && loser === "water") return { message: t("outcomePaperSoaksWater"), tone: "neutral" }
  if (winner === "fire" && loser === "rock") return { message: t("outcomeFireMeltsRock"), tone: "neutral" }
  if (winner === "rock" && loser === "water") return { message: t("outcomeRockPartsWater"), tone: "neutral" }
  if (winner === "water" && loser === "fire") return { message: t("outcomeWaterExtinguishesFire"), tone: "neutral" }
  if (winner === "water" || loser === "water") {
    return {
      message: outcome === "win" ? t("outcomeWin") : t("outcomeLoss"),
      tone: outcome === "win" ? "win" : "loss",
    }
  }
  return {
    message: outcome === "win" ? t("outcomeWin") : t("outcomeLoss"),
    tone: outcome === "win" ? "win" : "loss",
  }
}

function bossRewardLabelFromRoll(t: Translate, rewardId: string): string {
  const key = BOSS_REWARD_LABEL_KEY[rewardId]
  return key ? t(key) : rewardId
}

type Phase = "choosing" | "locked" | "revealing" | "resolved"

export function GameArena() {
  const { t } = useI18n()
  const { opponent, player, setPlayer, currentBet, setLastResult, setScreen, totalRounds, weeklyRules } = useGame()
  const activeMode = player.activeWeeklyMode ?? weeklyRules?.event.mode
  const isElementsMode = activeMode === "elements_tournament"
  const isTimeMoneyMode = activeMode === "time_is_money"
  const isBossMode = activeMode === "boss_week" || opponent?.id === "boss-npc"
  const hasWaterCard = (player.waterCardUses ?? 0) > 0
  const allowedMovesByMode: Move[] = isElementsMode
    ? ["fire", "water", "rock"]
    : weeklyRules?.allowedMoves?.length
      ? (weeklyRules.allowedMoves as Move[])
      : hasWaterCard
        ? [...BASE_MOVES, WATER_MOVE].map((m) => m.key as Move)
        : BASE_MOVES.map((m) => m.key as Move)
  const MOVES = isElementsMode
    ? [FIRE_MOVE, WATER_MOVE, BASE_MOVES[0]]
    : hasWaterCard
      ? [...BASE_MOVES, WATER_MOVE]
      : BASE_MOVES
  const movesWithLabels = MOVES.map((m) => ({ ...m, label: moveLabel(t, m.key) }))
  const hasExtraTimer = (player.extraTimerUntil ?? 0) > Date.now()
  const baseTimer = hasExtraTimer ? 25 : 15

  const [timeLeft, setTimeLeft] = useState(baseTimer)
  const [selectedMove, setSelectedMove] = useState<Move | null>(null)
  const [opponentMove, setOpponentMove] = useState<Move | null>(null)
  const [phase, setPhase] = useState<Phase>("choosing")
  /** Номер текущего раунда (1-based). Растёт только после победы или поражения. */
  const [roundCount, setRoundCount] = useState(1)
  /** Локальный счёт в матче (раунды): соперник : игрок */
  const [opponentScore, setOpponentScore] = useState(0)
  const [playerScore, setPlayerScore] = useState(0)
  const [drawMessage, setDrawMessage] = useState(false)
  /** Подсказка что произошло в раунде (победа/поражение) — для 3 и 5 раундов */
  const [roundHintMessage, setRoundHintMessage] = useState<string | null>(null)
  const [roundHintTone, setRoundHintTone] = useState<"win" | "loss" | "neutral" | null>(null)
  /** Показать карту соперника с небольшой задержкой после выбора игрока */
  const [showOpponentCard, setShowOpponentCard] = useState(false)

  /** История раундов в матче для экрана результата */
  const [roundsHistory, setRoundsHistory] = useState<MatchRoundSummary[]>([])
  const roundsHistoryRef = useRef<MatchRoundSummary[]>([])

  /** Наклейки/смайлики, которые игрок кидает сопернику во время таймера */
  const [stickers, setStickers] = useState<{ id: number; emoji: string; dx: number; dy: number; dur: number }[]>([])
  const stickerIdRef = useRef(1)

  // Ref to prevent double-resolution
  const resolvedRef = useRef(false)
  // Refs for timeouts — очищаем при размонтировании, чтобы не вызывать setState после unmount
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }, [])

  const getEffectiveStake = useCallback(
    (round: number) => {
      if (!isTimeMoneyMode) return currentBet
      const multiplier = Math.floor(Math.max(0, round - 1) / 2)
      return currentBet * 2 ** multiplier
    },
    [currentBet, isTimeMoneyMode]
  )

  const trackLiveOpsMatch = useCallback(
    (won: boolean, movesUsed: Move[]) => {
      if (!isServerPlayerId(player.id)) return
      void sendMatchResult(player.id, {
        type: "match_finished",
        won,
        movesUsed: movesUsed.length ? movesUsed : ["rock"],
        skinIdUsed: player.cardSkin,
        betVoices: currentBet,
        bankVoices: currentBet * 2,
        mode: player.activeWeeklyMode,
      }).catch(() => {})
      if (player.activeWeeklyMode) {
        setPlayer((p) => ({ ...p, activeWeeklyMode: undefined }))
      }
    },
    [currentBet, player.activeWeeklyMode, player.cardSkin, player.id, setPlayer]
  )

  useEffect(() => {
    // При входе на арену сбрасываем историю раундов и таймеры
    roundsHistoryRef.current = []
    setRoundsHistory([])
    setStickers([])
    return clearTimers
  }, [clearTimers])

  const canSpamStickers = phase === "choosing" && timeLeft > 0

  const sendSticker = (emoji: string) => {
    if (!canSpamStickers) return
    const id = stickerIdRef.current++
    // Случайное направление и расстояние от таймера (центр арены)
    const angle = Math.random() * Math.PI * 2
    const distance = 80 + Math.random() * 100 // 80–180px — разлёт шире
    const dx = Math.cos(angle) * distance
    const dy = -Math.abs(Math.sin(angle) * distance) // летят чуть вверх
    const dur = 1.3 + Math.random() * 0.7 // 1.3–2.0s
    const sticker = { id, emoji, dx, dy, dur }
    setStickers((prev) => [...prev, sticker])
    setTimeout(() => {
      setStickers((prev) => prev.filter((s) => s.id !== id))
    }, 1300)
  }

  const resolveRound = useCallback(
    (playerMove: Move) => {
      // Prevent double fire
      if (resolvedRef.current) return
      resolvedRef.current = true

      // Правило для робота: до 50 монет — случайный исход, выше 100 монет — игрок проигрывает
      const isBot = opponent?.id?.startsWith("bot-") ?? false
      const history = roundsHistoryRef.current.map((r) => r.playerMove)
      const eventRandom = getRandomMoveFrom(allowedMovesByMode)
      const oppMove = isBossMode
        ? getBossMove(history, allowedMovesByMode)
        : isBot && !activeMode && currentBet > 100
          ? getMoveThatBeats(playerMove)
          : eventRandom

      setPhase("locked")
      setOpponentMove(oppMove)
      setShowOpponentCard(false)

      // Небольшая задержка перед открытием карты соперника
      const cardRevealTimer = setTimeout(() => setShowOpponentCard(true), 500)
      timersRef.current.push(cardRevealTimer)

      // After a beat, reveal
      const revealTimer = setTimeout(() => {
        setPhase("revealing")
        const outcome = getOutcome(playerMove, oppMove)

        // Счёт после этого раунда (до обновления стейта), нужен для итогового результата матча
        let playerScoreAfter = playerScore
        let opponentScoreAfter = opponentScore

        if (outcome === "draw") {
          setDrawMessage(true)
          const drawTimer = setTimeout(() => {
            setDrawMessage(false)
            setSelectedMove(null)
            setOpponentMove(null)
            setShowOpponentCard(false)
            setPhase("choosing")
            setTimeLeft(baseTimer)
            resolvedRef.current = false
          }, 2000)
          timersRef.current.push(drawTimer)
          return
        }

        // Подсказка что произошло (для мультираунда)
        const hint = getRoundOutcomeHint(t, playerMove, oppMove, outcome)
        setRoundHintMessage(hint.message)
        setRoundHintTone(hint.tone)

        // Обновляем локальный счёт матча по раундам
        if (outcome === "win") {
          playerScoreAfter += 1
          setPlayerScore((prev) => prev + 1)
        } else if (outcome === "loss") {
          opponentScoreAfter += 1
          setOpponentScore((prev) => prev + 1)
        }

        // Сохраняем раунд в историю для экрана результата
        const historyEntry: MatchRoundSummary = {
          round: roundCount,
          playerMove,
          opponentMove: oppMove,
          outcome,
        }
        const nextHistory = [...roundsHistoryRef.current, historyEntry]
        roundsHistoryRef.current = nextHistory
        setRoundsHistory(nextHistory)

        // Экономика раунда: банк = ставка × 2, без комиссии.
        const effectiveBet = getEffectiveStake(roundCount)
        const pot = effectiveBet * 2
        const winnings = pot
        const roundEarnings = outcome === "win" ? winnings - effectiveBet : -effectiveBet
        const roundBonus = outcome === "win" ? Math.max(1, Math.round(winnings * 0.1)) : 0

        // Для одиночного раунда применяем экономику сразу.
        if (totalRounds === 1) {
          setPlayer((p) => {
            const effectiveBetInner = getEffectiveStake(roundCount)
            const potInner = effectiveBetInner * 2
            const winningsInner = potInner
            const earningsInner = outcome === "win" ? winningsInner - effectiveBetInner : -effectiveBetInner
            const bonusInner =
              outcome === "win" ? Math.max(1, Math.round(winningsInner * 0.1)) : 0

            const next = {
              ...p,
              balance: p.balance + earningsInner,
              wins: outcome === "win" ? p.wins + 1 : p.wins,
              losses: outcome === "loss" ? p.losses + 1 : p.losses,
              weekWins: outcome === "win" ? p.weekWins + 1 : p.weekWins,
              weekEarnings: p.weekEarnings + Math.max(0, earningsInner),
              ratingPoints: Math.min(1000, (p.ratingPoints ?? 0) + bonusInner),
            }
            if (playerMove === "water" && !isElementsMode) {
              next.waterCardUses = Math.max(0, (p.waterCardUses ?? 0) - 1)
            }
            if (outcome === "win" && isBossMode) {
              const currentPity = p.bossChestPityCounter ?? 0
              const reward = getBossChestReward(currentPity)
              next.bossChestPending = {
                ...reward,
                rewardLabel: bossRewardLabelFromRoll(t, reward.rewardId),
                createdAt: Date.now(),
              }
              next.bossChestPityCounter = reward.rarity === "legendary" ? 0 : currentPity + 1
            }
            return next
          })

          setLastResult({
            playerMove,
            opponentMove: oppMove,
            outcome,
            earnings: roundEarnings,
            bet: effectiveBet,
            bonus: roundBonus,
          })
          trackLiveOpsMatch(outcome === "win", [playerMove])
        } else {
          // В мульти-раундовых матчах (3 или 5 ходов) ставка относится ко всему матчу.
          // Здесь обновляем только использование карты «Вода», без изменения баланса и статистики.
          if (playerMove === "water" && !isElementsMode) {
            setPlayer((p) => ({
              ...p,
              waterCardUses: Math.max(0, (p.waterCardUses ?? 0) - 1),
            }))
          }
        }

        setPhase("resolved")

        const doneTimer = setTimeout(() => {
          setRoundHintMessage(null)
          setRoundHintTone(null)
          const nextRound = roundCount + 1
          if (nextRound > totalRounds) {
            // Матч завершён.
            if (totalRounds > 1) {
              // Для матчей на 3 и 5 раундов: считаем итог по очкам и применяем экономику один раз за матч.
              let finalOutcome: "win" | "loss" | "draw" = "draw"
              if (playerScoreAfter > opponentScoreAfter) finalOutcome = "win"
              else if (playerScoreAfter < opponentScoreAfter) finalOutcome = "loss"

              // Экономика матча: ставка относится ко всему матчу, а не к каждому раунду.
              const finalBet = getEffectiveStake(totalRounds)
              const potMatch = finalBet * 2
              const winningsMatch = potMatch

              let finalEarnings = 0
              if (finalOutcome === "win") finalEarnings = winningsMatch - finalBet
              else if (finalOutcome === "loss") finalEarnings = -finalBet
              else finalEarnings = 0

              const matchBonus =
                finalOutcome === "win" ? Math.max(1, Math.round(winningsMatch * 0.1)) : 0

              setPlayer((p) => {
                const next = {
                  ...p,
                  balance: p.balance + finalEarnings,
                  wins: finalOutcome === "win" ? p.wins + 1 : p.wins,
                  losses: finalOutcome === "loss" ? p.losses + 1 : p.losses,
                  weekWins: finalOutcome === "win" ? p.weekWins + 1 : p.weekWins,
                  weekEarnings: p.weekEarnings + Math.max(0, finalEarnings),
                  ratingPoints: Math.min(1000, (p.ratingPoints ?? 0) + matchBonus),
                }
                if (finalOutcome === "win" && isBossMode) {
                  const currentPity = p.bossChestPityCounter ?? 0
                  const reward = getBossChestReward(currentPity)
                  next.bossChestPending = {
                    ...reward,
                    rewardLabel: bossRewardLabelFromRoll(t, reward.rewardId),
                    createdAt: Date.now(),
                  }
                  next.bossChestPityCounter = reward.rarity === "legendary" ? 0 : currentPity + 1
                }
                return next
              })

              setLastResult({
                playerMove,
                opponentMove: oppMove,
                outcome: finalOutcome,
                earnings: finalEarnings,
                bet: finalBet,
                bonus: matchBonus,
                rounds: roundsHistoryRef.current,
              })
              if (finalOutcome === "win" || finalOutcome === "loss") {
                const allMoves = roundsHistoryRef.current.map((r) => r.playerMove)
                trackLiveOpsMatch(finalOutcome === "win", allMoves)
              }
            }

            setScreen("result")
          } else {
            setRoundCount(nextRound)
            setSelectedMove(null)
            setOpponentMove(null)
            setShowOpponentCard(false)
            setPhase("choosing")
            setTimeLeft(baseTimer)
            resolvedRef.current = false
          }
        }, 1800)
        timersRef.current.push(doneTimer)
      }, 1200)
      timersRef.current.push(revealTimer)
    },
    [
      currentBet,
      opponent?.id,
      player.vip,
      activeMode,
      allowedMovesByMode,
      isBossMode,
      getEffectiveStake,
      isElementsMode,
      setPlayer,
      setLastResult,
      setScreen,
      totalRounds,
      roundCount,
      playerScore,
      opponentScore,
      trackLiveOpsMatch,
      t,
    ]
  )

  // Timer countdown
  useEffect(() => {
    if (phase !== "choosing") return

    if (timeLeft <= 0) {
      // Не выбрал карту вовремя — сразу экран результата с «Кто-то уснул»
      if (!selectedMove) {
        setPlayer((p) => ({
          ...p,
          balance: p.balance - currentBet,
          losses: p.losses + 1,
        }))
        setLastResult({
          playerMove: null,
          opponentMove: null,
          outcome: "loss",
          earnings: -currentBet,
          bet: currentBet,
          bonus: 0,
        })
        trackLiveOpsMatch(false, ["rock"])
        setScreen("result")
        return
      }
      return
    }

    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [timeLeft, phase, selectedMove, currentBet, setPlayer, setLastResult, setScreen, resolveRound, baseTimer, trackLiveOpsMatch])

  const handleSelectMove = (move: Move) => {
    if (phase !== "choosing") return
    setSelectedMove(move)
    resolveRound(move)
  }

  const opponentData: Player = opponent ?? {
    id: "opponent",
    name: t("arenaOpponent"),
    avatar: "?",
    avatarUrl: "",
    balance: 0,
    wins: 0,
    losses: 0,
    weekWins: 0,
    weekEarnings: 0,
    vip: false,
  }
  const timerDanger = timeLeft <= 5
  /** Сердечки = сколько ходов осталось (после победы/поражения один ход засчитывается) */
  const movesLeft = Math.max(0, totalRounds - roundCount + 1)
  const bankAmount = getEffectiveStake(roundCount) * 2
  const playerStakeNow = getEffectiveStake(roundCount)
  const isBlindLuckMode = activeMode === "blind_luck" || !!weeklyRules?.hideOpponentBet
  const stakeMultiplier = Math.max(1, Math.round(getEffectiveStake(roundCount) / Math.max(1, currentBet)))
  const bankDisplay = isBlindLuckMode ? `${formatAmount(playerStakeNow)} + ?` : formatAmount(bankAmount)
  const weeklyBannerTitle = weeklyRules?.event
    ? resolveWeeklyEventUi(weeklyRules.event.mode, weeklyRules.event.title, weeklyRules.event.description, t).title
    : ""

  return (
    <div className="flex flex-col min-h-screen relative px-4 py-4 arena-bg">
      {/* Верхняя панель как в макете: БАНК | БОНУСЫ | РАУНД + сердечки */}
      <div className="w-full max-w-lg mx-auto mb-5">
        {weeklyRules?.event && (
          <div className="mb-3 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wide font-bold bg-sky-500/20 border border-sky-400/40 text-sky-200">
              {weeklyBannerTitle}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          {/* Банк */}
          <div className="flex flex-col">
            <span className="text-base font-semibold text-white/95 uppercase tracking-wider">
              {t("arenaBank")}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <Coins className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <span className="text-xl font-extrabold text-amber-400 tabular-nums leading-none">
                {bankDisplay}
              </span>
            </div>
            <span className="mt-0.5 text-[11px] text-white/70 font-medium uppercase tracking-wide">
              {isBlindLuckMode ? t("arenaBankBlind") : t("commonCoins")}
            </span>
            {isTimeMoneyMode && (
              <span className="mt-1 inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 animate-pulse">
                {t("arenaTimeIsMoneyBadge", { n: stakeMultiplier })}
              </span>
            )}
          </div>

          {/* Бонусы */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {t("arenaBonuses")}
            </span>
            <div className="mt-1 px-4 py-1 rounded-full border border-amber-400/70 bg-amber-500/20">
              <span className="text-sm font-bold text-amber-200 tabular-nums">
                {formatAmount(player.ratingPoints ?? 0)}
              </span>
            </div>
          </div>

          {/* Раунд + сердечки */}
          <div className="flex flex-col items-end">
            <span className="text-base font-semibold text-white uppercase tracking-widest leading-none">
              {t("arenaRound", { current: roundCount, total: totalRounds })}
            </span>
            <span className="mt-1 text-[11px] text-white/70 font-medium">
              {totalRounds === 1
                ? t("arenaFormatOne")
                : totalRounds >= 2 && totalRounds <= 4
                  ? t("arenaFormatFew", { n: totalRounds })
                  : t("arenaFormatMany", { n: totalRounds })}
            </span>
            <div className="mt-1 flex gap-1">
              {Array.from({ length: totalRounds }).map((_, i) => (
                <Heart
                  key={i}
                  className={`h-5 w-5 flex-shrink-0 ${
                    i < movesLeft ? "fill-red-500 text-red-500" : "text-white/25"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Соперник: аватар, имя, карта с анимацией переворота */}
      <div className="flex flex-col items-center gap-2 w-full max-w-lg mx-auto">
        {isBossMode && (
          <div className="w-full rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 flex items-center justify-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-300" />
            <span className="text-xs font-semibold text-red-200">{t("arenaBossBanner")}</span>
          </div>
        )}
        {opponentData.vip ? (
          <div className="relative inline-flex flex-shrink-0">
            <div className="vip-frame-outer w-16 h-16">
              <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                <PlayerAvatar
                  name={opponentData.name}
                  avatar={opponentData.avatar}
                  avatarUrl={opponentData.avatarUrl}
                  size="md"
                  variant="destructive"
                  vip={false}
                />
              </div>
            </div>
            <VipBadgeOnFrame size="md" />
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border-2 border-red-500/30 bg-red-500/10 flex-shrink-0">
            <PlayerAvatar
              name={opponentData.name}
              avatar={opponentData.avatar}
              avatarUrl={opponentData.avatarUrl}
              size="md"
              variant="destructive"
            />
          </div>
        )}
        <span className="text-base font-bold text-white">{opponentData.name}</span>
        <div
          className={`card-flip-wrap w-28 h-36 ${
            phase !== "choosing" && opponentMove && showOpponentCard ? "flipped" : ""
          } ${opponent?.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
        >
          <div className="card-flip-inner w-full h-full">
            {/* Лицевая сторона (пока соперник не открыл карту): просто рубашка */}
            <div className="card-flip-front card-medieval card-medieval-back" />
            {/* Обратная сторона: та же карта, что и у игрока (камень/бумага/ножницы) */}
            <div
              className={`card-flip-back card-medieval card-medieval-opponent ${
                opponentMove === "rock"
                  ? "card-medieval-rock"
                  : opponentMove === "paper"
                  ? "card-medieval-paper"
                  : opponentMove === "scissors"
                  ? "card-medieval-scissors"
                  : opponentMove === "water"
                  ? "card-medieval-water"
                  : opponentMove === "fire"
                  ? "card-medieval-fire"
                  : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Центр: таймер, реакции и подсказки + локальный счёт раундов */}
      <div className="flex flex-col items-center justify-center gap-2 my-4 w-full max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center gap-2">
          {/* Таймер и иконки-реакции по бокам */}
          <div className="flex items-center justify-center gap-4">
            {/* Левая реакция */}
            <button
              type="button"
              onClick={() => sendSticker("🤔")}
              disabled={!canSpamStickers}
              className={`h-9 w-9 rounded-full border border-slate-500/60 bg-slate-800/80 flex items-center justify-center text-lg transition-all ${
                canSpamStickers ? "active:scale-90 hover:bg-slate-700" : "opacity-40 cursor-not-allowed"
              }`}
            >
              🤔
            </button>

            {/* Сам таймер */}
            <div className="relative">
            <div className="absolute inset-0 bg-sky-500/30 rounded-full blur-xl scale-110" />
            <div className="relative w-20 h-20 rounded-full bg-sky-600/40 border-2 border-sky-400/50 flex items-center justify-center">
              <svg className="absolute w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" strokeWidth="4" className="stroke-white/20" />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 36}
                      strokeDashoffset={2 * Math.PI * 36 * (1 - timeLeft / baseTimer)}
                      className={`transition-all duration-1000 linear ${
                        timerDanger ? "stroke-red-400" : "stroke-sky-400"
                      }`}
                    />
              </svg>
              <div className="absolute flex flex-col items-center">
                <Timer className={`h-4 w-4 mb-0.5 ${timerDanger ? "text-red-300" : "text-sky-300"}`} />
                <span className={`text-2xl font-black tabular-nums text-white`}>{timeLeft}</span>
              </div>
            </div>
              {/* Облако стикеров, вылетающих из центра таймера */}
              <div className="pointer-events-none absolute inset-0">
                {stickers.map((s, index) => (
                  <span
                    key={s.id}
                    className="sticker-bubble"
                    style={{
                      animationDelay: `${index * 0.05}s`,
                      ["--dx" as string]: `${s.dx}px`,
                      ["--dy" as string]: `${s.dy}px`,
                      ["--dur" as string]: `${s.dur}s`,
                    }}
                  >
                    {s.emoji}
                  </span>
                ))}
              </div>
            </div>

            {/* Правые реакции */}
            <div className="flex flex-col items-center gap-2">
              {["👀", "🔥"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendSticker(emoji)}
                  disabled={!canSpamStickers}
                  className={`h-9 w-9 rounded-full border border-slate-500/60 bg-slate-800/80 flex items-center justify-center text-lg transition-all ${
                    canSpamStickers ? "active:scale-90 hover:bg-slate-700" : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          {/* Локальный счёт раундов: соперник : игрок, стрелки обозначают игроков */}
          {totalRounds > 1 && (
            <div className="mt-2 flex items-center gap-3">
              <ChevronUp className="h-4 w-4 text-red-300" aria-label={t("arenaOpponent")} />
              <span className="text-lg font-black text-white tabular-nums">
                {opponentScore} : {playerScore}
              </span>
              <ChevronDown className="h-4 w-4 text-emerald-300" aria-label={t("commonYou")} />
            </div>
          )}
          {drawMessage && (
            <p className="text-sm text-amber-400 font-bold animate-in fade-in">{t("arenaDrawRound")}</p>
          )}
          {roundHintMessage && !drawMessage && (
            <p
              className={`text-sm font-bold animate-in fade-in ${
                roundHintTone === "win"
                  ? "text-emerald-400"
                  : roundHintTone === "loss"
                    ? "text-red-400"
                    : "text-white/90"
              }`}
            >
              {roundHintMessage}
            </p>
          )}
        </div>
      </div>

      {/* Кнопки выбора: три карты лицевой стороной — игрок сразу видит Камень, Ножницы, Бумагу */}
      <div className="flex justify-center gap-4 w-full max-w-lg mx-auto mb-6">
        {movesWithLabels.map((move) => {
          const isSelected = selectedMove === move.key
          const isChoosing = phase === "choosing"
          return (
            <button
              key={move.key}
              type="button"
              onClick={() => handleSelectMove(move.key)}
              disabled={phase !== "choosing"}
              className={`flex flex-col items-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18223D] rounded-lg ${
                isChoosing ? "cursor-pointer active:scale-95 hover:scale-105" : "cursor-default"
              }`}
            >
              <div
                className={`card-medieval w-20 h-28 flex flex-col items-center justify-end pb-1.5 ${
                  move.key === "rock"
                    ? "card-medieval-rock"
                    : move.key === "paper"
                      ? "card-medieval-paper"
                      : move.key === "scissors"
                        ? "card-medieval-scissors"
                        : move.key === "water"
                          ? "card-medieval-water"
                          : move.key === "fire"
                            ? "card-medieval-fire"
                          : ""
                } ${isSelected || player.cardSkin === "gold" ? "card-medieval-selected" : ""} ${
                  move.key === "water" ? "border-sky-500/60" : ""
                } ${player.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
              >
                <span className="text-[9px] font-bold text-white drop-shadow-md mt-0.5 uppercase tracking-wide">
                  {move.label}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Игрок: аватар, имя, баланс */}
      <div className="mt-auto flex flex-col items-center w-full max-w-lg mx-auto pb-2">
        {player.avatarFrame === "gold" ? (
          <div className="relative inline-flex flex-shrink-0">
            <div className="gold-frame-outer w-16 h-16">
              <div className="gold-frame-inner w-full h-full">
                <PlayerAvatar
                  name={player.name}
                  avatar={player.avatar}
                  avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
                  size="md"
                  variant="accent"
                  vip={false}
                />
              </div>
            </div>
            {player.vip && <VipBadgeOnFrame size="md" />}
          </div>
        ) : player.vip ? (
          <div className="relative inline-flex flex-shrink-0">
            <div className="vip-frame-outer w-16 h-16">
              <div className="vip-frame-inner w-full h-full">
                <PlayerAvatar
                  name={player.name}
                  avatar={player.avatar}
                  avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
                  size="md"
                  variant="accent"
                  vip={false}
                />
              </div>
            </div>
            <VipBadgeOnFrame size="md" />
          </div>
        ) : (
          <div
            className={`rounded-full overflow-hidden border-2 flex-shrink-0 ${
              player.avatarFrame === "neon"
                ? "border-cyan-400/70 bg-cyan-500/10 shadow-md shadow-cyan-400/20"
                : "border-primary/40 bg-primary/10"
            }`}
          >
            <PlayerAvatar
              name={player.name}
              avatar={player.avatar}
              avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
              size="md"
              variant="primary"
            />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-base font-bold text-white">{player.name}</span>
          {player.activeTitleId && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/25 text-purple-200 border border-purple-400/40">
              {player.activeTitleId}
            </span>
          )}
        </div>
        <span className="text-base text-white/70">{t("arenaBalanceLine", { amount: formatAmount(player.balance) })}</span>
      </div>

      {/* Надпись снизу */}
      <p className="text-center text-xs text-white/40 font-medium tracking-widest uppercase pb-6 pt-1">
        {t("arenaFooterMoves")}
      </p>
    </div>
  )
}
