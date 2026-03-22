"use client"

import { claimDaily, getLiveOpsState, restoreStreak } from "@/lib/liveops/client"
import { useGame } from "@/lib/game-context"
import { Gift, Flame, Coins } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { isServerPlayerId } from "@/lib/platform-user"
import { useI18n } from "@/lib/i18n/context"
import type { Translate } from "@/lib/i18n/context"

interface DailyStateDto {
  streak: number
  lastClaimedDate?: string
}

interface LiveOpsStateResponse {
  ok: boolean
  liveOpsState?: {
    daily?: DailyStateDto
  }
  liveopsSync?: {
    voicesBalance: number
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function timeLeftToNextDayMs() {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return Math.max(0, next.getTime() - now.getTime())
}

function formatCountdown(ms: number, t: Translate) {
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return t("liveopsDailyTimeHm", { h, m })
  return t("liveopsDailyTimeM", { m })
}

export function LiveOpsDailyWidget() {
  const { t } = useI18n()
  const { player, setPlayer } = useGame()
  const [state, setState] = useState<DailyStateDto>({ streak: 0 })
  const [voices, setVoices] = useState(player.vkVoicesBalance ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!isServerPlayerId(player.id)) return
    let cancelled = false
    void getLiveOpsState(player.id)
      .then((res) => {
        const data = res as LiveOpsStateResponse
        if (cancelled || !data?.ok) return
        if (data.liveOpsState?.daily) setState(data.liveOpsState.daily)
        if (typeof data.liveopsSync?.voicesBalance === "number") {
          setVoices(data.liveopsSync.voicesBalance)
          setPlayer((p) => ({ ...p, vkVoicesBalance: data.liveopsSync!.voicesBalance }))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [player.id, setPlayer])

  const canClaim = useMemo(() => state.lastClaimedDate !== todayIso(), [state.lastClaimedDate, tick])
  const waitText = useMemo(() => formatCountdown(timeLeftToNextDayMs(), t), [tick, t])

  const onClaim = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = (await claimDaily(player.id)) as {
        ok: boolean
        liveOpsState?: { daily?: DailyStateDto }
        balance?: number
        vkVoicesBalance?: number
      }
      if (!res.ok) throw new Error("claim_failed")
      if (res.liveOpsState?.daily) setState(res.liveOpsState.daily)
      if (typeof res.balance === "number") setPlayer((p) => ({ ...p, balance: res.balance! }))
      if (typeof res.vkVoicesBalance === "number") {
        setVoices(res.vkVoicesBalance)
        setPlayer((p) => ({ ...p, vkVoicesBalance: res.vkVoicesBalance }))
      }
    } catch {
      setError(t("liveopsDailyErrClaim"))
    } finally {
      setBusy(false)
    }
  }

  const onRestore = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = (await restoreStreak(player.id)) as {
        ok: boolean
        vkVoicesBalance?: number
      }
      if (!res.ok) throw new Error("restore_failed")
      if (typeof res.vkVoicesBalance === "number") {
        setVoices(res.vkVoicesBalance)
        setPlayer((p) => ({ ...p, vkVoicesBalance: res.vkVoicesBalance }))
      }
    } catch {
      setError(t("liveopsDailyErrStreak"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-lg mb-5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-amber-300" />
          <span className="text-sm text-white/95 font-semibold">{t("liveopsDailyTitle")}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/75">
          <Flame className="h-3.5 w-3.5 text-orange-300" />
          {t("liveopsDailyStreak", { n: state.streak })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/80">
          {canClaim ? t("liveopsDailyReady") : t("liveopsDailyWait", { time: waitText })}
        </p>
        <button
          type="button"
          disabled={!canClaim || busy}
          onClick={() => void onClaim()}
          className="px-4 py-2 rounded-xl bg-amber-400 text-amber-950 font-bold text-xs uppercase tracking-wide hover:bg-amber-300 disabled:opacity-60"
        >
          {t("liveopsDailyClaim")}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/65 flex items-center gap-1">
          <Coins className="h-3.5 w-3.5 text-amber-300" />
          {t("liveopsDailyVoices", { n: voices })}
        </p>
        <button
          type="button"
          disabled={busy || voices < 3}
          onClick={() => void onRestore()}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-white/20 text-white/85 hover:bg-white/10 disabled:opacity-50"
        >
          {t("liveopsDailyRestore")}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}
