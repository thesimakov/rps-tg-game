"use client"

import { useGame, BOT_AVATAR_URL, MIN_BETS_DISPLAY, getFillerBetEntries } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import type { BetEntry, BetDuration } from "@/lib/game-context"
import { AvatarImageOrLetter, VipBadgeOnFrame } from "@/components/player-avatar"
import { Trophy, Coins, Plus, Star, UserPlus, X, Crown, Wallet, Pencil, Trash2, Flame, Sparkles } from "lucide-react"
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

const now = () => Date.now()

export function BetsSidebar() {
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
    const filler = getFillerBetEntries(botSlotsNeeded - botBetsToShow.length)
    return [...liveBets, ...botBetsToShow, ...filler]
  }, [visibleBets, pendingBet, player.id, player.name, player.avatar, player.avatarUrl, player.hideVkAvatar, player.wins, player.vip])

  const handleCreateBet = () => {
    const num = parseInt(amount, 10)
    if (num > 0 && player.balance >= num) {
      createBet(num, duration)
      setAmount("")
      setCreateOpen(false)
    }
  }

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

  const canBuyLava = lavaCardStock > 0 && player.balance >= 120_000

  return (
    <>
      <div className="flex flex-col h-full py-4 px-3 gap-3">
        {/* Горячая новинка — карта Лава */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-base font-bold text-foreground uppercase tracking-wide">Горячая новинка</span>
          </div>
          <button
            type="button"
            onClick={() => setLavaModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
              <Flame className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground truncate">Лава</p>
              <p className="text-[10px] text-muted-foreground">{lavaCardStock} из 3</p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-base font-bold text-amber-500">{formatAmount(toDisplayAmount(120_000))}</span>
            </div>
          </button>
        </div>
        <div className="h-px bg-border/30" />

        <div className="flex items-center gap-2 px-2 py-1">
          <Trophy className="h-4 w-4 text-accent" />
          <span className="font-bold text-base text-foreground tracking-wide uppercase">
            Ставки
          </span>
        </div>
        <div className="h-px bg-border/30" />

        {pendingBet ? (
          <p className="text-[10px] text-muted-foreground text-center px-1">
            Есть ставка · нажмите на неё
          </p>
        ) : (
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent/20 border border-accent/40 text-accent font-bold text-sm hover:bg-accent/30 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Создать ставку
          </button>
        )}

        <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto min-h-0">
          {displayBets.map((bet) => {
            const isMyBet = bet.creatorId === player.id
            return (
              <button
                key={bet.id}
                onClick={() => {
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
                className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-colors text-left border ${
                  isMyBet
                    ? "bg-primary/15 border-2 border-primary/50 ring-2 ring-primary/25 ring-offset-1 ring-offset-background cursor-pointer hover:bg-primary/20"
                    : "border-transparent hover:border-border/30 hover:bg-muted/20 cursor-pointer"
                }`}
              >
                {bet.vip ? (
                  <div className="relative inline-flex flex-shrink-0">
                    <div className="vip-frame-outer w-10 h-10">
                      <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border overflow-hidden bg-muted/40 text-foreground/80 border-border/30">
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 border overflow-hidden bg-muted/40 text-foreground/80 border-border/30">
                    <AvatarImageOrLetter
                      src={bet.creatorAvatarUrl || (bet.creatorId.includes("bot") ? BOT_AVATAR_URL(bet.creatorId) : null)}
                      letter={bet.creatorAvatar}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    {isMyBet && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-primary bg-primary/20 px-1 py-0.5 rounded">
                        Моя
                      </span>
                    )}
                    <span className="text-base font-semibold truncate text-foreground">
                      {isMyBet ? "Вы" : bet.creatorName}
                    </span>
                    {bet.vip && <Crown className="h-3 w-3 text-accent flex-shrink-0" />}
                    {!isMyBet && !bet.vip && <Star className="h-3 w-3 text-accent flex-shrink-0" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {bet.creatorWins} побед {isMyBet && "· изменить"}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Coins className="h-3.5 w-3.5 text-accent" />
                  <span className="text-base font-bold text-accent tabular-nums">{formatAmount(toDisplayAmount(bet.amount))}</span>
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
              Моя ставка
            </DialogTitle>
          </DialogHeader>
          {pendingBet && (
            <>
              <div className="space-y-3">
                <Label htmlFor="edit-amount-sidebar">Новый размер ({currencyLabel})</Label>
                <Input
                  id="edit-amount-sidebar"
                  type="number"
                  min={5}
                  max={player.balance + pendingBet.amount}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="text-lg font-bold tabular-nums"
                />
                <p className="text-base text-muted-foreground">
                  Сейчас: {formatAmount(toDisplayAmount(pendingBet.amount))}. Баланс: {formatAmount(toDisplayAmount(player.balance + pendingBet.amount))} {currencyLabel}
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
                  Удалить
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
                  Изменить
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
              Недостаточно средств
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            У вас нет монет, чтобы поддержать ставку{noMoneyBet ? ` (${formatAmount(toDisplayAmount(noMoneyBet.amount))} ${currencyLabel})` : ""}. Пополните баланс, чтобы принять участие в игре.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoMoneyBet(null)}>
              Закрыть
            </Button>
            <Button onClick={() => { setNoMoneyBet(null); setScreen("shop") }}>
              <Coins className="h-4 w-4 mr-1" />
              Пополнить баланс
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!inviteBet} onOpenChange={(open) => !open && setInviteBet(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Пригласить в игру</DialogTitle>
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
                  <p className="text-sm text-muted-foreground">{inviteBet.creatorWins} побед</p>
                  <p className="text-base text-accent font-bold">{formatAmount(toDisplayAmount(inviteBet.amount))} {currencyLabel}</p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setInviteBet(null)}>
                  <X className="h-4 w-4 mr-1" />
                  Отклонить
                </Button>
                <Button onClick={() => handleInvite(inviteBet)}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Пригласить
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Создать ставку</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Укажите сумму ставки. Другие игроки смогут откликнуться и сыграть с вами.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="bet-amount">Сумма ({currencyLabel})</Label>
            <Input
              id="bet-amount"
              type="number"
              min={1}
              max={player.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Например 50"
              className="bg-muted/30 border-border"
            />
            <p className="text-xs text-muted-foreground">
              Баланс: <span className="font-semibold text-base text-accent">{formatAmount(toDisplayAmount(player.balance))}</span> {currencyLabel}
            </p>
            <div className="grid gap-2 pt-2">
              <Label>Держать ставку</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration-sidebar"
                    checked={duration === "once"}
                    onChange={() => setDuration("once")}
                    className="rounded-full border-border"
                  />
                  <span className="text-sm text-foreground">Разово</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duration-sidebar"
                    checked={duration === "1h"}
                    onChange={() => setDuration("1h")}
                    className="rounded-full border-border"
                  />
                  <span className="text-sm text-foreground">В течение часа</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleCreateBet}
              disabled={!amount || parseInt(amount, 10) < 1 || player.balance < parseInt(amount, 10)}
            >
              Создать
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
              Карта «Лава»
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Карта уничтожает любую карту соперника. Можно использовать 5 раз. Рекомендуем при турнире.
          </p>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">В наличии: {lavaCardStock} из 3</span>
            <span className="flex items-center gap-1 text-amber-500 font-bold">
              <Coins className="h-4 w-4" /> {formatAmount(toDisplayAmount(120_000))} {currencyLabel}
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLavaModalOpen(false)}>
              Закрыть
            </Button>
            <Button
              onClick={() => {
                if (purchaseLavaCard()) setLavaModalOpen(false)
              }}
              disabled={!canBuyLava}
            >
              Купить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}