"use client"

import { GameProvider, useGame } from "@/lib/game-context"
import { I18nProvider, useI18n } from "@/lib/i18n/context"
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { showFriendsPicker } from "@/lib/platform-bridge"
import { MainMenu } from "@/components/main-menu"
import { BetSelect } from "@/components/bet-select"
import { Matchmaking } from "@/components/matchmaking"
import { GameArena } from "@/components/game-arena"
import { ResultScreen } from "@/components/result-screen"
import { BossRewardScreen } from "@/components/boss-reward-screen"
import { LeaderboardScreen } from "@/components/leaderboard-screen"
import { ProfileScreen } from "@/components/profile-screen"
import { LevelsScreen } from "@/components/levels-screen"
import { ReferralScreen } from "@/components/referral-screen"
import { ShopScreen } from "@/components/shop-screen"
import { BottomNav } from "@/components/bottom-nav"
import { WeeklyRanking } from "@/components/weekly-ranking"
import { BetsSidebar } from "@/components/bets-sidebar"
import { BetsScreen } from "@/components/bets-screen"
import { BetResponseDialog } from "@/components/bet-response-dialog"
import { ParticlesBg } from "@/components/particles-bg"
import { EntryScreen } from "@/components/entry-screen"
import { GameLoader } from "@/components/game-loader"
import { AdminScreen } from "@/components/admin-screen"
import { isServerPlayerId } from "@/lib/platform-user"

function GameScreen() {
  const { screen, platformUser } = useGame()
  const isEntry = screen === "entry" || (screen === "menu" && !platformUser)

  return (
    <>
      {isEntry && <EntryScreen />}
      {screen === "menu" && platformUser && <MainMenu />}
      {screen === "levels" && <LevelsScreen />}
      {screen === "bets" && <BetsScreen />}
      {screen === "bet-select" && <BetSelect />}
      {screen === "matchmaking" && <Matchmaking />}
      {screen === "arena" && <GameArena />}
      {screen === "result" && <ResultScreen />}
      {screen === "boss-reward" && <BossRewardScreen />}
      {screen === "leaderboard" && <LeaderboardScreen />}
      {screen === "profile" && <ProfileScreen />}
      {screen === "referral" && <ReferralScreen />}
      {screen === "shop" && <ShopScreen />}
      {screen === "admin" && <AdminScreen />}
    </>
  )
}

function GameLayout() {
  const { t } = useI18n()
  const { screen, platformUser, player, setPlayer, isLoading, loadingStage, loadingProgress } = useGame()
  const [hideLowBalanceHint, setHideLowBalanceHint] = useState(false)
  const [showLoader, setShowLoader] = useState(true)

  useEffect(() => {
    if (isLoading) {
      setShowLoader(true)
      return
    }
    const t = setTimeout(() => setShowLoader(false), 320)
    return () => clearTimeout(t)
  }, [isLoading])

  if (showLoader) {
    return (
      <div className="relative min-h-screen">
        <ParticlesBg />
        <GameLoader
          stage={isLoading ? loadingStage : t("loaderLaunching")}
          progress={isLoading ? loadingProgress : 100}
        />
      </div>
    )
  }

  const hideNav = ["matchmaking", "result", "entry"].includes(screen)
  const showLeftSidebar = !hideNav && screen !== "bets" && platformUser != null
  const showRightSidebar = !hideNav && platformUser != null
  const showBottomNav = !hideNav && platformUser != null

  const isServerPlayer = isServerPlayerId(player.id)
  const showLowBalanceHint = platformUser != null && isServerPlayer && player.balance < 50 && !hideLowBalanceHint

  const handleLowBalanceInvite = async () => {
    try {
      const users = await showFriendsPicker()
      if (users && users.length) {
        const reward = users.length * 10
        setPlayer((p) => ({ ...p, balance: p.balance + reward }))
        setHideLowBalanceHint(true)
      }
    } catch {
      // игнорируем ошибки VK Bridge
    }
  }

  return (
    <div className="relative min-h-screen">
      <ParticlesBg />
      <BetResponseDialog />

      {showLowBalanceHint && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center">
          <div className="pointer-events-auto max-w-lg mx-auto rounded-2xl bg-slate-900/95 border border-amber-400/60 px-4 py-3 shadow-xl flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-white/90 leading-snug">{t("pageLowBalanceHint")}</p>
              <button
                type="button"
                onClick={handleLowBalanceInvite}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-amber-400 text-amber-950 px-3 py-1 text-[11px] font-bold uppercase tracking-wide hover:bg-amber-300 transition-colors"
              >
                {t("pageLowBalanceAddFriends")}
              </button>
            </div>
            <button
              type="button"
              className="ml-2 text-xs text-amber-300 hover:text-amber-100"
              onClick={() => setHideLowBalanceHint(true)}
            >
              {t("pageLowBalanceClose")}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-screen">
        {showLeftSidebar && (
          <aside className="hidden lg:flex w-64 flex-shrink-0">
            <div className="w-full sticky top-0 h-screen overflow-y-auto border-r border-border/40 bg-card/30 backdrop-blur-md">
              <BetsSidebar />
            </div>
          </aside>
        )}

        <main className="flex-1 flex justify-center min-w-0">
          <div
            className={`w-full max-w-lg mx-auto px-4 min-h-screen max-h-screen overflow-y-auto ${
              showBottomNav ? "pb-20" : ""
            }`}
          >
            <GameScreen />
          </div>
        </main>

        {showRightSidebar && (
          <aside className="hidden lg:flex w-72 flex-shrink-0">
            <div className="w-full sticky top-0 h-screen overflow-y-auto border-l border-border/40 bg-card/30 backdrop-blur-md">
              <WeeklyRanking />
            </div>
          </aside>
        )}

        {showBottomNav && <BottomNav />}
      </div>
    </div>
  )
}

export default function Page() {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "")
  const makeUrl = (file: string) => `url("${basePath}${file}")`
  type CardCssVars = CSSProperties & Record<`--${string}`, string>
  const styleVars: CardCssVars = {
    "--card-back-image": makeUrl("/card-back.webp"),
    "--card-rock-image": makeUrl("/card-rock.webp"),
    "--card-paper-image": makeUrl("/card-paper.webp"),
    "--card-scissors-image": makeUrl("/card-scissors.webp"),
    "--card-water-image": makeUrl("/card-water.png"),
    "--card-ancient-back-image": makeUrl("/000.webp"),
    "--card-ancient-rock-image": makeUrl("/001.webp"),
    "--card-ancient-scissors-image": makeUrl("/002.webp"),
    "--card-ancient-paper-image": makeUrl("/003.webp"),
    "--card-ancient-water-image": makeUrl("/card-water-ancient.png"),
  }

  return (
    <I18nProvider>
      <GameProvider>
        <div style={styleVars}>
          <GameLayout />
        </div>
      </GameProvider>
    </I18nProvider>
  )
}
