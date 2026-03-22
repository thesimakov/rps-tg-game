"use client"

import { useState, useMemo } from "react"
import type { CSSProperties } from "react"
import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { isMiniAppEnvironment, showFriendsPicker, type Friend } from "@/lib/platform-bridge"
import { ArrowLeft, Users, Crown, Plus, X, Coins, Sword } from "lucide-react"

interface TableSeat {
  id: string
  name: string
  avatarUrl?: string
  isHost?: boolean
}

const MAX_SEATS = 9

function duel(a: number, b: number): number {
  return Math.random() < 0.5 ? a : b
}

function runTournament(totalPlayers: number, hostIndex: number): number {
  // Общий случай для 3–9 игроков: плей-офф с возможным байем, финал до 2 побед.
  let players = Array.from({ length: totalPlayers }, (_, i) => i)

  // Если нечётное число игроков — хост получает бай в первом раунде (если он есть).
  if (players.length % 2 === 1 && hostIndex >= 0 && hostIndex < players.length) {
    const others = players.filter((i) => i !== hostIndex)
    const shuffled = others.sort(() => Math.random() - 0.5)
    const nextRound: number[] = [hostIndex]
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 >= shuffled.length) {
        nextRound.push(shuffled[i])
      } else {
        nextRound.push(duel(shuffled[i], shuffled[i + 1]))
      }
    }
    players = nextRound
  }

  // Остальные раунды: пока > 2 игроков — обычный плей-офф.
  while (players.length > 2) {
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    const next: number[] = []
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 >= shuffled.length) {
        next.push(shuffled[i])
      } else {
        next.push(duel(shuffled[i], shuffled[i + 1]))
      }
    }
    players = next
  }

  const [a, b] = players
  // Финал до 2-х побед
  let winsA = 0
  let winsB = 0
  while (winsA < 2 && winsB < 2) {
    if (Math.random() < 0.5) winsA += 1
    else winsB += 1
  }
  return winsA > winsB ? a : b
}

export function FriendsTableScreen() {
  const { player, setPlayer, setScreen, toDisplayAmount, currencyLabel } = useGame()
  const [bet, setBet] = useState(10)
  const [seats, setSeats] = useState<(TableSeat | null)[]>(() => {
    const arr: (TableSeat | null)[] = Array(MAX_SEATS).fill(null)
    arr[0] = {
      id: player.id,
      name: player.name,
      avatarUrl: player.hideVkAvatar ? undefined : player.avatarUrl,
      isHost: true,
    }
    return arr
  })
  const [isRunning, setIsRunning] = useState(false)
  const [resultText, setResultText] = useState<string | null>(null)

  const filledCount = useMemo(() => seats.filter(Boolean).length, [seats])
  const canStart = filledCount >= 3 && bet >= 5 && !isRunning && player.balance >= bet

  const handleAddFriend = async (index: number) => {
    if (index === 0) return
    if (!isMiniAppEnvironment()) {
      // Вне мини-приложения: добавляем тестового друга
      setSeats((prev) => {
        const copy = [...prev]
        const num = prev.filter(Boolean).length
        copy[index] = {
          id: `local_${Date.now()}_${index}`,
          name: `Друг ${num}`,
        }
        return copy
      })
      return
    }
    const users = await showFriendsPicker()
    if (!users || !users.length) return
    const friend: Friend = users[0]
    setSeats((prev) => {
      const copy = [...prev]
      copy[index] = {
        id: `tg_${friend.id}`,
        name: `${friend.first_name} ${friend.last_name}`.trim(),
        avatarUrl: friend.photo_200,
      }
      return copy
    })
  }

  const handleRemove = (index: number) => {
    if (index === 0) return
    setSeats((prev) => {
      const copy = [...prev]
      copy[index] = null
      return copy
    })
  }

  const handlePlay = () => {
    if (!canStart) return
    setIsRunning(true)
    try {
      const participants = seats.filter(Boolean) as TableSeat[]
      const hostIndex = participants.findIndex((s) => s?.isHost)
      const winnerIndex = runTournament(participants.length, hostIndex)
      const winner = participants[winnerIndex]
      const winnerIsHost = winner && winner.isHost

      // Экономика: ставка ×2, без комиссии, бонусы = 10% от выигрыша
      const pot = bet * 2
      const winnings = pot

      let earnings = 0
      let bonus = 0
      if (winnerIsHost) {
        earnings = winnings - bet
        bonus = Math.max(1, Math.round(winnings * 0.1))
      } else {
        earnings = -bet
        bonus = 0
      }

      setPlayer((p) => ({
        ...p,
        balance: p.balance + earnings,
        wins: winnerIsHost ? p.wins + 1 : p.wins,
        losses: !winnerIsHost ? p.losses + 1 : p.losses,
        weekWins: winnerIsHost ? p.weekWins + 1 : p.weekWins,
        weekEarnings: p.weekEarnings + Math.max(0, earnings),
        ratingPoints: Math.min(1000, (p.ratingPoints ?? 0) + bonus),
      }))

      if (winnerIsHost) {
        setResultText(
          `Вы выиграли турнир за столом! Плюс ${formatAmount(toDisplayAmount(earnings))} ${currencyLabel} и ${
            bonus
          } бонусов.`
        )
      } else {
        setResultText(
          `${winner?.name || "Игрок"} победил в турнире. Вы потеряли ${formatAmount(
            toDisplayAmount(-earnings)
          )} ${currencyLabel}.`
        )
      }
    } finally {
      setIsRunning(false)
    }
  }

  const seatPositions = [
    { top: "72%", left: "50%" }, // host bottom center
    { top: "60%", left: "82%" },
    { top: "35%", left: "92%" },
    { top: "12%", left: "76%" },
    { top: "4%", left: "50%" },
    { top: "12%", left: "24%" },
    { top: "35%", left: "8%" },
    { top: "60%", left: "18%" },
    { top: "72%", left: "50%", transform: "translate(-50%, 0) scale(0.8)" }, // extra slot near host
  ]

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center mb-6">
        <button
          onClick={() => setScreen("menu")}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-foreground"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground uppercase tracking-wider flex items-center justify-center gap-2">
          <Users className="h-5 w-5" />
          За стол с друзьями
        </h1>
        <div className="w-9" />
      </div>

      {/* Стол */}
      <div className="relative w-72 h-72 max-w-full mb-6">
        <div className="absolute inset-6 rounded-full bg-card/60 border border-border/40 shadow-lg" />
        <div className="absolute inset-16 rounded-full bg-background/60 border border-border/40 flex items-center justify-center">
          <span className="text-xs text-muted-foreground text-center px-4">
            До 9 игроков. Добавьте друзей по кругу и нажмите «Играем», чтобы запустить турнир.
          </span>
        </div>

        {seats.map((seat, index) => {
          const pos = seatPositions[index]
          const isHost = seat?.isHost
          const style: CSSProperties = {
            position: "absolute",
            transform: "translate(-50%, -50%)",
            ...pos,
          }
          return (
            <button
              key={index}
              type="button"
              style={style}
              onClick={() => (seat ? handleRemove(index) : handleAddFriend(index))}
              className={`w-12 h-12 rounded-full border flex items-center justify-center text-xs font-bold bg-card/80 border-border/50 overflow-hidden ${
                isHost ? "ring-2 ring-amber-400" : ""
              }`}
            >
              {seat ? (
                <>
                  {seat.avatarUrl ? (
                    <img src={seat.avatarUrl} alt={seat.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="px-1 text-[10px] truncate">{seat.name}</span>
                  )}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-black/70 border border-amber-400/50 text-[9px] text-amber-300 font-bold tabular-nums">
                    {formatAmount(toDisplayAmount(bet))}
                  </div>
                </>
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          )
        })}
      </div>

      {/* Ставка и инфо */}
      <div className="w-full max-w-lg mb-4">
        <label className="text-sm font-bold text-foreground mb-2 block">Ставка ({currencyLabel})</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min={5}
              max={player.balance}
              value={bet}
              onChange={(e) => setBet(Number(e.target.value) || 0)}
              className="w-full bg-card/60 border border-border/40 rounded-2xl px-4 py-3 text-base font-bold text-foreground tabular-nums"
            />
            <Coins className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          </div>
          <div className="px-3 py-2 rounded-2xl bg-card/60 border border-border/40 text-xs text-muted-foreground">
            Банк:{" "}
            <span className="font-bold text-foreground">
              {formatAmount(toDisplayAmount(bet * 2))} {currencyLabel}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Без комиссии с банка. Победитель турнира получает полный выигрыш, как в обычной игре.
        </p>
      </div>

      {/* Кнопка старт */}
      <button
        type="button"
        onClick={handlePlay}
        disabled={!canStart}
        className={`w-full max-w-lg flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-bold transition-all active:scale-[0.98] ${
          canStart
            ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
            : "bg-muted/40 text-muted-foreground cursor-not-allowed"
        }`}
      >
        <Sword className="h-5 w-5" />
        Играем
      </button>

      <p className="mt-2 text-xs text-muted-foreground text-center max-w-lg">
        Для начала турнира нужно 9 игроков за столом и достаточный баланс для ставки.
      </p>

      {resultText && (
        <div className="mt-4 w-full max-w-lg rounded-2xl bg-card/40 border border-border/40 px-4 py-3 flex items-start gap-2">
          <Crown className="h-5 w-5 text-amber-400 mt-0.5" />
          <p className="text-sm text-foreground">{resultText}</p>
        </div>
      )}
    </div>
  )
}

