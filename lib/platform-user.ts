const SERVER_PLAYER_PREFIXES = ["tg_"] as const

export function isServerPlayerId(id: string): boolean {
  if (!id) return false
  return SERVER_PLAYER_PREFIXES.some((prefix) => id.startsWith(prefix)) && id.length > 3
}

export function isGuestPlayerId(id: string): boolean {
  return id.startsWith("guest_")
}

export function isPersistentPlayerId(id: string): boolean {
  return isServerPlayerId(id) || isGuestPlayerId(id)
}
