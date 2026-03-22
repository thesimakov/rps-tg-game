"use client"

import { useGame, BOT_AVATAR_URL, MIN_BETS_DISPLAY, getFillerBetEntries } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import type { BetEntry, BetDuration } from "@/lib/game-context"
import { AvatarImageOrLetter, VipBadgeOnFrame } from "@/components/player-avatar"
import { ArrowLeft, Trophy, Coins, Plus, Star, UserPlus, X, Crown, Wallet, Pencil, Trash2, Flame, Sparkles } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/lib/i18n/context"

const now = () => Date.now()

export function BetsScreen() {
  const { t } = useI18n()
  const {
    bets,
    player,
    createBet,
    removeBet,
    pendingBet,
    setScreen,
    setCurrentBet,
    setOpponent,
    setTotalRounds,
    clearPendingBet,
    updatePendingBetAmount,
    platformUser,
    lavaCardStock,
    purchaseLavaCard,
    toDisplayAmount,
    currencyLabel,
    opponents,
  } = useGame()
  const [createOpen, setCreateOpen] = useState(false)
  const [lavaModalOpen, setLavaModalOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [duration, setDuration] = useState<BetDuration>("once")
  const [inviteBet, setInviteBet] = useState<BetEntry | null>(null)
  const [noMoneyBet, setNoMoneyBet] = useState<BetEntry | null>(null)
  const [myBetModalOpen, setMyBetModalOpen] = useState(false)
  const [editAmount, setEditAmount] = useState("")

  const [expiryTick, setExpiryTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setExpiryTick((t) => t + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])
  const visibleBets = useMemo(
    () => bets.filter((b) => !b.expiresAt || b.expiresAt > now()),
    [bets, expiryTick]
  )
  // Минимум 10 слотов: живые ставки первые, остальное — роботы; плюс один живой — минус один робот
  const displayBets = useMemo(() => {
    const rest = visibleBets.filter((b) => !pendingBet || b.id !== pendingBet.id)
    const sortedBots = [...rest].sort(
      (a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0) || b.createdAt - a.createdAt
    )
    const liveBets: BetEntry[] = []
    if (pendingBet) {
      liveBets.push({
        id: pendingBet.id,
        creatorId: player.id,
        creatorName: player.name,
        creatorAvatar: player.avatar,
        creatorAvatarUrl: player.hideVkAvatar ? undefined : player.avatarUrl,
        creatorWins: player.wins,
        amount: pendingBet.amount,
        createdAt: pendingBet.createdAt,
        vip: player.vip,
      })
    }
    const botSlotsNeeded = Math.max(0, MIN_BETS_DISPLAY - liveBets.length)
    const botBetsToShow = sortedBots.slice(0, botSlotsNeeded)
    const filler = getFillerBetEntries(botSlotsNeeded - botBetsToShow.length, opponents)
    return [...liveBets, ...botBetsToShow, ...filler]
  }, [visibleBets, pendingBet, player.id, player.name, player.avatar, player.avatarUrl, player.hideVkAvatar, player.wins, player.vip, opponents])

  const handleCreateBet = () => {
    const num = parseInt(amount, 10)
    if (num > 0 && player.balance >= num) {
      createBet(num, duration)
      setAmount("")
      setCreateOpen(false)
    }
  }

  const canBuyLava = lavaCardStock > 0 && player.balance >= 120_000

  const handleInvite = (bet: BetEntry) => {
    removeBet(bet.id)
    const avatarUrl = bet.creatorAvatarUrl ?? (bet.creatorId.startsWith("bot") ? BOT_AVATAR_URL(bet.creatorId) : "")
    setOpponent({
      id: bet.creatorId,
      name: bet.creatorName,
      avatar: bet.creatorAvatar,
      avatarUrl,
      balance: 500,
      wins: bet.creatorWins,
      losses: 20,
      weekWins: Math.floor(bet.creatorWins / 2),
      weekEarnings: bet.amount * 5,
      vip: !!bet.vip,
    })
    setCurrentBet(bet.amount)
    setTotalRounds(1)
    setInviteBet(null)
    setScreen("arena")
  }

  return (
    <div className="flex flex-col min-h-screen px-4 py-6">
      <div className="w-full max-w-lg flex items-center mb-6 mx-auto">
        <button
          onClick={() => setScreen(platformUser ? "menu" : "entry")}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-foreground"
          aria-label={t("commonBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground uppercase tracking-wider flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          {t("betsScreenTitle")}
        </h1>
        <div className="w-9" />
      </div>

      {/* Горячая новинка — карта Лава (над блоком ставки) */}
      <div className="w-full max-w-lg mx-auto mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-base font-bold text-foreground uppercase tracking-wide">{t("betsSidebarHot")}</span>
        </div>
        <button
          type="button"
          onClick={() => setLavaModalOpen(true)}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground">{t("betsScreenLavaTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("betsScreenLavaStock", { n: lavaCardStock })}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Coins className="h-5 w-5 text-amber-500" />
            <span className="text-base font-bold text-amber-500">{formatAmount(toDisplayAmount(120_000))}</span>
          </div>
        </button>
      </div>

      <div className="w-full max-w-lg mx-auto flex flex-col gap-4">
        {!platformUser && (
          <p className="text-sm text-center py-2 px-3 rounded-xl bg-primary/15 border border-primary/30 text-primary">
            {t("betsScreenLoginPrompt")}
          </p>
        )}
        {platformUser && pendingBet ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            {t("betsScreenHasBet")}
          </p>
        ) : platformUser ? (
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-accent/20 border border-accent/40 text-accent font-bold hover:bg-accent/30 transition-colors"
          >
            <Plus className="h-5 w-5" />
            {t("betsSidebarCreate")}
          </button>
        ) : null}

        <p className="text-sm text-muted-foreground">{t("betsScreenPickHint")}</p>
        <div className="flex flex-col gap-2">
          {displayBets.map((bet) => {
            const isMyBet = bet.creatorId === player.id
            return (
              <button
                key={bet.id}
                onClick={() => {
                  if (!platformUser) {
                    setScreen("entry")
                    return
                  }
                  if (isMyBet) {
                    setEditAmount(String(bet.amount))
                    setMyBetModalOpen(true)
                    return
                  }
                  if (player.balance < bet.amount) {
                    setNoMoneyBet(bet)
                    return
                  }
                  setInviteBet(bet)
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-colors ${
                  isMyBet
                    ? "bg-primary/15 border-2 border-primary/60 ring-2 ring-primary/30 ring-offset-2 ring-offset-background shadow-md shadow-primary/10 cursor-pointer hover:bg-primary/20"
                    : "bg-card/60 border-border/40 hover:bg-card/80 cursor-pointer"
                }`}
              >
                {bet.vip ? (
                  <div className="relative inline-flex flex-shrink-0">
                    <div className="vip-frame-outer w-12 h-12">
                      <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border overflow-hidden bg-muted/40 text-foreground border-border/30">
                          <AvatarImageOrLetter
                            src={bet.creatorAvatarUrl || (bet.creatorId.includes("bot") ? BOT_AVATAR_URL(bet.creatorId) : null)}
                            letter={bet.creatorAvatar}
                          />
                        </div>
                      </div>
                    </div>
                    <VipBadgeOnFrame size="sm" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border flex-shrink-0 overflow-hidden bg-muted/40 text-foreground border-border/30">
                    <AvatarImageOrLetter
                      src={bet.creatorAvatarUrl || (bet.creatorId.includes("bot") ? BOT_AVATAR_URL(bet.creatorId) : null)}
                      letter={bet.creatorAvatar}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isMyBet && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/20 px-1.5 py-0.5 rounded">
                        {t("betsSidebarMyBet")}
                      </span>
                    )}
                    <span className="font-semibold text-base text-foreground">
                      {isMyBet ? t("commonYou") : bet.creatorName}
                    </span>
                    {bet.vip && <Crown className="h-4 w-4 text-accent flex-shrink-0" />}
                    {!isMyBet && !bet.vip && <Star className="h-4 w-4 text-accent flex-shrink-0" />}
                    {isMyBet && (
                      <span className="text-xs text-muted-foreground">{t("betsScreenEditSuffix")}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{t("betsSidebarInviteWins", { n: bet.creatorWins })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-accent" />
                  <span className="font-bold text-base text-accent tabular-nums">{formatAmount(toDisplayAmount(bet.amount))}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Модалка своей ставки: изменить размер или удалить */}
      <Dialog open={myBetModalOpen} onOpenChange={(open) => !open && setMyBetModalOpen(false)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-accent" />
              {t("betsSidebarMyBet")}
            </DialogTitle>
          </DialogHeader>
          {pendingBet && (
            <>
              <div className="space-y-3">
                <Label htmlFor="edit-amount">{t("betsSidebarNewAmount", { currency: currencyLabel })}</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  min={5}
                  max={player.balance + pendingBet.amount}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="text-lg font-bold tabular-nums"
                />
                <p className="text-base text-muted-foreground">
                  {t("betsScreenCurrentStake", {
                    amount: formatAmount(toDisplayAmount(pendingBet.amount)),
                    currency: currencyLabel,
                  })}{" "}
                  {t("betsScreenBalanceIfWin", {
                    amount: formatAmount(
                      toDisplayAmount(
                        (() => {
                          const raw = parseInt(editAmount || String(pendingBet.amount), 10)
                          const bet = Number.isFinite(raw) && raw > 0 ? raw : pendingBet.amount
                          const earningsIfWin = bet * 2 - bet
                          return player.balance + earningsIfWin
                        })(),
                      ),
                    ),
                    currency: currencyLabel,
                  })}
                </p>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={() => {
                    clearPendingBet()
                    setMyBetModalOpen(false)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("betsScreenDeleteBet")}
                </Button>
                <Button
                  onClick={() => {
                    const num = parseInt(editAmount, 10)
                    if (num >= 5 && updatePendingBetAmount(num)) {
                      setMyBetModalOpen(false)
                    }
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {t("betsScreenChangeSize")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Окно «нет денег на поддержать ставку» */}
      <Dialog open={!!noMoneyBet} onOpenChange={(open) => !open && setNoMoneyBet(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-accent" />
              {t("betsSidebarNoFundsTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("betsSidebarNoFundsBody", {
              amount: noMoneyBet
                ? t("betsSidebarNoFundsAmount", {
                    amount: formatAmount(toDisplayAmount(noMoneyBet.amount)),
                    currency: currencyLabel,
                  })
                : "",
            })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoMoneyBet(null)}>
              {t("commonClose")}
            </Button>
            <Button onClick={() => { setNoMoneyBet(null); setScreen("shop") }}>
              <Coins className="h-4 w-4 mr-1" />
              {t("betsSidebarTopUp")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модалка при выборе чужой ставки: Пригласить / Отклонить */}
      <Dialog open={!!inviteBet} onOpenChange={(open) => !open && setInviteBet(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("betsSidebarInviteTitle")}</DialogTitle>
          </DialogHeader>
          {inviteBet && (
            <>
              <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-muted/20">
                {inviteBet.vip ? (
                  <div className="relative inline-flex flex-shrink-0">
                    <div className="vip-frame-outer w-14 h-14">
                      <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                        <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center text-lg font-bold border border-border/30 overflow-hidden">
                          <AvatarImageOrLetter
                            src={inviteBet.creatorAvatarUrl || (inviteBet.creatorId.includes("bot") ? BOT_AVATAR_URL(inviteBet.creatorId) : null)}
                            letter={inviteBet.creatorAvatar}
                          />
                        </div>
                      </div>
                    </div>
                    <VipBadgeOnFrame size="md" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center text-lg font-bold border border-border/30 overflow-hidden">
                    <AvatarImageOrLetter
                      src={inviteBet.creatorAvatarUrl || (inviteBet.creatorId.includes("bot") ? BOT_AVATAR_URL(inviteBet.creatorId) : null)}
                      letter={inviteBet.creatorAvatar}
                    />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-base text-foreground">{inviteBet.creatorName}</p>
                  <p className="text-sm text-muted-foreground">{t("betsSidebarInviteWins", { n: inviteBet.creatorWins })}</p>
                  <p className="text-base text-accent font-bold">{formatAmount(toDisplayAmount(inviteBet.amount))} {currencyLabel}</p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setInviteBet(null)}>
                  <X className="h-4 w-4 mr-1" />
                  {t("commonDecline")}
                </Button>
                <Button onClick={() => handleInvite(inviteBet)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  {t("commonInvite")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("betsSidebarCreateTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("betsSidebarCreateBody")}</p>
          <div className="grid gap-2">
            <Label htmlFor="bet-amount-mobile">{t("betsSidebarAmountLabel", { currency: currencyLabel })}</Label>
            <Input
              id="bet-amount-mobile"
              type="number"
              min={1}
              max={player.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("betsSidebarAmountPlaceholder")}
              className="bg-muted/30 border-border"
            />
            <p className="text-xs text-muted-foreground">
              {t("betsSidebarBalancePrefix")}{" "}
              <span className="font-semibold text-base text-accent">{formatAmount(toDisplayAmount(player.balance))}</span>{" "}
              {currencyLabel}
            </p>
            <div className="grid gap-2 pt-2">
              <Label>{t("betsSidebarHoldLabel")}</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    checked={duration === "once"}
                    onChange={() => setDuration("once")}
                    className="rounded-full border-border"
                  />
                  <span className="text-sm text-foreground">{t("betsSidebarOnce")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration"
                    checked={duration === "1h"}
                    onChange={() => setDuration("1h")}
                    className="rounded-full border-border"
                  />
                  <span className="text-sm text-foreground">{t("betsSidebarOneHour")}</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("commonCancel")}
            </Button>
            <Button
              onClick={handleCreateBet}
              disabled={!amount || parseInt(amount, 10) < 1 || player.balance < parseInt(amount, 10)}
            >
              {t("betsSidebarCreate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модалка карты «Лава» */}
      <Dialog open={lavaModalOpen} onOpenChange={setLavaModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Flame className="h-4 w-4 text-white" />
              </div>
              {t("betsSidebarLavaTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("betsSidebarLavaBody")}</p>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{t("betsSidebarLavaStock", { n: lavaCardStock })}</span>
            <span className="flex items-center gap-1 text-base text-amber-500 font-bold">
              <Coins className="h-4 w-4" /> {formatAmount(toDisplayAmount(120_000))} {currencyLabel}
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLavaModalOpen(false)}>
              {t("commonClose")}
            </Button>
            <Button
              onClick={() => {
                if (purchaseLavaCard()) setLavaModalOpen(false)
              }}
              disabled={!canBuyLava}
            >
              {t("commonBuy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
