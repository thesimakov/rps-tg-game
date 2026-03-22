"use client"

import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { useEffect, useRef, useState } from "react"
import { Coins, Search, X } from "lucide-react"
import { PlayerAvatar, VipBadgeOnFrame } from "@/components/player-avatar"
import { useI18n } from "@/lib/i18n/context"
import { isServerPlayerId } from "@/lib/platform-user"
import { pvpEnqueue, pvpPoll, pvpLeave } from "@/lib/pvp/client"
import type { PvpMatchPublicView, PvpPublicPlayer } from "@/lib/pvp/types"

const NORMAL_SEARCH_MS = 2500
const FAST_SEARCH_MS = 800
const ONLINE_POLL_MS = 600

export function Matchmaking() {
  const { t } = useI18n()
  const {
    setScreen,
    opponent,
    setOpponent,
    currentBet,
    player,
    setPlayer,
    totalRounds,
    toDisplayAmount,
    currencyLabel,
    weeklyRules,
    prepareOnlinePvp,
    getOnlinePvpIntent,
  } = useGame()

  const [dots, setDots] = useState("")
  const [progress, setProgress] = useState(0)
  const useFastSearch = (player.fastMatchBoosts ?? 0) > 0
  const searchMs = useFastSearch ? FAST_SEARCH_MS : NORMAL_SEARCH_MS
  const isBossWeek = (player.activeWeeklyMode ?? weeklyRules?.event.mode) === "boss_week"
  const isOnline = getOnlinePvpIntent()
  const onlineDoneRef = useRef(false)

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."))
    }, 500)
    return () => clearInterval(dotInterval)
  }, [])

  useEffect(() => {
    if (isOnline || !isBossWeek) return
    setOpponent({
      id: "boss-npc",
      name: t("matchmakingBossName"),
      avatar: t("matchmakingBossAvatarLetter"),
      avatarUrl: "",
      balance: 10000,
      wins: 999,
      losses: 10,
      weekWins: 999,
      weekEarnings: 9999,
      vip: true,
    })
  }, [isBossWeek, isOnline, setOpponent, t])

  useEffect(() => {
    if (isOnline) return
    const step = 100 / (searchMs / 300)
    const progressInterval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 100 : p + step * (0.5 + Math.random())))
    }, 300)
    const timer = setTimeout(() => {
      if (useFastSearch) {
        setPlayer((p) => ({ ...p, fastMatchBoosts: Math.max(0, (p.fastMatchBoosts ?? 0) - 1) }))
      }
      setScreen("arena")
    }, searchMs)
    return () => {
      clearInterval(progressInterval)
      clearTimeout(timer)
    }
  }, [isOnline, searchMs, setPlayer, setScreen, useFastSearch])

  useEffect(() => {
    if (!isOnline) return
    if (!isServerPlayerId(player.id)) {
      prepareOnlinePvp(false)
      setScreen("bet-select")
      return
    }
    let cancelled = false
    let pollIv: ReturnType<typeof setInterval> | null = null

    const otherSlot = (m: PvpMatchPublicView): PvpPublicPlayer =>
      m.p0.userId === player.id ? m.p1 : m.p0

    const goArena = (m: PvpMatchPublicView) => {
      if (onlineDoneRef.current) return
      const o = otherSlot(m)
      onlineDoneRef.current = true
      setOpponent({
        id: o.userId,
        name: o.name,
        avatar: o.avatar,
        avatarUrl: o.avatarUrl,
        balance: 500,
        wins: o.wins,
        losses: 20,
        weekWins: Math.floor(o.wins / 2),
        weekEarnings: currentBet * 3,
        vip: false,
      })
      prepareOnlinePvp(false)
      setScreen("pvp-arena")
    }

    void (async () => {
      const enq = await pvpEnqueue({
        userId: player.id,
        name: player.name,
        avatar: player.avatar,
        avatarUrl: player.avatarUrl,
        wins: player.wins,
        bet: currentBet,
        rounds: totalRounds,
      })
      if (cancelled) return
      if (!enq.ok) {
        prepareOnlinePvp(false)
        setScreen("bet-select")
        return
      }
      if (enq.status === "matched") {
        goArena(enq.match)
        return
      }
      pollIv = setInterval(async () => {
        if (cancelled) return
        const p = await pvpPoll(player.id)
        if (!p.ok || p.status !== "match") return
        goArena(p.match)
        if (pollIv) clearInterval(pollIv)
      }, ONLINE_POLL_MS)
    })()

    return () => {
      cancelled = true
      if (pollIv) clearInterval(pollIv)
      if (!onlineDoneRef.current) {
        void pvpLeave(player.id)
      }
    }
  }, [
    isOnline,
    player.id,
    player.name,
    player.avatar,
    player.avatarUrl,
    player.wins,
    currentBet,
    totalRounds,
    prepareOnlinePvp,
    setOpponent,
    setScreen,
  ])

  const handleCancel = () => {
    if (isOnline && isServerPlayerId(player.id)) {
      void pvpLeave(player.id)
      prepareOnlinePvp(false)
    }
    setScreen("menu")
  }

  const titleKey = isOnline
    ? "matchmakingSearchingLive"
    : isBossWeek
      ? "matchmakingSearchingBoss"
      : "matchmakingSearching"

  const foundKey = isOnline
    ? "matchmakingFoundLive"
    : isBossWeek
      ? "matchmakingFoundBoss"
      : "matchmakingFound"

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="flex items-center gap-2.5 bg-card/60 backdrop-blur-sm border border-accent/20 rounded-full px-5 py-2.5 mb-10">
        <Coins className="h-4 w-4 text-accent" />
        <span className="text-base font-extrabold text-accent tabular-nums">
          {formatAmount(toDisplayAmount(currentBet))}
        </span>
        <span className="text-base font-medium text-muted-foreground">{currencyLabel}</span>
      </div>
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-full border-2 border-muted/30 flex items-center justify-center">
          <div className="w-28 h-28 rounded-full border-2 border-primary border-t-transparent animate-spin absolute inset-0" />
          <Search className="h-8 w-8 text-primary" />
        </div>
        <div className="absolute -inset-4 bg-primary/6 rounded-full blur-2xl" />
      </div>
      <h2 className="text-base font-bold text-foreground mb-2">{t(titleKey, { dots })}</h2>
      {opponent && (
        <div className="flex items-center gap-3 mb-6 px-4 py-2 rounded-2xl bg-card/40 border border-border/30">
          {opponent.vip ? (
            <div className="relative inline-flex flex-shrink-0">
              <div className="vip-frame-outer w-16 h-16">
                <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                  <PlayerAvatar
                    name={opponent.name}
                    avatar={opponent.avatar}
                    avatarUrl={opponent.avatarUrl}
                    size="md"
                    variant="destructive"
                    vip={false}
                  />
                </div>
              </div>
              <VipBadgeOnFrame size="md" />
            </div>
          ) : (
            <PlayerAvatar
              name={opponent.name}
              avatar={opponent.avatar}
              avatarUrl={opponent.avatarUrl}
              size="md"
              variant="destructive"
            />
          )}
          <p className="text-base font-semibold text-foreground">{t(foundKey, { name: opponent.name })}</p>
        </div>
      )}
      {!opponent && (
        <p className="text-sm text-muted-foreground font-medium mb-6">
          {isOnline ? t("matchmakingSubLive") : t("matchmakingSub")}
        </p>
      )}
      {!isOnline && (
        <div className="w-full max-w-xs h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
      <button
        type="button"
        onClick={handleCancel}
        className="mt-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive font-medium transition-colors"
      >
        <X className="h-4 w-4" />
        {t("matchmakingCancel")}
      </button>
    </div>
  )
}
