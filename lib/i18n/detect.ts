import type { AppLocale } from "./types"
import { SUPPORTED_LOCALES } from "./types"

/** User-chosen UI language; if set, overrides Telegram / browser detection. */
export const LOCALE_STORAGE_KEY = "rps_ui_locale"

function isAppLocale(v: string): v is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(v)
}

export function readSavedLocale(): AppLocale | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (raw && isAppLocale(raw)) return raw
  } catch {
    // ignore
  }
  return null
}

export function writeSavedLocale(locale: AppLocale): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // ignore
  }
}

export function clearSavedLocale(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

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

/** Locale from Telegram or browser only (ignores manual save). */
export function getAutoDetectedLocale(): AppLocale {
  if (typeof window === "undefined") return "en"
  const tg = readTelegramLanguageCode()
  if (tg) return resolveAppLocale(tg)
  return resolveAppLocale(typeof navigator !== "undefined" ? navigator.language : undefined)
}

/**
 * Effective UI locale: saved choice wins, then Telegram, then browser.
 * SSR falls back to English.
 */
export function getClientAppLocale(): AppLocale {
  if (typeof window === "undefined") return "en"
  const saved = readSavedLocale()
  if (saved) return saved
  return getAutoDetectedLocale()
}
