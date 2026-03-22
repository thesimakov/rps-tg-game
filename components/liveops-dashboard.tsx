"use client"

import { useEffect, useMemo, useState } from "react"
import { useGame } from "@/lib/game-context"
import {
  claimAchievementReward,
  claimPassLevel,
  claimQuestReward,
  getLiveOpsState,
  unlockPremiumPass,
} from "@/lib/liveops/client"
import { Check, Info, Lock, Sparkles, Swords, Trophy } from "lucide-react"
import { isServerPlayerId } from "@/lib/platform-user"
import { useI18n } from "@/lib/i18n/context"
import { resolveWeeklyEventUi } from "@/lib/i18n/weekly-event-ui"

interface RewardDto {
  kind: string
  amount?: number
  skinId?: string
  titleId?: string
}

interface QuestDto {
  id: string
  title: string
  reset: "daily" | "weekly" | "monthly"
  points: number
  condition: { target: number }
}

interface AchievementDto {
  id: string
  title: string
  condition: { target: number }
}

interface PassLevelDto {
  level: number
  freeRewards: RewardDto[]
  premiumRewards: RewardDto[]
}

interface LiveOpsStateDto {
  quests: Array<{ questId: string; value: number; claimedAt?: number }>
  achievements: Array<{ achievementId: string; value: number; claimedAt?: number }>
  pass: {
    level: number
    points: number
    premiumUnlocked: boolean
    claimedFreeLevels: number[]
    claimedPremiumLevels: number[]
  }
}

interface StateResponse {
  ok: boolean
  config?: {
    quests: QuestDto[]
    achievements: AchievementDto[]
    pass: { maxLevel: number; pointsPerLevel: number; levels: PassLevelDto[] }
  }
  weeklyEvent?: { title: string; description: string; mode: string }
  liveOpsState?: LiveOpsStateDto
  liveopsSync?: { voicesBalance: number }
  error?: string
}

type ApiErrorPayload = { ok?: boolean; error?: string }

function toErrorCode(error: unknown): string {
  if (!error) return "unknown_error"
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object" && "error" in (error as Record<string, unknown>)) {
    const value = (error as ApiErrorPayload).error
    if (typeof value === "string") return value
  }
  return "unknown_error"
}

export function LiveOpsDashboard() {
  const { t } = useI18n()
  const { player, setPlayer, setScreen } = useGame()

  const rewardText = (r: RewardDto) => {
    if (r.kind === "coins") return t("liveopsRewardCoins", { amount: r.amount ?? 0 })
    if (r.kind === "voices") return t("liveopsRewardVoices", { amount: r.amount ?? 0 })
    if (r.kind === "event_tokens") return t("liveopsRewardTokens", { amount: r.amount ?? 0 })
    if (r.kind === "xp") return t("liveopsRewardXp", { amount: r.amount ?? 0 })
    if (r.kind === "boost_double_win") return t("liveopsRewardBoost", { amount: r.amount ?? 0 })
    if (r.kind === "skin") return t("liveopsRewardSkin", { id: r.skinId ?? t("liveopsUnknown") })
    if (r.kind === "title") return t("liveopsRewardTitle", { id: r.titleId ?? t("liveopsUnknown") })
    return r.kind
  }

  const resetLabel = (reset: "daily" | "weekly" | "monthly") => {
    if (reset === "daily") return t("liveopsResetDaily")
    if (reset === "weekly") return t("liveopsResetWeekly")
    return t("liveopsResetMonthly")
  }

  const toFriendlyErrorMessage = (error: unknown): string => {
    const code = toErrorCode(error)
    if (code.includes("insufficient_voices")) return t("liveopsErrVoices")
    if (code.includes("pass_premium_already")) return t("liveopsErrPassOpen")
    if (code.includes("player_not_found")) return t("liveopsErrNoPlayer")
    if (code.includes("invalid_user")) return t("liveopsErrInvalidUser")
    if (code.includes("no_server")) return t("liveopsErrNoServer")
    return t("liveopsErrGeneric")
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StateResponse | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [showPassInfo, setShowPassInfo] = useState(false)

  const weeklyEventLines = useMemo(() => {
    const ev = data?.weeklyEvent
    if (!ev) return { title: t("liveopsNoEvent"), description: "" }
    return resolveWeeklyEventUi(ev.mode, ev.title, ev.description, t)
  }, [data?.weeklyEvent, t])

  const reload = async () => {
    if (!isServerPlayerId(player.id)) return
    setLoading(true)
    setError(null)
    try {
      const res = (await getLiveOpsState(player.id)) as StateResponse
      if (!res.ok) throw new Error("load_failed")
      setData(res)
      setPlayer((p) => ({
        ...p,
        liveOpsState: res.liveOpsState ? (res.liveOpsState as unknown as typeof p.liveOpsState) : p.liveOpsState,
        vkVoicesBalance:
          typeof res.liveopsSync?.voicesBalance === "number"
            ? res.liveopsSync.voicesBalance
            : (p.vkVoicesBalance ?? 0),
      }))
    } catch {
      setError(t("liveopsLoadError"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [player.id])

  const questProgressMap = useMemo(() => {
    const m = new Map<string, { value: number; claimedAt?: number }>()
    for (const q of data?.liveOpsState?.quests ?? []) m.set(q.questId, q)
    return m
  }, [data?.liveOpsState?.quests])

  const achProgressMap = useMemo(() => {
    const m = new Map<string, { value: number; claimedAt?: number }>()
    for (const a of data?.liveOpsState?.achievements ?? []) m.set(a.achievementId, a)
    return m
  }, [data?.liveOpsState?.achievements])

  if (!isServerPlayerId(player.id)) return null

  const pass = data?.liveOpsState?.pass
  const maxLevel = data?.config?.pass.maxLevel ?? 30
  const premiumCostVoices = 15
  const voicesBalance = player.vkVoicesBalance ?? 0
  const hasInsufficientVoices = voicesBalance < premiumCostVoices
  const bigCardBase =
    "rounded-3xl border p-5 md:p-6 backdrop-blur-sm shadow-[0_0_0_1px_rgba(148,163,184,0.14),0_0_26px_rgba(15,23,42,0.20)]"

  const onClaimQuest = async (questId: string) => {
    setBusyKey(`q:${questId}`)
    try {
      await claimQuestReward(player.id, questId)
      await reload()
    } catch (e) {
      setError(toFriendlyErrorMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  const onClaimAchievement = async (id: string) => {
    setBusyKey(`a:${id}`)
    try {
      const res = (await claimAchievementReward(player.id, id, true)) as {
        achievement?: { rewards?: RewardDto[] }
        activeTitleId?: string
      }
      if (res.activeTitleId) {
        setPlayer((p) => ({ ...p, activeTitleId: res.activeTitleId }))
      } else {
        const title = res.achievement?.rewards?.find((r) => r.kind === "title" && r.titleId)?.titleId
        if (title) setPlayer((p) => ({ ...p, activeTitleId: title }))
      }
      await reload()
    } catch (e) {
      setError(toFriendlyErrorMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  const onUnlockPremium = async () => {
    setBusyKey("pass:unlock")
    try {
      await unlockPremiumPass(player.id)
      await reload()
    } catch (e) {
      setError(toFriendlyErrorMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  const onClaimPass = async (level: number, premium: boolean) => {
    setBusyKey(`p:${level}:${premium ? 1 : 0}`)
    try {
      await claimPassLevel(player.id, level, premium)
      await reload()
    } catch (e) {
      setError(toFriendlyErrorMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="w-full max-w-lg space-y-4 mb-4">
      <div
        className={`${bigCardBase} border-sky-300/30 bg-gradient-to-br from-sky-500/14 via-card/55 to-indigo-500/10`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-sky-300" />
            <p className="text-base md:text-lg font-extrabold text-foreground">{t("liveopsWeeklyEvent")}</p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            className="text-xs px-3 py-1.5 rounded-xl border border-border/50 text-muted-foreground"
          >
            {t("commonRefresh")}
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground mt-3">{t("commonLoading")}</p>
        ) : (
          <>
            <p className="text-base text-foreground mt-3 font-medium">{weeklyEventLines.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{weeklyEventLines.description}</p>
            {data?.weeklyEvent?.mode === "boss_week" && (
              <button
                type="button"
                onClick={() => {
                  setPlayer((p) => ({ ...p, activeWeeklyMode: "boss_week" }))
                  setScreen("bet-select")
                }}
                className="mt-4 px-4 py-2.5 rounded-2xl bg-red-500/20 border border-red-400/50 text-red-200 text-sm font-semibold"
              >
                {t("liveopsEnterBoss")}
              </button>
            )}
          </>
        )}
      </div>

      <div
        className={`${bigCardBase} ${
          hasInsufficientVoices && !pass?.premiumUnlocked
            ? "border-red-400/50 bg-gradient-to-br from-red-500/16 via-card/55 to-rose-500/10 shadow-[0_0_0_1px_rgba(248,113,113,0.28),0_0_32px_rgba(248,113,113,0.16)]"
            : "border-amber-300/35 bg-gradient-to-br from-amber-500/16 via-card/55 to-orange-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.26),0_0_30px_rgba(251,191,36,0.14)]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-base md:text-lg font-extrabold text-foreground">{t("liveopsBattlePass")}</p>
            <button
              type="button"
              onClick={() => setShowPassInfo((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-300/45 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-500/20"
            >
              <Info className="h-3.5 w-3.5" />
              {t("liveopsInfo")}
            </button>
          </div>
          <span className="text-xs md:text-sm text-muted-foreground">
            {t("liveopsPassLevel", { current: pass?.level ?? 0, max: maxLevel })}
          </span>
        </div>
        {showPassInfo && (
          <div className="mt-3 rounded-2xl border border-amber-300/35 bg-black/20 p-3.5">
            <p className="text-sm font-semibold text-amber-100">{t("liveopsPassHowTitle")}</p>
            <ul className="mt-2 space-y-1 text-xs text-amber-50/90">
              <li>• {t("liveopsPassHow1")}</li>
              <li>• {t("liveopsPassHow2")}</li>
              <li>• {t("liveopsPassHow3")}</li>
              <li>• {t("liveopsPassHow4")}</li>
            </ul>
          </div>
        )}
        <div className="mt-3 h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
            style={{ width: `${Math.min(100, ((pass?.level ?? 0) / maxLevel) * 100)}%` }}
          />
        </div>
        {!pass?.premiumUnlocked && (
          <button
            type="button"
            disabled={busyKey === "pass:unlock" || hasInsufficientVoices}
            onClick={() => void onUnlockPremium()}
            className={`mt-4 w-full px-4 py-3 rounded-2xl text-sm md:text-base font-bold transition-colors disabled:opacity-60 ${
              hasInsufficientVoices
                ? "bg-red-500/20 border border-red-400/70 text-red-200"
                : "bg-amber-500/20 border border-amber-400/60 text-amber-100"
            }`}
          >
            {t("liveopsOpenPremium", { n: premiumCostVoices })}
          </button>
        )}
        {!pass?.premiumUnlocked && (
          <p
            className={`mt-2 text-xs md:text-sm font-medium ${
              hasInsufficientVoices ? "text-red-200" : "text-muted-foreground"
            }`}
          >
            {t("liveopsVoicesNeed", { have: voicesBalance, need: premiumCostVoices })}
          </p>
        )}
        <div className="mt-3 space-y-2.5 max-h-52 overflow-auto pr-1">
          {(data?.config?.pass.levels ?? []).slice(0, 10).map((lvl) => {
            const freeClaimed = pass?.claimedFreeLevels.includes(lvl.level) ?? false
            const premClaimed = pass?.claimedPremiumLevels.includes(lvl.level) ?? false
            const unlocked = (pass?.level ?? 0) >= lvl.level
            return (
              <div
                key={lvl.level}
                className="rounded-2xl border border-border/30 p-3 bg-gradient-to-br from-white/[0.04] via-card/35 to-white/[0.02]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-semibold">{t("liveopsLevelN", { n: lvl.level })}</span>
                  {!unlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{rewardText(lvl.freeRewards[0])}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={!unlocked || freeClaimed || busyKey === `p:${lvl.level}:0`}
                    onClick={() => void onClaimPass(lvl.level, false)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-400/40 text-emerald-300 disabled:opacity-50"
                  >
                    {freeClaimed ? t("liveopsClaimed") : t("liveopsClaimFree")}
                  </button>
                  <button
                    type="button"
                    disabled={!unlocked || !pass?.premiumUnlocked || premClaimed || busyKey === `p:${lvl.level}:1`}
                    onClick={() => void onClaimPass(lvl.level, true)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-400/40 text-amber-300 disabled:opacity-50"
                  >
                    {premClaimed ? t("liveopsClaimed") : t("liveopsClaimPremium")}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className={`${bigCardBase} border-cyan-300/30 bg-gradient-to-br from-cyan-500/16 via-card/55 to-blue-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.20),0_0_28px_rgba(56,189,248,0.12)]`}
      >
        <p className="text-base md:text-lg font-extrabold text-foreground">{t("liveopsQuests")}</p>
        <div className="mt-3 space-y-3 max-h-60 overflow-auto pr-1">
          {(data?.config?.quests ?? []).map((q) => {
            const progress = questProgressMap.get(q.id)
            const value = progress?.value ?? 0
            const done = value >= q.condition.target
            const claimed = !!progress?.claimedAt
            return (
              <div
                key={q.id}
                className="rounded-2xl border border-border/30 p-3.5 bg-gradient-to-br from-white/[0.04] via-card/35 to-white/[0.02]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{q.title}</span>
                  <span className="text-[11px] text-muted-foreground uppercase">{resetLabel(q.reset)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {t("liveopsQuestProgress", {
                    value,
                    target: q.condition.target,
                    points: q.points,
                  })}
                </p>
                <button
                  type="button"
                  disabled={!done || claimed || busyKey === `q:${q.id}`}
                  onClick={() => void onClaimQuest(q.id)}
                  className="mt-3 text-xs px-3 py-2 rounded-xl border border-sky-400/40 text-sky-300 font-semibold disabled:opacity-50"
                >
                  {claimed ? t("liveopsClaimed") : done ? t("commonClaim") : t("liveopsNotDone")}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className={`${bigCardBase} border-amber-300/30 bg-gradient-to-br from-amber-500/16 via-card/55 to-yellow-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.20),0_0_28px_rgba(251,191,36,0.12)]`}
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" />
          <p className="text-base md:text-lg font-extrabold text-foreground">{t("liveopsAchievements")}</p>
        </div>
        <div className="mt-3 space-y-3 max-h-52 overflow-auto pr-1">
          {(data?.config?.achievements ?? []).map((a) => {
            const progress = achProgressMap.get(a.id)
            const value = progress?.value ?? 0
            const done = value >= a.condition.target
            const claimed = !!progress?.claimedAt
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-border/30 p-3.5 bg-gradient-to-br from-white/[0.04] via-card/35 to-white/[0.02]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{a.title}</span>
                  {claimed && <Check className="h-4 w-4 text-emerald-300" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {value}/{a.condition.target}
                </p>
                <button
                  type="button"
                  disabled={!done || claimed || busyKey === `a:${a.id}`}
                  onClick={() => void onClaimAchievement(a.id)}
                  className="mt-3 text-xs px-3 py-2 rounded-xl border border-amber-400/40 text-amber-300 font-semibold disabled:opacity-50"
                >
                  {claimed ? t("liveopsClaimed") : t("liveopsClaimTitle")}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {player.activeTitleId && (
        <div className="rounded-3xl border border-purple-400/30 bg-gradient-to-br from-purple-500/16 via-card/55 to-violet-500/10 p-4 flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-purple-300" />
          <span className="text-sm text-purple-100">{t("liveopsActiveTitle", { id: player.activeTitleId })}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
