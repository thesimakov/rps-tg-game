"use client"

export interface PlatformUser {
  id: number
  first_name: string
  last_name: string
  photo_100: string
  photo_200: string
}

let bridgeReady = false

interface TelegramWebAppUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TelegramWebApp {
  ready?: () => void
  expand?: () => void
  initDataUnsafe?: { user?: TelegramWebAppUser }
  openLink?: (url: string) => void
  openTelegramLink?: (url: string) => void
}

function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null
}

export async function initPlatformBridge(): Promise<void> {
  const tg = getTelegramWebApp()
  if (!tg) {
    bridgeReady = false
    return
  }
  try {
    tg.ready?.()
    tg.expand?.()
    bridgeReady = true
  } catch {
    bridgeReady = false
  }
}

export function getBridgeReady(): boolean {
  return bridgeReady || Boolean(getTelegramWebApp())
}

export async function getPlatformUser(): Promise<PlatformUser | null> {
  const tg = getTelegramWebApp()
  const u = tg?.initDataUnsafe?.user
  if (!u?.id) return null
  return {
    id: u.id,
    first_name: u.first_name ?? u.username ?? "Игрок",
    last_name: u.last_name ?? "",
    photo_100: u.photo_url ?? "",
    photo_200: u.photo_url ?? "",
  }
}

export interface CoinPack {
  amount: number
  itemId: string
}

export const COIN_PACKS: CoinPack[] = [
  { amount: 100, itemId: "coins_100" },
  { amount: 200, itemId: "coins_200" },
  { amount: 300, itemId: "coins_300" },
  { amount: 500, itemId: "coins_500" },
  { amount: 700, itemId: "coins_700" },
  { amount: 1000, itemId: "coins_1000" },
]

export async function purchaseCoins(amount: number, options?: { transferUrl?: string; paymentMemo?: string }): Promise<boolean> {
  if (typeof window === "undefined") return false
  const pack = COIN_PACKS.find((p) => p.amount === amount)
  if (!pack) return false
  const tg = getTelegramWebApp()
  if (!tg) return false

  if (options?.transferUrl) {
    try {
      tg.openLink?.(options.transferUrl)
      return true
    } catch {
      try {
        window.open(options.transferUrl, "_blank", "noopener,noreferrer")
        return true
      } catch {
        return false
      }
    }
  }

  const tonReceiver = process.env.NEXT_PUBLIC_TON_RECEIVER ?? ""
  if (!tonReceiver) return false
  const coinsPerTon = Number(process.env.NEXT_PUBLIC_TON_COINS_PER_TON ?? "100")
  const safeRate = Number.isFinite(coinsPerTon) && coinsPerTon > 0 ? coinsPerTon : 100
  const tonAmount = amount / safeRate
  const nanoTon = Math.max(1, Math.ceil(tonAmount * 1_000_000_000))
  const text = encodeURIComponent(options?.paymentMemo?.trim() || `RPS topup ${pack.amount} coins`)
  const transferUrl = `https://app.tonkeeper.com/transfer/${encodeURIComponent(tonReceiver)}?amount=${nanoTon}&text=${text}`
  try {
    tg.openLink?.(transferUrl)
    return true
  } catch {
    try {
      window.open(transferUrl, "_blank", "noopener,noreferrer")
      return true
    } catch {
      return false
    }
  }
}

export async function requestWithdraw(
  amount: number,
  walletAddress: string
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  if (amount < 10) return { ok: false, error: "invalid_amount" }
  if (typeof window === "undefined") return { ok: false, error: "no_window" }
  if (!walletAddress.trim()) return { ok: false, error: "invalid_wallet" }

  if (!getBridgeReady()) {
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 800))
  }

  try {
    const userId = window.localStorage.getItem("rps_user_id") ?? ""
    const res = await fetch("/api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, userId, walletAddress }),
    })
    const data = (await res.json()) as { ok?: boolean; balance?: number; error?: string }
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "server_error" }
    return { ok: true, balance: typeof data.balance === "number" ? data.balance : undefined }
  } catch {
    return { ok: false, error: "network" }
  }
}

export function isMiniAppEnvironment(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(getTelegramWebApp())
}

export interface Friend {
  id: number
  first_name: string
  last_name: string
  photo_200: string
}

export async function showFriendsPicker(): Promise<Friend[] | null> {
  return []
}

export async function joinCommunity(): Promise<boolean> {
  if (typeof window === "undefined") return false
  const tg = getTelegramWebApp()
  if (!tg) return false
  const channel = (process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL ?? "").replace(/^@/, "").trim()
  if (!channel) return false
  const url = `https://t.me/${channel}`
  try {
    tg.openTelegramLink?.(url)
    return true
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
    return true
  }
}

export async function showInviteBox(): Promise<boolean> {
  if (typeof window === "undefined") return false
  const tg = getTelegramWebApp()
  if (!tg) return false
  const text = encodeURIComponent("Заходи в RPS Arena в Telegram!")
  const url = encodeURIComponent(window.location.href)
  const share = `https://t.me/share/url?url=${url}&text=${text}`
  try {
    tg.openTelegramLink?.(share)
    return true
  } catch {
    window.open(share, "_blank", "noopener,noreferrer")
    return true
  }
}
