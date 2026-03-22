"use client"

import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { ArrowLeft, Trophy, Crown, Medal } from "lucide-react"
import { VipBadgeOnFrame } from "@/components/player-avatar"

function getMedalStyle(rank: number) {
  if (rank === 1) return "bg-accent/20 text-accent border border-accent/30"
  if (rank === 2) return "bg-foreground/10 text-foreground/70 border border-foreground/20"
  if (rank === 3) return "bg-secondary/15 text-secondary border border-secondary/25"
  return "bg-muted/40 text-muted-foreground border border-border/30"
}

function getRowStyle(rank: number, isPlayer: boolean) {
  if (isPlayer) return "bg-primary/10 border-primary/30"
  if (rank === 1) return "bg-accent/5 border-accent/20"
  if (rank <= 3) return "bg-card/50 border-border/30"
  return "bg-card/30 border-border/20"
}

export function LeaderboardScreen() {
  const { setScreen, leaderboard, playerRank, player, platformUser } = useGame()

  const top10 = leaderboard.slice(0, 10)

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center mb-5">
        <button
          onClick={() => setScreen(platformUser ? "menu" : "entry")}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-foreground"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground flex items-center justify-center gap-2 uppercase tracking-wider">
          <Trophy className="h-5 w-5 text-accent" />
          ТОП-10 Недели
        </h1>
        <div className="w-9" />
      </div>

      {/* Player rank badge */}
      <div className="w-full max-w-lg mb-4 bg-primary/8 border border-primary/25 rounded-2xl px-4 py-3 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Medal className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold text-foreground">Ваше место в рейтинге</span>
        </div>
        <span className="text-base font-extrabold text-primary">#{playerRank}</span>
      </div>

      <p className="text-xs text-muted-foreground mb-4 font-medium">
        {"Обновление каждый понедельник в 00:00"}
      </p>

      {/* Leaderboard */}
      <div className="w-full max-w-lg flex flex-col gap-2">
        {/* Заголовок столбцов */}
        <div className="flex items-center justify-between px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Игрок</span>
          <span>Бонусы</span>
        </div>
        {top10.map((entry) => (
          <div
            key={entry.id}
            className={`flex items-center gap-3 px-3 py-3 rounded-2xl border backdrop-blur-sm transition-all ${getRowStyle(entry.rank, !!entry.isPlayer)}`}
          >
            {/* Rank */}
            <div
              className={`w-8 h-8 rounded-lg ${getMedalStyle(entry.rank)} flex items-center justify-center text-xs font-extrabold flex-shrink-0`}
            >
              {entry.rank}
            </div>

            {/* Avatar */}
            {entry.vip ? (
              <div className="relative inline-flex flex-shrink-0">
                <div className="vip-frame-outer w-12 h-12">
                  <div className="vip-frame-inner w-full h-full flex items-center justify-center">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border overflow-hidden ${
                        entry.isPlayer
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : entry.rank <= 3
                          ? "bg-accent/10 border-accent/25 text-accent"
                          : "bg-muted/30 border-border/30 text-foreground/60"
                      }`}
                    >
                      {entry.isPlayer
                        ? (player.hideVkAvatar || !player.avatarUrl ? (
                            <span>{entry.avatar}</span>
                          ) : (
                            <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ))
                        : entry.avatarUrl
                          ? (
                            <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
                          )
                          : (
                            <span>{entry.avatar}</span>
                          )}
                    </div>
                  </div>
                </div>
                <VipBadgeOnFrame size="sm" />
              </div>
            ) : (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 border overflow-hidden ${
                  entry.isPlayer
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : entry.rank <= 3
                    ? "bg-accent/10 border-accent/25 text-accent"
                    : "bg-muted/30 border-border/30 text-foreground/60"
                }`}
              >
                {entry.isPlayer
                  ? (player.hideVkAvatar || !player.avatarUrl ? (
                      <span>{entry.avatar}</span>
                    ) : (
                      <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ))
                  : entry.avatarUrl
                    ? (
                      <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
                    )
                    : (
                      <span>{entry.avatar}</span>
                    )}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-base font-semibold truncate ${entry.isPlayer ? "text-primary" : "text-foreground"}`}>
                  {entry.isPlayer ? "Вы" : entry.name}
                </span>
                {entry.vip && <Crown className="h-3.5 w-3.5 text-accent flex-shrink-0" />}
              </div>
              <span className="text-xs text-muted-foreground">
                {entry.wins} {"побед"}
              </span>
            </div>

            {/* Бонусы (значение) */}
            <div className="flex items-center justify-end gap-1">
              <span className="text-base font-bold text-accent tabular-nums">
                {entry.earnings}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly rewards */}
      <div className="w-full max-w-lg mt-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4">
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2 uppercase tracking-wide">
          <Crown className="h-4 w-4 text-accent" />
          Награды
        </h3>
        <div className="grid grid-cols-2 gap-2 text-base text-muted-foreground font-medium">
          <span>{"1 место → "}{formatAmount(200)}{" монет"}</span>
          <span>{"2 место → "}{formatAmount(100)}{" монет"}</span>
          <span>{"3 место → "}{formatAmount(50)}{" монет"}</span>
          <span>{"4-10 место → "}{formatAmount(10)}{" монет"}</span>
        </div>
      </div>
    </div>
  )
}
