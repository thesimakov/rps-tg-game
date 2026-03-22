"use client"

import { useGame } from "@/lib/game-context"
import { LogIn, Trophy, Coins, Ticket } from "lucide-react"
import { useEffect, useState } from "react"
import { isServerPlayerId } from "@/lib/platform-user"
import { useI18n } from "@/lib/i18n/context"

export function EntryScreen() {
  const { t, locale, setLocalePreference, clearLocalePreference, isLocaleOverridden } = useI18n()
  const { setScreen, loginWithPlatform, loginAsGuest, loginErrorMessage } = useGame()
  const [showInviteCode, setShowInviteCode] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [inviteStatus, setInviteStatus] = useState<"idle" | "saved" | "error">("idle")
  const [inviteError, setInviteError] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = window.localStorage.getItem("rps_pending_ref_code") ?? ""
    if (saved) {
      setInviteCode(saved)
      setShowInviteCode(true)
      setInviteStatus("saved")
    }
  }, [])

  const normalizeCode = (raw: string) => raw.trim().replace(/\s+/g, "")

  const handleSaveInviteCode = () => {
    const code = normalizeCode(inviteCode)
    if (!code) {
      if (typeof window !== "undefined") window.localStorage.removeItem("rps_pending_ref_code")
      setInviteStatus("idle")
      setInviteError("")
      return
    }
    if (!isServerPlayerId(code)) {
      setInviteStatus("error")
      setInviteError(t("entryInviteInvalid"))
      return
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rps_pending_ref_code", code)
    }
    setInviteStatus("saved")
    setInviteError("")
  }

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center px-4 py-8 bg-transparent">
      <div className="w-full max-w-sm flex flex-col items-center gap-10">
        {/* Крупный логотип над всеми кнопками */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center">
            <img
              src="/logo.webp"
              alt="RPS Arena"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-white/70 text-sm">{t("entryTagline")}</p>
        </div>

        <div className="w-full max-w-sm">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/45 mb-2">
            {t("entryLanguage")}
          </p>
          <div className="flex rounded-2xl border border-white/15 bg-white/[0.04] p-1 gap-1">
            <button
              type="button"
              onClick={() => setLocalePreference("en")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                locale === "en"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-white/75 hover:bg-white/10"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocalePreference("ru")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                locale === "ru"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-white/75 hover:bg-white/10"
              }`}
            >
              Русский
            </button>
          </div>
          {isLocaleOverridden && (
            <button
              type="button"
              onClick={() => clearLocalePreference()}
              className="mt-2 w-full text-center text-[11px] text-white/45 hover:text-white/70 underline-offset-2 hover:underline"
            >
              {t("entryLangAuto")}
            </button>
          )}
        </div>

        <div className="w-full flex flex-col gap-4">
          {loginErrorMessage && (
            <div className="w-full rounded-2xl bg-red-500/15 border border-red-500/60 px-4 py-3 text-xs text-red-100 font-medium">
              {loginErrorMessage}
            </div>
          )}
          <button
            type="button"
            onClick={() => loginWithPlatform()}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-primary/30"
          >
            <LogIn className="h-6 w-6" />
            {t("entryLogin")}
          </button>

          {/* Код приглашения (ввод до входа, применится после авторизации) */}
          <div className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => { setShowInviteCode((v) => !v); setInviteStatus("idle"); setInviteError("") }}
              className="w-full flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
                <Ticket className="h-4 w-4 text-amber-400" />
                {t("entryInviteCode")}
              </span>
              <span
                className={`w-10 h-6 rounded-full border transition-colors ${
                  showInviteCode ? "bg-emerald-500/30 border-emerald-400/60" : "bg-white/10 border-white/15"
                }`}
                aria-hidden
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform mt-0.5 ${
                    showInviteCode ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>

            {showInviteCode && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value); setInviteStatus("idle"); setInviteError("") }}
                    placeholder={t("entryInvitePlaceholder")}
                    className="flex-1 min-w-0 rounded-xl bg-slate-900/40 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/60"
                  />
                  <button
                    type="button"
                    onClick={handleSaveInviteCode}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-amber-950 font-bold text-sm"
                  >
                    {t("commonSave")}
                  </button>
                </div>
                {inviteStatus === "saved" && (
                  <p className="mt-2 text-xs font-bold text-emerald-300">{t("entryInviteSaved")}</p>
                )}
                {inviteStatus === "error" && (
                  <p className="mt-2 text-xs font-bold text-red-300">{inviteError}</p>
                )}
                <p className="mt-2 text-[11px] text-white/60 leading-snug">
                  {t("entryInviteHintPrefix")}{" "}
                  <span className="font-bold">{t("entryInviteOnce")}</span> {t("entryInviteHintSuffix")}
                </p>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-white/50">{t("entryFooter")}</p>

          <button
            onClick={() => setScreen("leaderboard")}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-card/80 border border-border/50 hover:bg-card text-foreground font-semibold transition-all active:scale-[0.98]"
          >
            <Trophy className="h-5 w-5 text-amber-400" />
            {t("entryLeaders")}
          </button>

          <button
            onClick={() => setScreen("bets")}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-card/80 border border-border/50 hover:bg-card text-foreground font-semibold transition-all active:scale-[0.98]"
          >
            <Coins className="h-5 w-5 text-accent" />
            {t("entryBets")}
          </button>

          <button
            type="button"
            onClick={loginAsGuest}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-white/5 border border-white/20 hover:bg-white/10 text-white/90 font-semibold transition-all active:scale-[0.98]"
          >
            {t("entryGuest")}
          </button>
          <p className="text-center text-[10px] text-white/40 leading-snug px-1">{t("futureLanguagesNote")}</p>
        </div>
      </div>
    </div>
  )
}
