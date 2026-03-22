"use client"

import { useGame } from "@/lib/game-context"
import { Gift, Coins, Star, ArrowLeft, Sparkles } from "lucide-react"
import { formatAmount } from "@/lib/format-amount"
import { useEffect, useMemo, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { BOSS_REWARD_LABEL_KEY } from "@/lib/i18n/boss-reward-keys"
import type { Translate } from "@/lib/i18n/context"

type RevealPhase = "closed" | "opening" | "revealed"

function rarityUi(rarity: "rare" | "epic" | "legendary", t: Translate) {
  if (rarity === "legendary") {
    return {
      label: t("bossRarityLegendary"),
      chestClass: "boss-chest-legendary",
      badgeClass: "bg-amber-500/20 text-amber-200 border-amber-400/50",
    }
  }
  if (rarity === "epic") {
    return {
      label: t("bossRarityEpic"),
      chestClass: "boss-chest-epic",
      badgeClass: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50",
    }
  }
  return {
    label: t("bossRarityRare"),
    chestClass: "boss-chest-rare",
    badgeClass: "bg-sky-500/20 text-sky-200 border-sky-400/50",
  }
}

function confettiPieces(rarity: "rare" | "epic" | "legendary") {
  const baseColors =
    rarity === "legendary"
      ? ["#f59e0b", "#fde68a", "#f97316", "#fb7185", "#facc15"]
      : rarity === "epic"
      ? ["#a78bfa", "#f472b6", "#c084fc", "#60a5fa", "#e879f9"]
      : ["#38bdf8", "#22d3ee", "#60a5fa", "#34d399", "#a3e635"]
  return Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2
    const distance = 90 + (i % 7) * 16
    return {
      id: i,
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance),
      color: baseColors[i % baseColors.length],
      delay: `${(i % 6) * 0.03}s`,
      rot: `${(i % 4) * 90}deg`,
    }
  })
}

export function BossRewardScreen() {
  const { t } = useI18n()
  const { player, setPlayer, setScreen, currencyLabel, toDisplayAmount } = useGame()
  const chest = player.bossChestPending
  const [phase, setPhase] = useState<RevealPhase>("closed")
  const [openingStep, setOpeningStep] = useState(0)
  const ui = chest ? rarityUi(chest.rarity, t) : null
  const displayRewardLabel = chest
    ? BOSS_REWARD_LABEL_KEY[chest.rewardId]
      ? t(BOSS_REWARD_LABEL_KEY[chest.rewardId])
      : chest.rewardLabel
    : ""
  const confetti = useMemo(() => (chest ? confettiPieces(chest.rarity) : []), [chest])

  useEffect(() => {
    if (phase !== "opening") return
    setOpeningStep(0)
    const t1 = setTimeout(() => setOpeningStep(1), 250)
    const t2 = setTimeout(() => setOpeningStep(2), 520)
    const t3 = setTimeout(() => setOpeningStep(3), 820)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [phase])

  if (!chest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <p className="text-sm text-white/80">{t("bossRewardMissing")}</p>
        <button
          type="button"
          onClick={() => setScreen("menu")}
          className="mt-4 px-4 py-2 rounded-xl bg-slate-700 text-white text-sm"
        >
          {t("bossRewardToMenu")}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8">
      <div className="w-full max-w-lg flex items-center mb-6">
        <button
          onClick={() => setScreen("result")}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-foreground"
          aria-label={t("commonBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground uppercase tracking-wider">
          {t("bossRewardTitle")}
        </h1>
        <div className="w-9" />
      </div>

      <div className="relative w-full max-w-lg rounded-3xl border border-amber-400/50 bg-amber-500/10 p-5 overflow-hidden">
        {phase === "opening" && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="boss-chest-flash" />
            {confetti.map((c) => (
              <span
                key={c.id}
                className="boss-chest-confetti"
                style={{
                  left: "50%",
                  top: "48%",
                  backgroundColor: c.color,
                  animationDelay: c.delay,
                  ["--dx" as string]: `${c.dx}px`,
                  ["--dy" as string]: `${c.dy}px`,
                  ["--rot" as string]: c.rot,
                }}
              />
            ))}
          </div>
        )}

        {phase !== "revealed" ? (
          <button
            type="button"
            onClick={() => {
              if (phase !== "closed") return
              setPhase("opening")
              setTimeout(() => setPhase("revealed"), 1200)
            }}
            className={`w-full rounded-2xl border border-white/15 bg-slate-900/55 py-7 transition-transform hover:scale-[1.01] active:scale-[0.99] ${
              ui?.chestClass ?? ""
            } ${phase === "opening" ? "boss-chest-opening" : ""}`}
          >
            <div className="flex flex-col items-center">
              <Gift className="h-14 w-14 text-amber-300" />
              <span className="mt-3 text-sm font-bold text-white">
                {phase === "closed" ? t("bossRewardTapChest") : t("bossRewardOpening")}
              </span>
              {phase === "opening" && (
                <span className="mt-1 text-[11px] text-amber-200/90 boss-reveal-step">
                  {openingStep === 0 && t("bossRevealScan")}
                  {openingStep === 1 && t("bossRevealStabilize")}
                  {openingStep === 2 && t("bossRevealMaterialize")}
                  {openingStep >= 3 && t("bossRevealAlmost")}
                </span>
              )}
              <span className="mt-2 text-[10px] text-white/65 uppercase tracking-wide">{t("bossRewardTapRevealLine")}</span>
            </div>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-center mb-3">
              <Sparkles className="h-8 w-8 text-amber-300" />
            </div>
            <div className="flex justify-center mb-2">
              <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wider ${ui?.badgeClass}`}>
                {ui?.label}
              </span>
            </div>
            <p className="text-center text-lg font-extrabold text-amber-200">{t("bossRewardReceived")}</p>
            <p className="text-center text-sm text-white/80 mt-2">{displayRewardLabel}</p>

            <div className="mt-4 flex items-center justify-center gap-2 text-emerald-300">
              <Coins className="h-4 w-4" />
              <span className="text-sm font-bold">
                +{formatAmount(toDisplayAmount(chest.rewardCoins))} {currencyLabel}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-sky-300">
              <Star className="h-4 w-4" />
              <span className="text-sm font-semibold">{t("bossRewardRating", { n: chest.rewardRating })}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setPlayer((p) => {
                  const liveOps = p.liveOpsState
                  const skins = liveOps?.inventory?.skins ?? []
                  const nextSkins = skins.includes(chest.rewardId) ? skins : [...skins, chest.rewardId]
                  const history = p.bossChestHistory ?? []
                  const nextHistory = [
                    {
                      rarity: chest.rarity,
                      rewardId: chest.rewardId,
                      rewardLabel: chest.rewardLabel,
                      rewardCoins: chest.rewardCoins,
                      rewardRating: chest.rewardRating,
                      openedAt: Date.now(),
                    },
                    ...history,
                  ].slice(0, 10)
                  return {
                    ...p,
                    balance: p.balance + chest.rewardCoins,
                    ratingPoints: Math.min(1000, (p.ratingPoints ?? 0) + chest.rewardRating),
                    bossChestPending: undefined,
                    bossChestHistory: nextHistory,
                    liveOpsState: liveOps
                      ? {
                          ...liveOps,
                          inventory: {
                            ...liveOps.inventory,
                            skins: nextSkins,
                          },
                        }
                      : liveOps,
                  }
                })
                setScreen("menu")
              }}
              className="mt-5 w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-sm"
            >
              {t("bossRewardClaimBtn")}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
