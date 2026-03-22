"use client"

import { useState } from "react"
import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { ArrowLeft, Coins, Flame, Skull, Users } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import type { Translate } from "@/lib/i18n/context"
import { resolveWeeklyEventUi } from "@/lib/i18n/weekly-event-ui"
import { isServerPlayerId } from "@/lib/platform-user"

/** Ставка и режим: 5,10 = быстрая игра (1 ход); 25,50 = 3 хода; 100,250 = 5 ходов */
const BET_OPTIONS: { value: number; rounds: 1 | 3 | 5 }[] = [
  { value: 5, rounds: 1 },
  { value: 10, rounds: 1 },
  { value: 25, rounds: 3 },
  { value: 50, rounds: 3 },
  { value: 100, rounds: 5 },
  { value: 250, rounds: 5 },
]

function getTierAccent(rounds: number) {
  if (rounds === 1) return "border-primary/30 hover:border-primary/60"
  if (rounds === 3) return "border-secondary/30 hover:border-secondary/60"
  return "border-destructive/30 hover:border-destructive/60"
}

function getTierBadge(rounds: number, t: Translate) {
  if (rounds === 1) return { label: t("betRounds1"), cls: "bg-primary/15 text-primary" }
  if (rounds === 3) return { label: t("betRounds3"), cls: "bg-secondary/15 text-secondary" }
  return { label: t("betRounds5"), cls: "bg-destructive/15 text-destructive" }
}

export function BetSelect() {
  const { t } = useI18n()
  const { setScreen, setCurrentBet, setTotalRounds, player, setPlayer, toDisplayAmount, currencyLabel, weeklyRules, prepareOnlinePvp } =
    useGame()
  /** Boss week: босс или онлайн-дуэль с реальным игроком. */
  const [bossWeekPath, setBossWeekPath] = useState<"boss" | "live">("boss")

  const weeklyUi = weeklyRules
    ? resolveWeeklyEventUi(weeklyRules.event.mode, weeklyRules.event.title, weeklyRules.event.description, t)
    : null

  const isBossWeek = weeklyRules?.event.mode === "boss_week"

  const handleSelectBet = (value: number, rounds: 1 | 3 | 5) => {
    if (player.balance < value) return
    if (isBossWeek && bossWeekPath === "live" && !isServerPlayerId(player.id)) {
      window.alert(t("pvpNeedTelegram"))
      return
    }
    setCurrentBet(value)
    setTotalRounds(rounds)
    if (isBossWeek && bossWeekPath === "live") {
      prepareOnlinePvp(true)
      setPlayer((p) => ({ ...p, activeWeeklyMode: undefined }))
    } else {
      prepareOnlinePvp(false)
      if (weeklyRules?.event.mode) {
        setPlayer((p) => ({ ...p, activeWeeklyMode: weeklyRules.event.mode }))
      }
    }
    setScreen("matchmaking")
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center mb-8">
        <button
          onClick={() => setScreen("menu")}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-foreground"
          aria-label={t("commonBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground uppercase tracking-wider">
          {t("betSelectTitle")}
        </h1>
        <div className="w-9" />
      </div>

      {/* Balance */}
      <div className="flex items-center gap-2.5 bg-card/60 backdrop-blur-sm border border-accent/20 rounded-full px-5 py-2.5 mb-6">
        <Coins className="h-4 w-4 text-accent" />
        <span className="text-base font-extrabold text-accent tabular-nums">
          {formatAmount(toDisplayAmount(player.balance))} {currencyLabel}
        </span>
      </div>

      <p className="text-muted-foreground text-sm mb-6 text-center font-medium">
        {t("betSelectHint")}
      </p>

      {weeklyRules && weeklyUi && (
        <div className="w-full max-w-lg mb-5 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
          <p className="text-sm font-semibold text-sky-200">{weeklyUi.title}</p>
          <p className="text-xs text-white/75 mt-1">{weeklyUi.description}</p>
        </div>
      )}

      {isBossWeek && (
        <div className="w-full max-w-lg mb-4">
          <p className="text-xs text-center text-muted-foreground mb-2.5 font-medium leading-snug">
            {t("betBossWeekPathHint")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBossWeekPath("boss")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-2xl border text-sm font-bold transition-all ${
                bossWeekPath === "boss"
                  ? "bg-red-500/25 border-red-400/55 text-red-100 shadow-md shadow-red-900/20"
                  : "bg-card/40 border-border/40 text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              <Skull className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {t("betPathBossWeek")}
            </button>
            <button
              type="button"
              onClick={() => setBossWeekPath("live")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-2xl border text-sm font-bold transition-all ${
                bossWeekPath === "live"
                  ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-100 shadow-md shadow-emerald-900/15"
                  : "bg-card/40 border-border/40 text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {t("betPathLiveGame")}
            </button>
          </div>
        </div>
      )}

      {/* Сетка: ставка + режим (объединённое поле) */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-3">
        {BET_OPTIONS.map(({ value, rounds }) => {
          const canAfford = player.balance >= value
          const badge = getTierBadge(rounds, t)
          return (
            <button
              key={value}
              onClick={() => handleSelectBet(value, rounds)}
              disabled={!canAfford}
              className={`relative flex flex-col items-center justify-center gap-1 py-5 px-4 rounded-2xl border transition-all active:scale-[0.97] ${
                canAfford
                  ? `bg-card/60 backdrop-blur-sm ${getTierAccent(rounds)} text-foreground cursor-pointer hover:bg-card/80`
                  : "bg-muted/30 border-border/30 text-muted-foreground cursor-not-allowed opacity-40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Coins className={`h-5 w-5 ${canAfford ? "text-accent" : "text-muted-foreground"}`} />
                <span className="text-base font-extrabold tabular-nums">
                  {formatAmount(toDisplayAmount(value))} {currencyLabel}
                </span>
              </div>
              <span className={`mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.cls}`}>
                {badge.label}
              </span>
              {rounds === 5 && canAfford && (
                <Flame className="absolute top-2.5 left-2.5 h-4 w-4 text-destructive/50" />
              )}
            </button>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-6 w-full max-w-lg bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4">
        <p className="text-sm text-muted-foreground text-center font-medium">
          {t("betSelectBankHint")}
        </p>
      </div>
    </div>
  )
}
