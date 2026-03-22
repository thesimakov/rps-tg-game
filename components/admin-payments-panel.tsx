"use client"

import { useEffect, useState } from "react"
import type { WithdrawRequest } from "@/lib/withdraw-store"
import type { TonTopupRequest } from "@/lib/ton-topup-store"
import { Download, RefreshCcw } from "lucide-react"

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

async function downloadWithAuth(url: string, filenamePrefix: string) {
  const res = await fetch(url, {
    headers: ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {},
    cache: "no-store",
  })
  if (!res.ok) return false
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = `${filenamePrefix}-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
  return true
}

export function AdminPaymentsPanel() {
  const [topups, setTopups] = useState<TonTopupRequest[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string>("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [topupsRes, withdrawalsRes] = await Promise.all([
        fetchJSON<{ ok: boolean; topups?: TonTopupRequest[] }>("/api/admin/ton-topups/list"),
        fetchJSON<{ ok: boolean; withdrawals?: WithdrawRequest[] }>("/api/admin/withdrawals/list"),
      ])
      if (!topupsRes?.ok || !withdrawalsRes?.ok) {
        setError("Не удалось загрузить платежи/выплаты.")
        return
      }
      setTopups(topupsRes.topups ?? [])
      setWithdrawals(withdrawalsRes.withdrawals ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const confirmTopup = async (item: TonTopupRequest) => {
    const txHash = window.prompt("Введите TX hash для подтверждения платежа", item.txHash ?? "")
    if (!txHash) return
    setBusyId(item.id)
    setError("")
    const res = await fetchJSON<{ ok: boolean; error?: string; topup?: TonTopupRequest }>("/api/admin/ton-topups/confirm", {
      method: "POST",
      body: JSON.stringify({ requestId: item.id, txHash }),
    })
    setBusyId(null)
    if (!res?.ok) {
      setError("Не удалось подтвердить top-up.")
      return
    }
    await load()
  }

  const rejectTopup = async (item: TonTopupRequest) => {
    const reason = window.prompt("Причина отклонения", "manual_reject") ?? "manual_reject"
    setBusyId(item.id)
    setError("")
    const res = await fetchJSON<{ ok: boolean }>("/api/admin/ton-topups/reject", {
      method: "POST",
      body: JSON.stringify({ requestId: item.id, reason }),
    })
    setBusyId(null)
    if (!res?.ok) {
      setError("Не удалось отклонить top-up.")
      return
    }
    await load()
  }

  const setWithdrawalStatus = async (item: WithdrawRequest, status: "paid" | "rejected") => {
    let txHash = ""
    let rejectReason = ""
    if (status === "paid") {
      txHash = window.prompt("TX hash выплаты", item.txHash ?? "") ?? ""
      if (!txHash.trim()) return
    } else {
      rejectReason = window.prompt("Причина отклонения", item.rejectReason ?? "manual_reject") ?? "manual_reject"
    }
    setBusyId(item.id)
    setError("")
    const res = await fetchJSON<{ ok: boolean }>("/api/admin/withdrawals/update", {
      method: "POST",
      body: JSON.stringify({ id: item.id, status, txHash, rejectReason }),
    })
    setBusyId(null)
    if (!res?.ok) {
      setError("Не удалось обновить статус выплаты.")
      return
    }
    await load()
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white/90">TON платежи и выводы</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 text-xs text-white border border-slate-600"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/50 px-3 py-2 text-xs text-red-100">{error}</div>}

      <div className="rounded-2xl bg-slate-900/80 border border-slate-700 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-200">TOP-UP журнал (TON)</p>
          <button
            type="button"
            onClick={() => void downloadWithAuth("/api/admin/ton-topups/export", "ton-topups")}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-slate-600 text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
        <div className="max-h-64 overflow-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-slate-900/90 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left text-slate-300">ID</th>
                <th className="px-2 py-2 text-left text-slate-300">User</th>
                <th className="px-2 py-2 text-left text-slate-300">Coins</th>
                <th className="px-2 py-2 text-left text-slate-300">Status</th>
                <th className="px-2 py-2 text-left text-slate-300">TX</th>
                <th className="px-2 py-2 text-left text-slate-300">Действия</th>
              </tr>
            </thead>
            <tbody>
              {topups.map((t) => (
                <tr key={t.id} className="border-t border-slate-800/70">
                  <td className="px-2 py-2 text-slate-300 max-w-[120px] truncate">{t.id}</td>
                  <td className="px-2 py-2 text-slate-200 max-w-[110px] truncate">{t.userId}</td>
                  <td className="px-2 py-2 text-slate-200">{t.coinsAmount}</td>
                  <td className="px-2 py-2 text-slate-200">{t.status}</td>
                  <td className="px-2 py-2 text-slate-400 max-w-[120px] truncate">{t.txHash ?? "-"}</td>
                  <td className="px-2 py-2">
                    {t.status === "pending" ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => void confirmTopup(t)}
                          className="px-2 py-1 rounded bg-emerald-600/30 border border-emerald-500/60 text-emerald-100"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => void rejectTopup(t)}
                          className="px-2 py-1 rounded bg-red-600/30 border border-red-500/60 text-red-100"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {topups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-center text-slate-400">
                    Нет top-up записей
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900/80 border border-slate-700 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-200">Выплаты (журнал)</p>
          <button
            type="button"
            onClick={() => void downloadWithAuth("/api/admin/withdrawals/export", "withdrawals")}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-slate-600 text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
        <div className="max-h-64 overflow-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-slate-900/90 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left text-slate-300">ID</th>
                <th className="px-2 py-2 text-left text-slate-300">User</th>
                <th className="px-2 py-2 text-left text-slate-300">Amount</th>
                <th className="px-2 py-2 text-left text-slate-300">Wallet</th>
                <th className="px-2 py-2 text-left text-slate-300">Status</th>
                <th className="px-2 py-2 text-left text-slate-300">TX hash</th>
                <th className="px-2 py-2 text-left text-slate-300">Действия</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-slate-800/70">
                  <td className="px-2 py-2 text-slate-300 max-w-[120px] truncate">{w.id}</td>
                  <td className="px-2 py-2 text-slate-200 max-w-[110px] truncate">{w.userId}</td>
                  <td className="px-2 py-2 text-slate-200">{w.amount}</td>
                  <td className="px-2 py-2 text-slate-400 max-w-[140px] truncate">{w.walletAddress}</td>
                  <td className="px-2 py-2 text-slate-200">{w.status}</td>
                  <td className="px-2 py-2 text-slate-400 max-w-[120px] truncate">{w.txHash ?? "-"}</td>
                  <td className="px-2 py-2">
                    {w.status === "pending" ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={busyId === w.id}
                          onClick={() => void setWithdrawalStatus(w, "paid")}
                          className="px-2 py-1 rounded bg-emerald-600/30 border border-emerald-500/60 text-emerald-100"
                        >
                          Paid
                        </button>
                        <button
                          type="button"
                          disabled={busyId === w.id}
                          onClick={() => void setWithdrawalStatus(w, "rejected")}
                          className="px-2 py-1 rounded bg-red-600/30 border border-red-500/60 text-red-100"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-center text-slate-400">
                    Нет заявок на вывод
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
