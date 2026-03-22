import type { AppLocale } from "./types"

interface TelegramWebAppUser {
  language_code?: string
}

interface TelegramWebApp {
  initDataUnsafe?: { user?: TelegramWebAppUser }
}

function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null
}

/** Raw language tag from Telegram Mini App (e.g. `ru`, `en`, `ru-RU`). */
export function readTelegramLanguageCode(): string | undefined {
  const code = getTelegramWebApp()?.initDataUnsafe?.user?.language_code
  return typeof code === "string" && code.trim() ? code.trim() : undefined
}

export function resolveAppLocale(languageTag: string | undefined | null): AppLocale {
  if (!languageTag) return "en"
  const primary = languageTag.toLowerCase().split(/[-_]/)[0] ?? "en"
  if (primary === "ru") return "ru"
  return "en"
}

/**
 * Best-effort locale for first client paint. SSR falls back to English.
 * Telegram `language_code` wins; otherwise `navigator.language`.
 */
export function getClientAppLocale(): AppLocale {
  if (typeof window === "undefined") return "en"
  const tg = readTelegramLanguageCode()
  if (tg) return resolveAppLocale(tg)
  return resolveAppLocale(typeof navigator !== "undefined" ? navigator.language : undefined)
}
