"use client"

import { useState } from "react"
import { AdminStandaloneScreen } from "@/components/admin-standalone-screen"
import { I18nProvider, useI18n } from "@/lib/i18n/context"

const EXPECTED_LOGIN = "admin-lemnity"
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN

export default function AdminLemnityPage() {
  return (
    <I18nProvider>
      <AdminLemnityLogin />
    </I18nProvider>
  )
}

function AdminLemnityLogin() {
  const { t } = useI18n()
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!ADMIN_TOKEN) {
      setError(t("adminLemnityTokenMissing"))
      return
    }
    if (login !== EXPECTED_LOGIN || password !== ADMIN_TOKEN) {
      setError(t("adminLemnityBadCreds"))
      return
    }
    setAuthed(true)
  }

  if (authed) {
    return <AdminStandaloneScreen />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900/95 border border-slate-700 p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-white text-center">Admin Lemnity</h1>
          <p className="mt-1 text-xs text-slate-300 text-center">
            {t("adminLemnityOnlyDevs")}
          </p>
        </div>
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/60 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">{t("adminLemnityLoginLabel")}</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin-lemnity"
              className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">{t("adminLemnityPasswordLabel")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </div>
          <button
            type="submit"
            className="mt-2 w-full py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
          >
            {t("adminLemnitySignIn")}
          </button>
        </form>
      </div>
    </div>
  )
}
