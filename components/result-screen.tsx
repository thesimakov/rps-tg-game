"use client"

import { useGame } from "@/lib/game-context"
import type { Player } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { Trophy, Skull, Minus, Coins, RotateCcw, ArrowRight, Zap, Heart, Hammer, Scissors, FileText, Moon, Sun, Droplets, Gift } from "lucide-react"
import { PlayerAvatar, VipBadgeOnFrame } from "@/components/player-avatar"
import { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n/context"
import type { Translate } from "@/lib/i18n/context"

/** Текст исхода: что произошло (бумага обернула камень, ножницы порезали бумагу и т.д.) */
function getOutcomePhrase(
  t: Translate,
  playerMove: string | null,
  opponentMove: string | null,
  outcome: string
): string | null {
  if (outcome === "draw") return t("outcomeDrawMove")
  const winner = outcome === "win" ? playerMove : opponentMove
  const loser = outcome === "win" ? opponentMove : playerMove
  if (winner === "rock" && loser === "scissors") return t("outcomeRockCrushesScissors")
  if (winner === "scissors" && loser === "paper") return t("outcomeScissorsCutPaper")
  if (winner === "paper" && loser === "rock") return t("outcomePaperCoversRock")
  if (winner === "water" && loser === "rock") return t("outcomeWaterErodesRock")
  if (winner === "paper" && loser === "water") return t("outcomePaperSoaksWater")
  if (winner === "fire" && loser === "rock") return t("outcomeFireMeltsRock")
  if (winner === "rock" && loser === "water") return t("outcomeRockPartsWater")
  if (winner === "water" && loser === "fire") return t("outcomeWaterExtinguishesFire")
  return null
}

/** Иконка исхода: кто кого победил — показываем победную комбинацию (молоток = камень бьёт ножницы, ножницы режут бумагу, бумага накрывает камень) */
function OutcomeIcon({
  playerMove,
  opponentMove,
  outcome,
  t,
}: {
  playerMove: string | null
  opponentMove: string | null
  outcome: string
  t: Translate
}) {
  if (outcome === "draw") return <Minus className="h-8 w-8 text-white/50" />
  const winner = outcome === "win" ? playerMove : opponentMove
  const loser = outcome === "win" ? opponentMove : playerMove
  const cls = "h-8 w-8 text-white/70"
  if (winner === "rock" && loser === "scissors") return <Hammer className={cls} aria-label={t("ariaRockBeatsScissors")} />
  if (winner === "scissors" && loser === "paper") return <Scissors className={cls} aria-label={t("ariaScissorsCutPaper")} />
  if (winner === "paper" && loser === "rock") return <FileText className={cls} aria-label={t("ariaPaperCoversRock")} />
  if (winner === "water" && loser === "rock") return <Droplets className={cls} aria-label={t("ariaWaterErodesRock")} />
  if (winner === "paper" && loser === "water") return <FileText className={cls} aria-label={t("ariaPaperSoaksWater")} />
  return <Minus className={cls} />
}

const FIRE_ANIMATION_DURATION_MS = 3000
const CONFETTI_DURATION_MS = 3200
const LOSE_FX_DURATION_MS = 1800
const FIRE_PARTICLES_COUNT = 48
const CONFETTI_PIECES = 50
const LOSE_PARTICLES = 22

/** Детерминированные позиции огоньков (по индексу), чтобы не было гидратации */
function getFirePosition(i: number) {
  return {
    left: `${(i * 7 + 3) % 94 + 3}%`,
    top: `${(i * 11 + 5) % 88 + 6}%`,
    size: 18 + (i % 5) * 4,
    delay: (i % 10) * 0.08,
  }
}

/** Салют: разлёт из центра во все стороны (детерминировано по i) */
function getConfettiPosition(i: number) {
  const angle = (i / CONFETTI_PIECES) * 2 * Math.PI + (i % 3) * 0.4
  const distance = 140 + (i % 5) * 25
  const dx = Math.round(Math.cos(angle) * distance)
  const dy = Math.round(Math.sin(angle) * distance)
  return {
    dx,
    dy,
    delay: (i % 5) * 0.02,
    rot: (i % 4) * 180 + (i * 90),
    color: ["#fbbf24", "#f59e0b", "#84cc16", "#22c55e", "#eab308", "#38bdf8", "#a78bfa", "#f472b6"][i % 8],
  }
}

/** Частицы поражения: разлёт от центра вниз/в стороны */
function getLoseFxPosition(i: number) {
  const angle = (i / LOSE_PARTICLES) * Math.PI * 1.8 + 0.6
  const distance = 90 + (i % 6) * 22
  const dx = Math.round(Math.cos(angle) * distance)
  const dy = Math.round(Math.sin(angle) * distance + 25)
  return {
    dx,
    dy,
    delay: (i % 5) * 0.03,
    rot: (i % 4) * 110 + i * 16,
    symbol: i % 3 === 0 ? "💀" : i % 2 === 0 ? "🕳️" : "✖",
  }
}

export function ResultScreen() {
  const { t } = useI18n()
  const { lastResult, setScreen, opponent, player, totalRounds, currentBet, toDisplayAmount, currencyLabel } = useGame()
  const isWin = lastResult?.outcome === "win"
  const isDraw = lastResult?.outcome === "draw"
  /** Поражение из-за таймаута (кто-то не выбрал карту) — показываем «Кто-то уснул» вместо черепа и карт */
  const isAsleep = lastResult?.outcome === "loss" && lastResult.playerMove == null && lastResult.opponentMove == null
  const showFireAnimation = isWin && player.victoryAnimation === "fire"
  const showConfetti = isWin && player.victoryAnimation !== "fire"
  const showLoseFx = !isWin && !isDraw && !isAsleep

  const [fireVisible, setFireVisible] = useState(showFireAnimation)
  const [confettiVisible, setConfettiVisible] = useState(showConfetti)
  const [loseFxVisible, setLoseFxVisible] = useState(showLoseFx)

  useEffect(() => {
    if (!showFireAnimation) return
    setFireVisible(true)
    const t = setTimeout(() => setFireVisible(false), FIRE_ANIMATION_DURATION_MS)
    return () => clearTimeout(t)
  }, [showFireAnimation])

  useEffect(() => {
    if (!showConfetti) return
    setConfettiVisible(true)
    const t = setTimeout(() => setConfettiVisible(false), CONFETTI_DURATION_MS)
    return () => clearTimeout(t)
  }, [showConfetti])

  useEffect(() => {
    if (!showLoseFx) return
    setLoseFxVisible(true)
    const t = setTimeout(() => setLoseFxVisible(false), LOSE_FX_DURATION_MS)
    return () => clearTimeout(t)
  }, [showLoseFx])

  if (!lastResult) return null

  const bankAmount = lastResult.bet * 2
  const totalRating = player.ratingPoints ?? 0

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
  const rounds = lastResult.rounds ?? []
  const playerRoundsWon = rounds.filter((r) => r.outcome === "win").length
  const opponentRoundsWon = rounds.filter((r) => r.outcome === "loss").length
  const isFiveRoundMatch = totalRounds === 5 && rounds.length === 5
  const isBossWin = isWin && (opponentData.id === "boss-npc" || player.activeWeeklyMode === "boss_week")
  const hasBossChest = !!player.bossChestPending
  const stakeMultiplier = Math.max(1, Math.round(lastResult.bet / Math.max(1, currentBet)))

  return (
    <div className={`flex flex-col min-h-screen relative arena-bg ${showLoseFx ? "result-lose-shake" : ""}`}>
      {/* Победа с анимацией «Огонь»: полноэкранные огоньки */}
      {fireVisible && (
        <div
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
          aria-hidden
        >
          <div className="absolute inset-0 fire-glow" />
          {Array.from({ length: FIRE_PARTICLES_COUNT }, (_, i) => {
            const { left, top, size, delay } = getFirePosition(i)
            return (
              <span
                key={i}
                className="absolute fire-float opacity-0"
                style={{
                  left,
                  top,
                  fontSize: size,
                  animation: `fire-float ${FIRE_ANIMATION_DURATION_MS}ms ease-out ${delay}s forwards`,
                }}
              >
                🔥
              </span>
            )
          })}
        </div>
      )}

      {/* Победа без огня: конфетти-салют (взрыв из центра) */}
      {confettiVisible && (
        <div
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
          aria-hidden
        >
          {Array.from({ length: CONFETTI_PIECES }, (_, i) => {
            const { dx, dy, delay, rot, color } = getConfettiPosition(i)
            return (
              <div
                key={i}
                className="result-confetti-piece rounded-sm"
                style={{
                  backgroundColor: color,
                  animationDelay: `${delay}s`,
                  ["--dx" as string]: `${dx}px`,
                  ["--dy" as string]: `${dy}px`,
                  ["--rot" as string]: `${rot}deg`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* Поражение: красный импульс + осколки/черепа */}
      {loseFxVisible && (
        <div
          className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
          aria-hidden
        >
          <div className="absolute inset-0 result-lose-overlay" />
          {Array.from({ length: LOSE_PARTICLES }, (_, i) => {
            const { dx, dy, delay, rot, symbol } = getLoseFxPosition(i)
            return (
              <span
                key={i}
                className="result-lose-particle"
                style={{
                  left: "50%",
                  top: "45%",
                  animationDelay: `${delay}s`,
                  ["--dx" as string]: `${dx}px`,
                  ["--dy" as string]: `${dy}px`,
                  ["--rot" as string]: `${rot}deg`,
                }}
              >
                {symbol}
              </span>
            )
          })}
        </div>
      )}

      {/* Верхняя панель: БАНК | БОНУСЫ | РАУНД — как на арене, закреплена сверху */}
      <div className="sticky top-0 z-10 w-full px-4 py-3 bg-background/85 backdrop-blur-md border-b border-border/30 shrink-0">
        <div className="flex items-center justify-between w-full max-w-lg mx-auto">
          {/* Банк */}
          <div className="flex flex-col">
            <span className="text-base font-semibold text-white/95 uppercase tracking-wider">
              {t("resultBank")}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <Coins className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <span className="text-xl font-extrabold text-amber-400 tabular-nums leading-none">
                {formatAmount(toDisplayAmount(bankAmount))}
              </span>
            </div>
            <span className="mt-0.5 text-[11px] text-white/70 font-medium uppercase tracking-wide">
              {currencyLabel}
            </span>
          </div>

          {/* Бонусы рейтинга */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {t("resultBonuses")}
            </span>
            <div className="relative px-3 py-1 rounded-full border border-amber-400/50 bg-amber-500/20 min-w-[72px] flex items-center justify-center">
              <span className="text-sm font-bold text-amber-200 tabular-nums">
                {formatAmount(totalRating)}
              </span>
              {isWin && lastResult.bonus > 0 && (
                <span className="result-bonus-fly text-xs font-bold text-emerald-300 tabular-nums">
                  +{formatAmount(lastResult.bonus)}
                </span>
              )}
            </div>
          </div>

          {/* Раунд */}
          <div className="flex flex-col items-end">
            <span className="text-base font-semibold text-white uppercase tracking-widest leading-none">
              {t("resultRoundHeader", { total: totalRounds })}
            </span>
            <div className="mt-1 flex gap-1">
              {Array.from({ length: totalRounds }).map((_, i) => (
                <Heart key={i} className="h-5 w-5 flex-shrink-0 text-white/25" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Контент по центру: исход, карты (или «Кто-то уснул»), история раундов, награда, кнопки */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
      {isAsleep ? (
        /* Блок «Кто-то уснул» вместо поражения: луна, солнце, Z z z */
        <>
          <div className="flex items-center justify-center gap-6 mb-4 asleep-moon-sun">
            <Moon className="h-14 w-14 text-indigo-300 drop-shadow-lg" strokeWidth={1.5} />
            <Sun className="h-16 w-16 text-amber-300 drop-shadow-lg" strokeWidth={1.5} />
          </div>
          <h1 className="result-title-in text-base font-black uppercase tracking-wide text-amber-200/95 mb-2" style={{ animationDelay: "0.1s" }}>
            {t("resultSomeoneSleptTitle")}
          </h1>
          <div className="flex items-end gap-1 mb-4" style={{ minHeight: "2.5rem" }}>
            <span className="asleep-zzz asleep-zzz-delay-1 text-3xl sm:text-4xl font-black text-white/90">Z</span>
            <span className="asleep-zzz asleep-zzz-delay-2 text-2xl sm:text-3xl font-black text-white/80">z</span>
            <span className="asleep-zzz asleep-zzz-delay-3 text-2xl sm:text-3xl font-black text-white/80">z</span>
          </div>
          <p className="text-white/80 text-sm sm:text-base text-center max-w-xs mb-6 leading-relaxed">
            {t("resultSomeoneSleptBody")}
          </p>
        </>
      ) : (
        <>
      {/* Исход: ПОБЕДА / ПОРАЖЕНИЕ / НИЧЬЯ с иконкой — анимация появления и пульс */}
      <div className="flex flex-col items-center mb-6">
        <div className="result-title-in flex flex-col items-center gap-3" style={{ animationDelay: "0.15s" }}>
          {isWin ? (
            <Trophy className={`result-icon-in h-12 w-12 text-sky-400 ${"result-icon-win-pulse"}`} style={{ animationDelay: "0.2s" }} />
          ) : isDraw ? (
            <Minus className="result-icon-in h-12 w-12 text-amber-400" style={{ animationDelay: "0.2s" }} />
          ) : (
            <Skull className={`result-icon-in h-12 w-12 text-red-400 ${"result-icon-lose-pulse"}`} style={{ animationDelay: "0.2s" }} />
          )}
          <h1
            className={`result-title-in text-3xl sm:text-4xl font-black uppercase tracking-wide text-center ${
              isWin ? "text-sky-300" : isDraw ? "text-amber-400" : "text-red-400"
            }`}
            style={{ animationDelay: "0.25s" }}
          >
            {isWin ? t("outcomeWinShort") : isDraw ? t("outcomeDrawShort") : t("outcomeLossShort")}
          </h1>
        </div>
      </div>

      {/* История всех ходов в матче */}
      {rounds.length > 1 && (
        <div className="flex flex-col items-center gap-2 mb-3 w-full max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[13px] uppercase tracking-wide text-white/60">
              {t("resultAllMoves")}
            </span>
          </div>

          {isFiveRoundMatch ? (
            // Специальное расположение 5 карт: для каждого игрока 3 сверху, 2 снизу — над своим аватаром,
            // между ними крупный счёт матча.
            <div className="mt-2 flex items-center justify-between w-full max-w-lg mx-auto gap-4">
              {/* Карты игрока (слева) */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center gap-2">
                  {rounds.slice(0, 3).map((r, idx) => (
                    <div
                      key={`five-top-player-${r.round}-${idx}`}
                      className={`w-10 h-14 sm:w-12 sm:h-16 card-medieval ${
                        r.playerMove === "rock"
                          ? "card-medieval-rock"
                          : r.playerMove === "paper"
                          ? "card-medieval-paper"
                          : r.playerMove === "scissors"
                          ? "card-medieval-scissors"
                          : r.playerMove === "water"
                          ? "card-medieval-water"
                          : r.playerMove === "fire"
                          ? "card-medieval-fire"
                          : ""
                      } ${player.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {rounds.slice(3, 5).map((r, idx) => (
                    <div
                      key={`five-bottom-player-${r.round}-${idx}`}
                      className={`w-10 h-14 sm:w-12 sm:h-16 card-medieval ${
                        r.playerMove === "rock"
                          ? "card-medieval-rock"
                          : r.playerMove === "paper"
                          ? "card-medieval-paper"
                          : r.playerMove === "scissors"
                          ? "card-medieval-scissors"
                          : r.playerMove === "water"
                          ? "card-medieval-water"
                          : r.playerMove === "fire"
                          ? "card-medieval-fire"
                          : ""
                      } ${player.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
                    />
                  ))}
                </div>
              </div>

              {/* Крупный счёт посередине */}
              <span className="text-xl sm:text-2xl font-extrabold text-white">
                <span className="text-emerald-300">{playerRoundsWon}</span>
                <span className="mx-1">:</span>
                <span className="text-red-400">{opponentRoundsWon}</span>
              </span>

              {/* Карты соперника (справа) */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center gap-2">
                  {rounds.slice(0, 3).map((r, idx) => (
                    <div
                      key={`five-top-opponent-${r.round}-${idx}`}
                      className={`w-10 h-14 sm:w-12 sm:h-16 card-medieval card-medieval-opponent ${
                        r.opponentMove === "rock"
                          ? "card-medieval-rock"
                          : r.opponentMove === "paper"
                          ? "card-medieval-paper"
                          : r.opponentMove === "scissors"
                          ? "card-medieval-scissors"
                          : r.opponentMove === "water"
                          ? "card-medieval-water"
                          : r.opponentMove === "fire"
                          ? "card-medieval-fire"
                          : ""
                      } ${opponentData.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {rounds.slice(3, 5).map((r, idx) => (
                    <div
                      key={`five-bottom-opponent-${r.round}-${idx}`}
                      className={`w-10 h-14 sm:w-12 sm:h-16 card-medieval card-medieval-opponent ${
                        r.opponentMove === "rock"
                          ? "card-medieval-rock"
                          : r.opponentMove === "paper"
                          ? "card-medieval-paper"
                          : r.opponentMove === "scissors"
                          ? "card-medieval-scissors"
                          : r.opponentMove === "water"
                          ? "card-medieval-water"
                          : r.opponentMove === "fire"
                          ? "card-medieval-fire"
                          : ""
                      } ${opponentData.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Стандартное расположение: ряды карт игрока и соперника + счёт по центру
            <div className="mt-1 flex items-center justify-center gap-3 w-full">
              {/* Карты игрока слева */}
              <div className="flex items-center gap-1">
                {rounds.map((r, idx) => (
                  <div
                    key={`p-row-${r.round}-${idx}`}
                    className={`w-8 h-12 sm:w-10 sm:h-14 card-medieval ${
                      r.playerMove === "rock"
                        ? "card-medieval-rock"
                        : r.playerMove === "paper"
                        ? "card-medieval-paper"
                        : r.playerMove === "scissors"
                        ? "card-medieval-scissors"
                        : r.playerMove === "water"
                        ? "card-medieval-water"
                        : r.playerMove === "fire"
                        ? "card-medieval-fire"
                        : ""
                    } ${player.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
                  />
                ))}
              </div>

              {/* Счёт посередине */}
              <span className="text-base sm:text-lg font-extrabold text-white">
                <span className="text-emerald-300">{playerRoundsWon}</span>
                <span className="mx-1">:</span>
                <span className="text-red-400">{opponentRoundsWon}</span>
              </span>

              {/* Карты соперника справа */}
              <div className="flex items-center gap-1">
                {rounds.map((r, idx) => (
                  <div
                    key={`o-row-${r.round}-${idx}`}
                    className={`w-8 h-12 sm:w-10 sm:h-14 card-medieval card-medieval-opponent ${
                      r.opponentMove === "rock"
                        ? "card-medieval-rock"
                        : r.opponentMove === "paper"
                        ? "card-medieval-paper"
                        : r.opponentMove === "scissors"
                        ? "card-medieval-scissors"
                        : r.opponentMove === "water"
                        ? "card-medieval-water"
                        : r.opponentMove === "fire"
                        ? "card-medieval-fire"
                        : ""
                    } ${opponentData.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Две основные карты: симметричная сетка (игрок | центр | соперник) */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-6 w-full max-w-lg mx-auto mb-4">
        <div className="result-card-left justify-self-center w-full max-w-[160px] flex flex-col items-center gap-3" style={{ animationDelay: "0.35s" }}>
          <div
            className={`card-medieval w-32 h-40 sm:w-36 sm:h-44 flex flex-col items-center justify-center gap-0 ${
              lastResult.playerMove === "rock"
                ? "card-medieval-rock"
                : lastResult.playerMove === "paper"
                ? "card-medieval-paper"
                : lastResult.playerMove === "scissors"
                ? "card-medieval-scissors"
                : lastResult.playerMove === "water"
                ? "card-medieval-water"
                : lastResult.playerMove === "fire"
                ? "card-medieval-fire"
                : ""
            } ${player.cardSkin === "gold" ? "card-medieval-selected" : ""} ${
              player.cardDeck === "ancient-rus" ? "card-set-ancient" : ""
            }`}
          />
          {player.avatarFrame === "gold" ? (
            <div className="relative inline-flex flex-shrink-0">
              <div className="gold-frame-outer w-16 h-16">
                <div className="gold-frame-inner w-full h-full flex items-center justify-center">
                  <PlayerAvatar name={player.name} avatar={player.avatar} avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl} size="md" variant="primary" vip={false} />
                </div>
              </div>
              {player.vip && <VipBadgeOnFrame size="md" />}
            </div>
          ) : player.vip ? (
            <div className="relative inline-flex flex-shrink-0">
              <div className="vip-frame-outer w-16 h-16">
                <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                  <PlayerAvatar name={player.name} avatar={player.avatar} avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl} size="md" variant="primary" vip={false} />
                </div>
              </div>
              <VipBadgeOnFrame size="md" />
            </div>
          ) : (
            <div
              className={`rounded-xl overflow-hidden border-2 bg-sky-500/10 ${
                player.avatarFrame === "neon" ? "border-cyan-400/80 shadow-lg shadow-cyan-400/30" : "border-sky-400/30"
              }`}
            >
              <PlayerAvatar name={player.name} avatar={player.avatar} avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl} size="md" variant="primary" />
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/90 font-semibold">{player.name}</span>
            {player.activeTitleId && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-500/25 text-purple-200 border border-purple-400/40">
                {player.activeTitleId}
              </span>
            )}
          </div>
        </div>

        <div className="result-center-in self-center flex flex-col items-center justify-center gap-2 px-1" style={{ animationDelay: "0.5s" }}>
          <OutcomeIcon
            playerMove={lastResult.playerMove}
            opponentMove={lastResult.opponentMove}
            outcome={lastResult.outcome}
            t={t}
          />
          <p className="text-xs sm:text-sm text-white/80 text-center font-medium max-w-[160px] leading-tight">
            {getOutcomePhrase(t, lastResult.playerMove, lastResult.opponentMove, lastResult.outcome) ?? ""}
          </p>
        </div>

        <div className="result-card-right justify-self-center w-full max-w-[160px] flex flex-col items-center gap-3" style={{ animationDelay: "0.4s" }}>
          <div
            className={`card-medieval card-medieval-opponent w-32 h-40 sm:w-36 sm:h-44 flex flex-col items-center justify-center gap-0 ${
              lastResult.opponentMove === "rock"
                ? "card-medieval-rock"
                : lastResult.opponentMove === "paper"
                ? "card-medieval-paper"
                : lastResult.opponentMove === "scissors"
                ? "card-medieval-scissors"
                : lastResult.opponentMove === "water"
                ? "card-medieval-water"
                : lastResult.opponentMove === "fire"
                ? "card-medieval-fire"
                : ""
            } ${opponentData.cardDeck === "ancient-rus" ? "card-set-ancient" : ""}`}
          />
          {opponentData.vip ? (
            <div className="relative inline-flex flex-shrink-0">
              <div className="vip-frame-outer w-16 h-16">
                <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                  <PlayerAvatar name={opponentData.name} avatar={opponentData.avatar} avatarUrl={opponentData.avatarUrl} size="md" variant="destructive" vip={false} />
                </div>
              </div>
              <VipBadgeOnFrame size="md" />
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border-2 border-red-400/30 bg-red-500/10">
              <PlayerAvatar name={opponentData.name} avatar={opponentData.avatar} avatarUrl={opponentData.avatarUrl} size="md" variant="destructive" />
            </div>
          )}
          <span className="text-xs text-white/90 font-semibold text-center">{opponentData.name}</span>
        </div>
      </div>
        </>
      )}

      {/* Итог матча: сколько денег выиграно / проиграно */}
      <div className="flex flex-col items-center mb-8 gap-1">
        <div
          className={`result-earnings-in flex items-center justify-center gap-2 rounded-full border-2 border-amber-400/60 bg-amber-500/20 px-5 py-2.5 w-fit mx-auto ${
            lastResult.earnings > 0 ? "result-earnings-win" : ""
          }`}
          style={{ animationDelay: "0.65s" }}
        >
          <Coins className="h-5 w-5 text-amber-400" />
          <span
            className={`text-base font-bold tabular-nums ${
              lastResult.earnings > 0 ? "text-amber-400" : lastResult.earnings < 0 ? "text-red-400" : "text-amber-400"
            }`}
          >
            {lastResult.earnings > 0 ? "+" : ""}
            {formatAmount(toDisplayAmount(lastResult.earnings))} {currencyLabel}
          </span>
        </div>
        <p className="text-xs text-white/70">
          {lastResult.earnings > 0
            ? t("resultYouWon", {
                amount: formatAmount(toDisplayAmount(lastResult.earnings)),
                currency: currencyLabel,
              })
            : lastResult.earnings < 0
              ? t("resultYouLost", {
                  amount: formatAmount(toDisplayAmount(Math.abs(lastResult.earnings))),
                  currency: currencyLabel,
                })
              : t("resultDrawBalance")}
        </p>
        {stakeMultiplier > 1 && (
          <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
            {t("resultStakeMult", { n: stakeMultiplier })}
          </span>
        )}
      </div>

      {/* Кнопки: Реванш, Закончить игру — появление снизу каскадом */}
      <div className="w-full max-w-xs mx-auto flex flex-col gap-3">
        {isBossWin && hasBossChest && (
          <button
            onClick={() => setScreen("boss-reward")}
            className="result-btn-in w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold py-3.5 rounded-2xl transition-all active:scale-[0.98]"
            style={{ animationDelay: "0.72s" }}
          >
            <Gift className="h-5 w-5" />
            <span>{t("resultOpenBossChest")}</span>
          </button>
        )}
        <button
          onClick={() => setScreen("matchmaking")}
          className="result-btn-in w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-lg py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-sky-500/30"
          style={{ animationDelay: "0.8s" }}
        >
          <RotateCcw className="h-5 w-5" />
          <span>{t("resultRematch")}</span>
        </button>
        <button
          onClick={() => setScreen("bet-select")}
          className="result-btn-in w-full flex items-center justify-center gap-2 bg-slate-600/80 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-[0.98] border border-slate-500/50"
          style={{ animationDelay: "0.95s" }}
        >
          <ArrowRight className="h-5 w-5" />
          <span>{t("resultEndGame")}</span>
        </button>
      </div>
      </div>
    </div>
  )
}
