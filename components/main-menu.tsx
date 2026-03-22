"use client"

import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { useEffect, useMemo, useState } from "react"
import { Trophy, Swords, User, ShoppingBag, Crown, Coins, Plus, Gift, Check, ListOrdered, Dice5, Shield } from "lucide-react"
import { VipBadgeOnFrame } from "@/components/player-avatar"
import { PlayerAvatar } from "@/components/player-avatar"
import { LEVEL_STEP_XP, MAX_LEVEL, getDailyBonusPercent, getLevelMeta } from "@/lib/level-system"
import { useI18n } from "@/lib/i18n/context"

const DAILY_REWARDS = [
  { day: 1, amount: 100, icon: "coin" as const },
  { day: 2, amount: 100, icon: "coin" as const },
  { day: 3, amount: 150, icon: "coin" as const },
  { day: 4, amount: 150, icon: "coin" as const },
  { day: 5, amount: 200, icon: "coin" as const },
  { day: 6, amount: 1, icon: "gift" as const }, // премиум сундук
  { day: 7, amount: 300, icon: "coin" as const },
]
const FIRST_LOGIN_GIFT = 100

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Оставшееся время до следующего подарка (мс). 0 если уже можно забирать. */
function msUntilNextGift(lastClaimedAt: number | undefined): number {
  if (!lastClaimedAt) return 0
  const elapsed = Date.now() - lastClaimedAt
  if (elapsed >= MS_PER_DAY) return 0
  return MS_PER_DAY - elapsed
}

import type { Translate } from "@/lib/i18n/context"

function formatTimeUntil(ms: number, t: Translate): string {
  if (ms <= 0) return ""
  const totalMinutes = Math.ceil(ms / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return t("mainMenuTimeInHours", { h: hours, m: minutes })
  return t("mainMenuTimeInMinutes", { m: minutes })
}

function formatLottoTime(ms: number, t: Translate): string {
  if (ms <= 0) return t("mainMenuLottoSoon")
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return t("mainMenuLottoCountdown", { h: hours, mm: pad(minutes), ss: pad(seconds) })
}

/**
 * Возвращает timestamp следующего розыгрыша лото.
 * Розыгрыш проходит каждую среду и пятницу в 00:00 по МСК (UTC+3),
 * то есть во вторник и четверг в 21:00 по UTC.
 */
function getNextLottoDrawTimestamp(from: number = Date.now()): number {
  const now = new Date(from)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const date = now.getUTCDate()
  const day = now.getUTCDay() // 0..6, вс = 0

  // Цели: вторник (2) 21:00 UTC и четверг (4) 21:00 UTC
  const buildTarget = (targetDay: number) => {
    const base = new Date(Date.UTC(year, month, date, 21, 0, 0, 0))
    const diffDays = (targetDay - day + 7) % 7
    base.setUTCDate(base.getUTCDate() + diffDays)
    // если получившееся время уже прошло "сейчас" — переносим ещё на неделю вперёд
    if (base.getTime() <= from) {
      base.setUTCDate(base.getUTCDate() + 7)
    }
    return base.getTime()
  }

  const nextTue = buildTarget(2)
  const nextThu = buildTarget(4)
  return Math.min(nextTue, nextThu)
}

export function MainMenu() {
  const { t, locale } = useI18n()
  const { setScreen, player, setPlayer, toDisplayAmount, currencyLabel } = useGame()
  const [now, setNow] = useState(() => Date.now())
  const [showLotto, setShowLotto] = useState(false)
  const [tempSelection, setTempSelection] = useState<number[]>([])
  const [showWelcomeGiftModal, setShowWelcomeGiftModal] = useState(false)

  const levelXp = player.levelXp ?? 0
  const levelData = getLevelMeta(levelXp, locale)
  const levelNumber = levelData.level
  const progressInLevel = levelXp >= MAX_LEVEL * LEVEL_STEP_XP ? LEVEL_STEP_XP : levelXp % LEVEL_STEP_XP
  const progressDisplay = `${Math.min(progressInLevel, LEVEL_STEP_XP)}/${LEVEL_STEP_XP}`

  const lastClaimedAt = player.lastDailyGiftClaimedAt
  const dailyIndex = typeof player.dailyRewardIndex === "number" ? player.dailyRewardIndex : 0
  const msUntil = useMemo(() => msUntilNextGift(lastClaimedAt), [lastClaimedAt, now])
  const canClaimGift = msUntil === 0
  const timeUntilText = formatTimeUntil(msUntil, t)

  // Автоматическое попадание в сезонный турнир после 10 уровня
  useEffect(() => {
    if (levelNumber >= 10 && !player.tournamentEntry) {
      setPlayer((p) => ({ ...p, tournamentEntry: true }))
    }
  }, [levelNumber, player.tournamentEntry, setPlayer])

  useEffect(() => {
    if (!canClaimGift) {
      const t = setTimeout(() => setNow(Date.now()), 60 * 1000)
      return () => clearTimeout(t)
    }
  }, [canClaimGift, now])

  useEffect(() => {
    if (!player.welcomeGiftClaimed) {
      setShowWelcomeGiftModal(true)
    }
  }, [player.welcomeGiftClaimed])

  const handleClaimDaily = () => {
    if (!canClaimGift) return
    const reward = DAILY_REWARDS[dailyIndex]
    const baseAmount = reward.icon === "coin" ? reward.amount : 0
    const dailyBonusPercent = getDailyBonusPercent(player.levelXp ?? 0)
    const amount = baseAmount > 0 ? Math.floor(baseAmount * (1 + dailyBonusPercent / 100)) : 0
    setPlayer((p) => ({
      ...p,
      balance: p.balance + amount,
      lastDailyGiftClaimedAt: Date.now(),
      dailyRewardIndex: ((p.dailyRewardIndex ?? 0) + 1) % DAILY_REWARDS.length,
    }))
  }

  // Лото: если наступил момент ближайшего розыгрыша и он ещё не проведён — провести при открытии меню.
  useEffect(() => {
    if (!player.lottoNumbers || !player.lottoDrawAt) return
    if (player.lottoDrawnNumbers && player.lottoDrawnNumbers.length > 0) return
    if (Date.now() < player.lottoDrawAt) return

    const numbers: number[] = []
    const used = new Set<number>()
    while (numbers.length < 10) {
      const n = 1 + Math.floor(Math.random() * 50)
      if (!used.has(n)) {
        used.add(n)
        numbers.push(n)
      }
    }

    setPlayer((p) => {
      if (!p.lottoNumbers || (p.lottoDrawnNumbers && p.lottoDrawnNumbers.length > 0)) return p
      const chosenSet = new Set(p.lottoNumbers)
      const matchedNumbers = numbers.filter((n) => chosenSet.has(n))
      const matchCount = matchedNumbers.length

      let bonus = 0
      if (matchCount === 10) bonus = 1000
      else if (matchCount >= 6) bonus = 500
      else if (matchCount === 5) bonus = 200
      else if (matchCount >= 3) bonus = 100
      else if (matchCount >= 1) bonus = 2

      return {
        ...p,
        lottoDrawnNumbers: numbers,
        lottoDrawnAt: Date.now(),
        lottoDrawAt: undefined,
        lottoPendingPrize: bonus,
        lottoMatchedNumbers: matchedNumbers,
      }
    })
  }, [player.lottoNumbers, player.lottoDrawAt, player.lottoDrawnNumbers, setPlayer])

  // Лото: через сутки после розыгрыша сбрасываем выпавшие числа (автосброс результатов).
  const LOTTO_RESULTS_TTL_MS = 24 * 60 * 60 * 1000
  useEffect(() => {
    if (!player.lottoDrawnNumbers?.length || player.lottoDrawnAt == null) return
    if (Date.now() - player.lottoDrawnAt < LOTTO_RESULTS_TTL_MS) return
    setPlayer((p) => ({
      ...p,
      lottoNumbers: undefined,
      lottoDrawnNumbers: undefined,
      lottoDrawnAt: undefined,
      lottoPendingPrize: undefined,
      lottoMatchedNumbers: undefined,
    }))
  }, [player.lottoDrawnNumbers, player.lottoDrawnAt, setPlayer])

  const handleToggleNumber = (n: number) => {
    setTempSelection((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n)
      if (prev.length >= 10) return prev
      return [...prev, n].sort((a, b) => a - b)
    })
  }

  const handleSaveLotto = () => {
    if (tempSelection.length !== 10) return
    const drawAt = getNextLottoDrawTimestamp()
    setPlayer((p) => ({
      ...p,
      lottoNumbers: tempSelection,
      lottoDrawAt: drawAt,
      lottoDrawnNumbers: undefined,
    }))
    setShowLotto(false)
  }


  return (
    <div className="flex flex-col items-center min-h-screen w-full py-6">
      {/* Верх: крупный логотип, уровень, прогресс-бар */}
      <div className="w-full max-w-lg flex flex-col items-center mb-5">
        <div className="flex flex-col items-center gap-3 mb-2">
          <div className="w-28 h-28 flex items-center justify-center">
            <img
              src="/logo.webp"
              alt="RPS Arena"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">
            RPS Arena
          </p>
          <p className="text-sm text-white/90 font-medium">
            {t("mainMenuYourLevel", {
              name: levelData.name,
              current: Math.min(levelData.level, MAX_LEVEL),
              max: MAX_LEVEL,
            })}
          </p>
        </div>
        <div className="w-full max-w-[200px] mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-primary transition-all duration-500"
              style={{ width: `${(progressInLevel / LEVEL_STEP_XP) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-white tabular-nums">{progressDisplay}</span>
        </div>
        <p className="mt-2 text-[11px] text-cyan-200/90 font-medium text-center">
          {levelData.perk}
        </p>
        <button
          type="button"
          onClick={() => setScreen("levels")}
          className="mt-2 px-3 py-1.5 rounded-xl border border-cyan-300/35 bg-cyan-500/10 text-cyan-100 text-xs font-semibold hover:bg-cyan-500/20"
        >
          {t("mainMenuAllLevels")}
        </button>
      </div>

      {/* Валюта: аватар слева, поле и кнопки управления (лото, пополнить) */}
      <div className="w-full max-w-lg flex items-center gap-3 mb-5">
        {player.avatarFrame === "gold" ? (
          <div className="relative inline-flex flex-shrink-0">
            <div className="gold-frame-outer h-12 w-12">
              <div className="gold-frame-inner w-full h-full">
                <PlayerAvatar
                  name={player.name}
                  avatar={player.avatar}
                  avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
                  size="sm"
                  variant="primary"
                  vip={false}
                />
              </div>
            </div>
            {player.vip && <VipBadgeOnFrame size="sm" />}
          </div>
        ) : player.vip ? (
          <div className="relative inline-flex flex-shrink-0">
            <div className="vip-frame-outer h-12 w-12">
              <div className="vip-frame-inner w-full h-full">
                <PlayerAvatar
                  name={player.name}
                  avatar={player.avatar}
                  avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
                  size="sm"
                  variant="primary"
                  vip={false}
                />
              </div>
            </div>
            <VipBadgeOnFrame size="sm" />
          </div>
        ) : (
          <div className="h-12 w-12 flex-shrink-0 rounded-full overflow-hidden border-2 border-amber-400/40 bg-amber-400/10 flex items-center justify-center">
            <PlayerAvatar
              name={player.name}
              avatar={player.avatar}
              avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
              size="sm"
              variant="primary"
              vip={false}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 h-12 flex items-center gap-3 rounded-full bg-amber-400/25 border-2 border-amber-400/70 px-4 relative">
          <div className="w-8 h-8 rounded-full bg-amber-400/40 flex items-center justify-center flex-shrink-0">
            <Coins className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-black text-amber-500 tabular-nums truncate">{formatAmount(toDisplayAmount(player.balance))}</span>
            <span className="text-base font-medium text-white/90 flex-shrink-0">{currencyLabel}</span>
          </div>
          {player.vip && (
            <span className="hidden sm:flex absolute right-3 top-0 -translate-y-1/2 sm:static sm:translate-y-0 items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/30 text-amber-600 text-[10px] font-bold uppercase flex-shrink-0 z-10">
              <Crown className="h-3 w-3" /> VIP
            </span>
          )}
        </div>
        <div className="flex flex-row gap-2 flex-shrink-0">
          <button
            onClick={() => {
              // После розыгрыша выбор уже сброшен (lottoNumbers undefined) — открываем с пустой сеткой.
              setTempSelection(player.lottoNumbers ?? [])
              setShowLotto(true)
            }}
            className="h-12 w-12 rounded-full bg-slate-900/80 border border-amber-400/60 flex items-center justify-center text-amber-400 hover:bg-slate-800 transition-colors"
            title={t("mainMenuLottoTitle")}
            aria-label={t("mainMenuLottoTitle")}
          >
            <Dice5 className="h-5 w-5" />
          </button>
          <button
            onClick={() => setScreen("shop")}
            className="h-12 w-12 rounded-full bg-amber-400/30 border-2 border-amber-400/60 flex items-center justify-center text-amber-500 hover:bg-amber-400/40 transition-colors"
            title={t("mainMenuTopUpTitle")}
            aria-label={t("mainMenuTopUpAria")}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Ежедневные награды */}
      <div className="w-full max-w-lg mb-5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-sm text-white/95 font-medium leading-tight">{t("mainMenuSubtitle")}</p>
          {canClaimGift ? (
            <button
              onClick={handleClaimDaily}
              className="px-4 py-2 rounded-xl bg-amber-400 text-amber-950 font-bold text-xs uppercase tracking-wide hover:bg-amber-300 transition-colors flex-shrink-0"
            >
              {t("mainMenuDailyClaim")}
            </button>
          ) : (
            <span className="text-xs text-white/80 font-medium flex-shrink-0">
              {timeUntilText}
            </span>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto py-1">
          {DAILY_REWARDS.map((r, i) => {
            const claimed = i < dailyIndex
            const isCurrent = i === dailyIndex
            const isAvailable = isCurrent && canClaimGift
            return (
              <div
                key={r.day}
                className={`flex flex-col items-center min-w-[64px] px-2 py-1.5 rounded-xl border text-center ${
                  claimed
                    ? "bg-emerald-500/20 border-emerald-400/40"
                    : isAvailable
                    ? "bg-amber-400/20 border-amber-400/50"
                    : "bg-white/5 border-white/15"
                }`}
              >
                {claimed ? (
                  <Check className="h-4 w-4 text-emerald-400 mb-0.5" />
                ) : r.icon === "gift" ? (
                  <Gift className="h-4 w-4 text-emerald-400 mb-0.5" />
                ) : (
                  <Coins className="h-4 w-4 text-amber-400 mb-0.5" />
                )}
                <span className="text-[10px] font-bold text-white/90">{t("mainMenuDayN", { n: r.day })}</span>
                {!claimed && (
                  <span className="text-[10px] text-white/70">
                    {r.icon === "gift" ? t("mainMenuChest") : r.amount}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Кнопки: ИГРАТЬ, Таблица лидеров, Магазин и Профиль */}
      <div className="w-full max-w-lg flex flex-col gap-3">
        <button
          onClick={() => setScreen("bet-select")}
          className="w-full flex items-center justify-center gap-3 bg-sky-500 hover:bg-sky-600 text-white font-black text-lg py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-sky-500/30"
        >
          <Swords className="h-6 w-6" />
          <span>{t("mainMenuPlay")}</span>
        </button>

        <button
          onClick={() => setScreen("leaderboard")}
          className="w-full flex items-center justify-center gap-2.5 bg-slate-600/80 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-[0.98] border border-slate-500/50"
        >
          <Trophy className="h-5 w-5 text-amber-400" />
          <span>{t("mainMenuLeaderboard")}</span>
        </button>

        {/* Ставки игроков — только на мобильной версии (на десктопе есть сайдбар) */}
        <button
          onClick={() => setScreen("bets")}
          className="lg:hidden w-full flex items-center justify-center gap-2.5 bg-slate-600/80 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-[0.98] border border-slate-500/50"
        >
          <ListOrdered className="h-5 w-5 text-primary" />
          <span>{t("mainMenuPlayerBets")}</span>
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => setScreen("shop")}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-600/80 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-[0.98] border border-slate-500/50"
          >
            <ShoppingBag className="h-5 w-5 text-orange-400" />
            <span>{t("mainMenuShop")}</span>
          </button>
          <button
            onClick={() => setScreen("profile")}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-600/80 hover:bg-slate-600 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-[0.98] border border-slate-500/50"
          >
            <User className="h-5 w-5 text-amber-400" />
            <span>{t("mainMenuProfileNav")}</span>
          </button>
        </div>
      </div>

      {/* VIP блок снизу */}
      {!player.vip && (
        <div className="mt-6 w-full max-w-lg">
          <button
            onClick={() => setScreen("shop")}
            className="w-full flex items-center justify-center gap-2 bg-amber-400/25 border-2 border-amber-400/50 text-amber-400 font-semibold text-sm py-3.5 rounded-2xl transition-all hover:bg-amber-400/35"
          >
            <Crown className="h-5 w-5" />
            <span>{t("mainMenuVipCta")}</span>
          </button>
        </div>
      )}

      {process.env.NEXT_PUBLIC_SHOW_ADMIN === "1" && (
        <div className="mt-4 w-full max-w-lg">
          <button
            type="button"
            onClick={() => setScreen("admin")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-900/80 border border-emerald-500/60 text-xs text-emerald-300 hover:bg-slate-900"
          >
            <Shield className="h-4 w-4" />
            {t("mainMenuAdminDev")}
          </button>
        </div>
      )}

      {/* Модальное окно лото */}
      {showLotto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900/95 border border-slate-700 shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wide">{t("mainMenuLottoModalTitle")}</h2>
                <p className="text-xs text-white/70 mt-0.5">{t("mainMenuLottoPick")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLotto(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                {t("commonClose")}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-2xl bg-slate-900/70 border border-slate-700 p-3">
              <div className="grid grid-cols-5 gap-2 text-xs">
                {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => {
                  const selected = tempSelection.includes(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleToggleNumber(n)}
                      className={`h-8 rounded-full border text-center font-semibold ${
                        selected
                          ? "bg-amber-400 text-amber-950 border-amber-400"
                          : "bg-slate-800 text-white/80 border-slate-600 hover:bg-slate-700"
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-white/70">
              <span>{t("mainMenuLottoSelected", { current: tempSelection.length })}</span>
              {player.lottoDrawAt && (
                <span>
                  {t("mainMenuLottoDrawIn")}{" "}
                  {formatLottoTime(Math.max(0, player.lottoDrawAt - Date.now()), t)}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={tempSelection.length !== 10}
              onClick={handleSaveLotto}
              className={`w-full py-3 rounded-2xl text-sm font-bold uppercase tracking-wide ${
                tempSelection.length === 10
                  ? "bg-sky-500 hover:bg-sky-600 text-white"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
            >
              {t("mainMenuLottoSave")}
            </button>

            {player.lottoDrawnNumbers && player.lottoDrawnNumbers.length > 0 && (
              <div className="mt-2 rounded-2xl bg-slate-900/70 border border-slate-700 p-3">
                <p className="text-xs font-semibold text-white/80 mb-2">{t("mainMenuLottoDrawnTitle")}</p>
                <div className="flex flex-wrap gap-1">
                  {player.lottoDrawnNumbers
                    .slice()
                    .sort((a, b) => a - b)
                    .map((n) => (
                      // Подсветка совпадений: эти числа были и в билете игрока, и в розыгрыше.
                      // Так сразу видно, где именно сработал выигрыш.
                      <span
                        key={n}
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          player.lottoMatchedNumbers?.includes(n)
                            ? "bg-emerald-500 text-emerald-950 ring-1 ring-emerald-300"
                            : "bg-slate-800 text-white"
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                </div>
                {!!player.lottoMatchedNumbers?.length && (
                  <p className="mt-2 text-xs text-emerald-300">
                    {t("mainMenuLottoMatches", {
                      numbers: player.lottoMatchedNumbers.slice().sort((a, b) => a - b).join(", "),
                    })}
                  </p>
                )}
                {(player.lottoPendingPrize ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const prize = player.lottoPendingPrize ?? 0
                      if (prize <= 0) return
                      setPlayer((p) => ({
                        ...p,
                        balance: p.balance + prize,
                        ratingPoints: Math.min(1000, (p.ratingPoints ?? 0) + prize),
                        lottoPendingPrize: undefined,
                      }))
                    }}
                    className="mt-3 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold"
                  >
                    {t("mainMenuLottoClaim", {
                      amount: formatAmount(player.lottoPendingPrize ?? 0),
                      currency: currencyLabel,
                    })}
                  </button>
                )}
                {(player.lottoPendingPrize ?? 0) === 0 && (
                  <p className="mt-2 text-xs text-white/60">{t("mainMenuLottoNoPrize")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showWelcomeGiftModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900/95 border border-amber-400/40 shadow-2xl p-5">
            <h2 className="text-lg font-black text-amber-300 mb-2">{t("mainMenuWelcomeTitle")}</h2>
            <p className="text-sm text-white/85 leading-relaxed">
              {t("mainMenuWelcomeBody", { amount: FIRST_LOGIN_GIFT })}
            </p>
            <p className="mt-2 text-xs text-white/60">{t("mainMenuWelcomeRate")}</p>
            <button
              type="button"
              onClick={() => {
                setPlayer((p) => ({
                  ...p,
                  balance: p.balance + FIRST_LOGIN_GIFT,
                  welcomeGiftClaimed: true,
                }))
                setShowWelcomeGiftModal(false)
              }}
              className="mt-4 w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold"
            >
              {t("mainMenuWelcomeClaim")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
