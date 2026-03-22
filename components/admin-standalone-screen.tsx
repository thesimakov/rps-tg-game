"use client"

import { useEffect, useMemo, useState } from "react"
import type { StoredPlayer } from "@/lib/player-store"
import { ShieldAlert, ShieldCheck, RefreshCcw, Search } from "lucide-react"
import { AdminPaymentsPanel } from "@/components/admin-payments-panel"
import { useI18n } from "@/lib/i18n/context"

interface AdminPlayer extends StoredPlayer {}

interface ListResponse {
  ok: boolean
  players?: AdminPlayer[]
  error?: string
}

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {}),
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function AdminStandaloneScreen() {
  const { t } = useI18n()
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [isBusyId, setIsBusyId] = useState<string | null>(null)

  const loadPlayers = async () => {
    setIsLoading(true)
    setError(null)
    const res = await fetchJSON<ListResponse>("/api/admin/players/list")
    setIsLoading(false)
    if (!res) {
      setError(t("adminErrList"))
      return
    }
    if (!res.ok || !res.players) {
      setError(res.error === "forbidden" ? t("adminErrList403") : t("adminErrList"))
      return
    }
    setPlayers(res.players)
  }

  useEffect(() => {
    void loadPlayers()
  }, [])

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return players
    return players.filter((p) => {
      return (
        p.id.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.avatarUrl && p.avatarUrl.toLowerCase().includes(q))
      )
    })
  }, [players, search])

  const handleAction = async (id: string, action: "block" | "ban") => {
    setIsBusyId(id)
    setError(null)
    const url = action === "block" ? "/api/admin/players/block" : "/api/admin/players/ban"
    const res = await fetchJSON<{ ok: boolean; player?: AdminPlayer; error?: string }>(url, {
      method: "POST",
      body: JSON.stringify({ id }),
    })
    setIsBusyId(null)
    if (!res || !res.ok || !res.player) {
      setError(t("adminErrAction"))
      return
    }
    setPlayers((prev) => prev.map((p) => (p.id === id ? res.player! : p)))
  }

  const handleDelete = async (id: string) => {
    setIsBusyId(id)
    setError(null)
    const res = await fetchJSON<{ ok: boolean; error?: string }>("/api/admin/players/delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    })
    setIsBusyId(null)
    if (!res || !res.ok) {
      setError(t("adminErrDelete"))
      return
    }
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  const handleBackup = async () => {
    setError(null)
    const res = await fetchJSON<{ ok: boolean; error?: string }>("/api/admin/players/backup", {
      method: "POST",
      body: JSON.stringify({}),
    })
    if (!res || !res.ok) {
      setError(t("adminErrBackup"))
      return
    }
  }

  const renderStatus = (p: AdminPlayer) => {
    const status = p.status ?? "active"
    if (status === "blocked") {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300">{t("adminStatusBlocked")}</span>
    }
    if (status === "banned") {
      const now = Date.now()
      const until = typeof p.banUntil === "number" ? p.banUntil : 0
      const remainingMs = until > now ? until - now : 0
      const remainingH = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)))
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-200">
          {remainingH > 0 ? t("adminStatusBan", { hours: remainingH }) : t("adminStatusBanExpired")}
        </span>
      )
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-200">{t("adminStatusActive")}</span>
  }

  return (
    <div className="flex flex-col min-h-screen w-full py-6 bg-slate-950">
      <div className="w-full max-w-4xl mx-auto px-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              {t("adminTitle")}
            </h1>
            <p className="text-xs text-white/60 mt-0.5">
              {t("adminSubtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 flex items-center gap-2 rounded-full bg-slate-900/70 border border-slate-700 px-3 py-1.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminSearchPlaceholder")}
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadPlayers()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 text-xs text-white hover:bg-slate-700 border border-slate-600"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {t("commonRefresh")}
            </button>
            <button
              type="button"
              onClick={() => void handleBackup()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/80 text-xs text-white hover:bg-emerald-500 border border-emerald-500/70"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {t("adminBackup")}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/50 px-4 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <div className="rounded-2xl bg-slate-900/80 border border-slate-700 overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-900/90 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">{t("adminColName")}</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">{t("adminColBalance")}</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">W/L</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">{t("adminColStatus")}</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">{t("adminColActions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                      {t("adminLoading")}
                    </td>
                  </tr>
                )}
                {!isLoading && filteredPlayers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                      {t("adminEmpty")}
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  filteredPlayers.map((p) => (
                    <tr key={p.id} className="border-t border-slate-800/70">
                      <td className="px-3 py-2 text-slate-300 max-w-[180px] truncate" title={p.id}>
                        {p.id}
                      </td>
                      <td className="px-3 py-2 text-slate-200 max-w-[160px] truncate" title={p.name}>
                        {p.name}
                      </td>
                      <td className="px-3 py-2 text-slate-200 whitespace-nowrap">{p.balance}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                        {p.wins}/{p.losses}
                      </td>
                      <td className="px-3 py-2">{renderStatus(p)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col sm:flex-row gap-1">
                          <button
                            type="button"
                            disabled={isBusyId === p.id}
                            onClick={() => void handleAction(p.id, "ban")}
                            className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/50 hover:bg-amber-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {t("adminBan24")}
                          </button>
                          <button
                            type="button"
                            disabled={isBusyId === p.id}
                            onClick={() => void handleDelete(p.id)}
                            className="px-2 py-1 rounded-full bg-red-600/25 text-red-100 border border-red-500/70 hover:bg-red-600/35 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {t("adminDelete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <AdminPaymentsPanel />
      </div>
    </div>
  )
}

