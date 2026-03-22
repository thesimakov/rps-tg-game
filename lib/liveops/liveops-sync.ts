import type { StoredPlayer } from "@/lib/player-store"
import { isServerPlayerId } from "@/lib/platform-user"

/**
 * Состояние премиум-валюты LiveOps («голоса» в UI).
 * Исторически поле в сохранении называется `vkVoicesBalance` — оставлено для совместимости с уже сохранёнными профилями.
 */
export interface LiveopsSyncResult {
  voicesBalance: number
  platformIdVerified: boolean
  subscribedToChannel: boolean
}

/**
 * Синхронизация LiveOps с платформой (Telegram Mini App).
 * При необходимости сюда можно добавить вызовы бэкенда для проверки подписки на канал и т.д.
 */
export async function syncLiveopsPlatformState(player: StoredPlayer): Promise<LiveopsSyncResult> {
  const voicesBalance = Math.max(0, player.vkVoicesBalance ?? 0)
  return {
    voicesBalance,
    platformIdVerified: isServerPlayerId(player.id),
    subscribedToChannel: player.groupSubscribedRewardClaimed ?? false,
  }
}

export async function chargeLiveopsVoices(player: StoredPlayer, amount: number): Promise<StoredPlayer> {
  const safeAmount = Math.max(0, Math.floor(amount))
  const current = Math.max(0, player.vkVoicesBalance ?? 0)
  if (current < safeAmount) {
    throw new Error("insufficient_voices")
  }
  return {
    ...player,
    vkVoicesBalance: current - safeAmount,
  }
}
