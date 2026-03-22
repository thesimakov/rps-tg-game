"use client"

import { useGame, type GameScreen } from "@/lib/game-context"
import { Home, Swords, Trophy, User, ShoppingBag } from "lucide-react"
import { BackgroundMusic } from "@/components/background-music"
import { useI18n } from "@/lib/i18n/context"
import { useMemo } from "react"

interface NavItem {
  screen: GameScreen
  labelKey: "navHome" | "navTop" | "navPlay" | "navShop" | "navProfile"
  icon: React.ReactNode
}

const NAV_DEFS: NavItem[] = [
  { screen: "menu", labelKey: "navHome", icon: <Home className="h-5 w-5" /> },
  { screen: "leaderboard", labelKey: "navTop", icon: <Trophy className="h-5 w-5" /> },
  { screen: "bet-select", labelKey: "navPlay", icon: <Swords className="h-6 w-6" /> },
  { screen: "shop", labelKey: "navShop", icon: <ShoppingBag className="h-5 w-5" /> },
  { screen: "profile", labelKey: "navProfile", icon: <User className="h-5 w-5" /> },
]

export function BottomNav() {
  const { t } = useI18n()
  const { screen, setScreen } = useGame()

  const items = useMemo(
    () =>
      NAV_DEFS.map((d) => ({
        screen: d.screen,
        label: t(d.labelKey),
        icon: d.icon,
      })),
    [t]
  )

  if (["arena", "pvp-arena", "matchmaking", "result"].includes(screen)) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/30"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-lg mx-auto flex items-center justify-between py-1.5 px-2">
        <div className="hidden sm:flex items-center">
          <BackgroundMusic />
        </div>
        <div className="flex-1 flex items-center justify-around">
          {items.map((item) => {
            const isActive = screen === item.screen
            const isPlay = item.screen === "bet-select"

            if (isPlay) {
              return (
                <button
                  key={item.screen}
                  onClick={() => setScreen(item.screen)}
                  className="flex flex-col items-center gap-0.5 -mt-5"
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform">
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-bold text-primary mt-0.5">{item.label}</span>
                </button>
              )
            }

            return (
              <button
                key={item.screen}
                onClick={() => setScreen(item.screen)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
