"use client"

import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { ArrowLeft, Coins, Crown, Trophy, Skull, Percent, Calendar, Medal, Pencil, Check, UserMinus, LogOut, Users, Wallet, Send } from "lucide-react"
import { useState } from "react"
import { PlayerAvatar, VipBadgeOnFrame } from "@/components/player-avatar"
import { LiveOpsDashboard } from "@/components/liveops-dashboard"
import { requestWithdraw } from "@/lib/platform-bridge"
import { useI18n } from "@/lib/i18n/context"
import { BOSS_REWARD_LABEL_KEY } from "@/lib/i18n/boss-reward-keys"

const HIDE_AVATAR_PRICE = 100
const BLOCK_BASE =
  "w-full max-w-lg rounded-3xl border backdrop-blur-sm p-5 md:p-6 shadow-[0_0_0_1px_rgba(148,163,184,0.14),0_0_26px_rgba(15,23,42,0.20)]"
const BLOCK_ECONOMY_CLASS =
  `${BLOCK_BASE} border-emerald-300/30 bg-gradient-to-br from-emerald-500/14 via-card/55 to-cyan-500/10`
const BLOCK_PROFILE_CLASS =
  `${BLOCK_BASE} border-violet-300/30 bg-gradient-to-br from-violet-500/14 via-card/55 to-indigo-500/10`
const BLOCK_SOCIAL_CLASS =
  `${BLOCK_BASE} border-blue-300/30 bg-gradient-to-br from-blue-500/14 via-card/55 to-sky-500/10`

export function ProfileScreen() {
  const { t } = useI18n()
  const { setScreen, player, setPlayer, playerRank, logout, trackSpend, toDisplayAmount, currencyLabel } = useGame()
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(player.name)
  const [withdrawWallet, setWithdrawWallet] = useState(player.tonWalletAddress ?? "")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawMessage, setWithdrawMessage] = useState("")

  const totalGames = player.wins + player.losses
  const winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0
  const chestHistory = player.bossChestHistory ?? []

  const saveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed) {
      setPlayer((p) => ({
        ...p,
        name: trimmed,
        avatar: trimmed.charAt(0).toUpperCase() || p.avatar,
      }))
    } else {
      setNameInput(player.name)
    }
    setIsEditingName(false)
  }

  const submitWithdraw = async () => {
    const amount = Math.floor(Number(withdrawAmount))
    if (!Number.isFinite(amount) || amount < 10) {
      setWithdrawMessage(t("profileWithdrawMin"))
      return
    }
    if (amount > player.balance) {
      setWithdrawMessage(t("profileWithdrawBalance"))
      return
    }
    if (!withdrawWallet.trim()) {
      setWithdrawMessage(t("profileWithdrawWalletFormat"))
      return
    }
    setWithdrawBusy(true)
    setWithdrawMessage("")
    try {
      const res = await requestWithdraw(amount, withdrawWallet.trim())
      if (!res.ok) {
        const msg =
          res.error === "invalid_wallet"
            ? t("profileWithdrawInvalid")
            : res.error === "daily_limit"
              ? t("profileWithdrawLimit")
              : t("profileWithdrawFail")
        setWithdrawMessage(msg)
        return
      }
      setPlayer((p) => ({
        ...p,
        balance: typeof res.balance === "number" ? res.balance : p.balance - amount,
        tonWalletAddress: withdrawWallet.trim(),
      }))
      setWithdrawAmount("")
      setWithdrawMessage(t("profileWithdrawOk"))
    } finally {
      setWithdrawBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 pb-24">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center mb-6">
        <button
          onClick={() => setScreen("menu")}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-foreground"
          aria-label={t("commonBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground uppercase tracking-wider">
          {t("profileTitle")}
        </h1>
        <div className="w-9" />
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="relative">
          {player.avatarFrame === "gold" ? (
            <div className="relative inline-flex flex-shrink-0">
              <div className="gold-frame-outer w-[5.5rem] h-[5.5rem]">
                <div className="gold-frame-inner w-full h-full flex items-center justify-center">
                  <PlayerAvatar
                    name={player.name}
                    avatar={player.avatar}
                    avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
                    size="lg"
                    variant="accent"
                    vip={false}
                  />
                </div>
              </div>
              {player.vip && <VipBadgeOnFrame size="lg" />}
            </div>
          ) : player.vip ? (
            <div className="relative inline-flex flex-shrink-0">
              <div className="vip-frame-outer w-[5.5rem] h-[5.5rem]">
                <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                  <PlayerAvatar
                    name={player.name}
                    avatar={player.avatar}
                    avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
                    size="lg"
                    variant="accent"
                    vip={false}
                  />
                </div>
              </div>
              <VipBadgeOnFrame size="lg" />
            </div>
          ) : (
            <PlayerAvatar
              name={player.name}
              avatar={player.avatar}
              avatarUrl={player.hideVkAvatar ? undefined : player.avatarUrl}
              size="lg"
              variant="primary"
              vip={false}
            />
          )}
        </div>
        <div className="text-center flex flex-col items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="bg-card/80 border border-border rounded-xl px-3 py-2 text-lg font-bold text-foreground max-w-[200px]"
                maxLength={30}
                autoFocus
              />
              <button
                onClick={saveName}
                className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                aria-label={t("commonSave")}
              >
                <Check className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-foreground">{player.name}</h2>
              <button
                onClick={() => {
                  setNameInput(player.name)
                  setIsEditingName(true)
                }}
                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                aria-label={t("profileEditName")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground font-medium">
            {player.vip ? t("profileVipPlayer") : t("profilePlayer")}
          </p>
        </div>
      {/* Скрыть внешний аватар за 100 монет */}
        {player.avatarUrl && (
          <div className="mt-2 w-full max-w-lg">
            {player.hideVkAvatar ? (
              <p className="text-center text-sm text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                <UserMinus className="h-4 w-4" />
                {t("profileAvatarHidden")}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (player.balance >= HIDE_AVATAR_PRICE) {
                    trackSpend(HIDE_AVATAR_PRICE, "hide-avatar")
                    setPlayer((p) => ({ ...p, balance: p.balance - HIDE_AVATAR_PRICE, hideVkAvatar: true }))
                  }
                }}
                disabled={player.balance < HIDE_AVATAR_PRICE}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                <UserMinus className="h-4 w-4" />
                {t("profileHideAvatar", { price: HIDE_AVATAR_PRICE })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Balance + Bonuses + Rank */}
      <div className="w-full max-w-lg grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gradient-to-br from-emerald-500/16 via-card/60 to-cyan-500/12 backdrop-blur-sm border border-emerald-300/30 rounded-3xl px-3.5 py-4 md:py-4.5 flex flex-col items-center justify-between min-h-[108px] shadow-[0_0_0_1px_rgba(16,185,129,0.14)]">
          <Coins className="h-5 w-5 text-accent mb-1.5" />
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
            {t("profileBalance")}
          </span>
          <span className="mt-1.5 text-lg md:text-xl font-extrabold text-accent tabular-nums">
            {formatAmount(toDisplayAmount(player.balance))} {currencyLabel}
          </span>
        </div>
        <div className="bg-gradient-to-br from-amber-500/16 via-card/60 to-orange-500/12 backdrop-blur-sm border border-amber-400/40 rounded-3xl px-3.5 py-4 md:py-4.5 flex flex-col items-center justify-between min-h-[108px] shadow-[0_0_0_1px_rgba(251,191,36,0.14)]">
          <Coins className="h-5 w-5 text-amber-300 mb-1.5" />
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
            {t("profileBonuses")}
          </span>
          <span className="mt-1.5 text-lg md:text-xl font-extrabold text-amber-200 tabular-nums">
            {formatAmount(player.ratingPoints ?? 0)}
          </span>
        </div>
        <div className="bg-gradient-to-br from-indigo-500/16 via-card/60 to-purple-500/12 backdrop-blur-sm border border-primary/25 rounded-3xl px-3.5 py-4 md:py-4.5 flex flex-col items-center justify-between min-h-[108px] shadow-[0_0_0_1px_rgba(129,140,248,0.14)]">
          <Medal className="h-5 w-5 text-primary mb-1.5" />
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
            {t("profileRating")}
          </span>
          <span className="mt-1.5 text-lg md:text-xl font-extrabold text-primary tabular-nums">
            #{playerRank}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-cyan-500/12 via-card/55 to-sky-500/10 backdrop-blur-sm border border-cyan-300/25 rounded-3xl p-5 flex flex-col items-center gap-1.5 min-h-[126px] shadow-[0_0_0_1px_rgba(34,211,238,0.10)]">
          <Trophy className="h-5 w-5 text-primary mb-1" />
          <span className="text-lg font-extrabold text-foreground tabular-nums">{player.wins}</span>
          <span className="text-sm text-muted-foreground font-medium">{t("profileWins")}</span>
        </div>
        <div className="bg-gradient-to-br from-rose-500/12 via-card/55 to-red-500/10 backdrop-blur-sm border border-rose-300/25 rounded-3xl p-5 flex flex-col items-center gap-1.5 min-h-[126px] shadow-[0_0_0_1px_rgba(251,113,133,0.10)]">
          <Skull className="h-5 w-5 text-destructive mb-1" />
          <span className="text-lg font-extrabold text-foreground tabular-nums">{player.losses}</span>
          <span className="text-sm text-muted-foreground font-medium">{t("profileLosses")}</span>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/12 via-card/55 to-lime-500/10 backdrop-blur-sm border border-emerald-300/25 rounded-3xl p-5 flex flex-col items-center gap-1.5 min-h-[126px] shadow-[0_0_0_1px_rgba(52,211,153,0.10)]">
          <Percent className="h-5 w-5 text-accent mb-1" />
          <span className="text-lg font-extrabold text-foreground tabular-nums">{winRate}%</span>
          <span className="text-sm text-muted-foreground font-medium">{t("profileWinrate")}</span>
        </div>
        <div className="bg-gradient-to-br from-violet-500/12 via-card/55 to-fuchsia-500/10 backdrop-blur-sm border border-violet-300/25 rounded-3xl p-5 flex flex-col items-center gap-1.5 min-h-[126px] shadow-[0_0_0_1px_rgba(167,139,250,0.10)]">
          <Calendar className="h-5 w-5 text-secondary mb-1" />
          <span className="text-lg font-extrabold text-foreground tabular-nums">{player.weekWins}</span>
          <span className="text-sm text-muted-foreground font-medium">{t("profileWeekShort")}</span>
        </div>
      </div>

      {/* Weekly amount */}
      <div className={`${BLOCK_ECONOMY_CLASS} mb-4`}>
        <div className="flex items-center justify-between">
          <span className="text-base md:text-lg text-muted-foreground font-semibold">{t("profileWeekSection")}</span>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-accent" />
            <span className="text-lg md:text-xl font-extrabold text-primary tabular-nums">
              {formatAmount(toDisplayAmount(player.weekEarnings))}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-lg mb-4 rounded-2xl border border-border/30 bg-card/35 px-4 py-3 backdrop-blur-sm">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">{t("profileLegendTitle")}</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-xs text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {t("profileLegendEconomy")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-500/12 px-2.5 py-1 text-xs text-cyan-100">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            {t("profileLegendLiveops")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/35 bg-blue-500/12 px-2.5 py-1 text-xs text-blue-100">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
            {t("profileLegendSocial")}
          </span>
        </div>
      </div>

      {/* LiveOps: квесты / pass / достижения / событие недели */}
      <LiveOpsDashboard />

      {/* История лута босса */}
      <div className="w-full max-w-lg rounded-3xl p-5 md:p-6 mb-4 border border-red-300/30 bg-gradient-to-br from-red-500/15 via-card/55 to-rose-500/10 backdrop-blur-sm shadow-[0_0_0_1px_rgba(248,113,113,0.16),0_0_24px_rgba(248,113,113,0.12)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base md:text-lg font-extrabold text-foreground">{t("profileBossHistory")}</span>
          <span className="text-xs text-muted-foreground">{t("profileBossLast10")}</span>
        </div>
        {chestHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profileBossEmpty")}</p>
        ) : (
          <div className="space-y-3 max-h-60 overflow-auto pr-1">
            {chestHistory.map((item, idx) => {
              const rarityClass =
                item.rarity === "legendary"
                  ? "bg-amber-500/20 text-amber-200 border-amber-400/50"
                  : item.rarity === "epic"
                  ? "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50"
                  : "bg-sky-500/20 text-sky-200 border-sky-400/50"
              const rarityLabel =
                item.rarity === "legendary"
                  ? t("bossRarityLegendary")
                  : item.rarity === "epic"
                    ? t("bossRarityEpic")
                    : t("bossRarityRare")
              const labelKey = BOSS_REWARD_LABEL_KEY[item.rewardId]
              const rewardTitle = labelKey ? t(labelKey) : item.rewardLabel
              return (
                <div key={`${item.rewardId}-${item.openedAt}-${idx}`} className="rounded-2xl border border-border/30 p-3.5 bg-card/35">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground font-semibold truncate">{rewardTitle}</span>
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase ${rarityClass}`}>
                      {rarityLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      +{formatAmount(toDisplayAmount(item.rewardCoins))} {currencyLabel}
                    </span>
                    <span>{t("profileBossRatingLine", { n: item.rewardRating })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Тема карт */}
      {player.hasAncientDeck && (
        <div className={`${BLOCK_PROFILE_CLASS} mb-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("profileCardTheme")}
              </span>
              <span className="block text-base text-foreground font-medium">
                {t("profileCardThemeHint")}
              </span>
            </div>
            <select
              value={player.cardDeck === "ancient-rus" ? "ancient-rus" : "classic"}
              onChange={(e) => {
                const val = e.target.value
                setPlayer((p) => ({
                  ...p,
                  cardDeck: val === "ancient-rus" ? "ancient-rus" : undefined,
                }))
              }}
              className="ml-2 px-3.5 py-2.5 rounded-2xl bg-card border border-border/50 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <option value="classic">{t("profileDeckClassic")}</option>
              <option value="ancient-rus">{t("profileDeckAncient")}</option>
            </select>
          </div>
        </div>
      )}

      {/* VIP promo */}
      {!player.vip && (
        <button
          onClick={() => setScreen("shop")}
          className="w-full max-w-lg flex items-center justify-center gap-2 bg-gradient-to-br from-amber-500/18 via-card/55 to-orange-500/12 border border-amber-300/35 text-amber-100 font-semibold text-base py-4 rounded-3xl transition-all hover:brightness-110 mb-6 shadow-[0_0_0_1px_rgba(251,191,36,0.14)]"
        >
          <Crown className="h-5 w-5" />
          <span>{t("profileBuyVip")}</span>
        </button>
      )}

      {/* Реферальная программа */}
      <button
        onClick={() => setScreen("referral")}
        className={`${BLOCK_SOCIAL_CLASS} flex items-center justify-center gap-2 text-foreground font-semibold text-base py-4 active:scale-[0.99] mb-4`}
      >
        <Users className="h-5 w-5 text-muted-foreground" />
        <span>{t("profileReferral")}</span>
      </button>

      <div className={`${BLOCK_ECONOMY_CLASS} mb-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-5 w-5 text-accent" />
          <span className="text-base font-semibold text-foreground">{t("profileWithdrawTitle")}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("profileWithdrawHint")}
        </p>
        <input
          type="text"
          value={withdrawWallet}
          onChange={(e) => {
            setWithdrawWallet(e.target.value)
            setWithdrawMessage("")
          }}
          placeholder={t("profileWalletPlaceholder")}
          className="w-full mb-2 rounded-xl bg-card/80 border border-border/50 px-3 py-2 text-sm text-foreground"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            value={withdrawAmount}
            onChange={(e) => {
              setWithdrawAmount(e.target.value)
              setWithdrawMessage("")
            }}
            placeholder={t("profileAmountPlaceholder")}
            className="flex-1 rounded-xl bg-card/80 border border-border/50 px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => void submitWithdraw()}
            disabled={withdrawBusy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {withdrawBusy ? "..." : t("profileWithdrawBtn")}
          </button>
        </div>
        {!!withdrawMessage && <p className="mt-2 text-xs text-muted-foreground">{withdrawMessage}</p>}
      </div>

      {/* Выйти — в самом низу */}
      <div className="flex-1 min-h-4" />
      <button
        onClick={logout}
        className="w-full max-w-lg flex items-center justify-center gap-2 py-4 rounded-3xl border border-slate-300/25 bg-gradient-to-br from-slate-500/14 via-card/50 to-zinc-500/10 text-muted-foreground hover:text-foreground font-medium text-base transition-colors"
      >
        <LogOut className="h-5 w-5" />
        {t("profileLogout")}
      </button>
    </div>
  )
}
