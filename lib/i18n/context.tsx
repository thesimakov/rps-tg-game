"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { AppLocale } from "./types"
import {
  getAutoDetectedLocale,
  getClientAppLocale,
  readSavedLocale,
  writeSavedLocale,
  clearSavedLocale,
} from "./detect"
import { en, type MsgKey } from "./copy-en"
import { ru } from "./copy-ru"

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(String(v))
  }
  return out
}

export type Translate = (key: MsgKey, vars?: Record<string, string | number>) => string

type I18nContextValue = {
  locale: AppLocale
  t: Translate
  /** Persist choice and apply immediately. */
  setLocalePreference: (locale: AppLocale) => void
  /** Remove saved choice; follow Telegram / browser again. */
  clearLocalePreference: () => void
  /** True if UI locale comes from saved preference, not auto-detect. */
  isLocaleOverridden: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() => getClientAppLocale())
  const [overridden, setOverridden] = useState(() => readSavedLocale() !== null)

  useEffect(() => {
    setLocale(getClientAppLocale())
    setOverridden(readSavedLocale() !== null)
  }, [])

  const setLocalePreference = useCallback((next: AppLocale) => {
    writeSavedLocale(next)
    setLocale(next)
    setOverridden(true)
  }, [])

  const clearLocalePreference = useCallback(() => {
    clearSavedLocale()
    setLocale(getAutoDetectedLocale())
    setOverridden(false)
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.lang = locale === "ru" ? "ru" : "en"
  }, [locale])

  const value = useMemo<I18nContextValue>(() => {
    const table = locale === "ru" ? ru : en
    return {
      locale,
      t: (key, vars) => interpolate(table[key], vars),
      setLocalePreference,
      clearLocalePreference,
      isLocaleOverridden: overridden,
    }
  }, [locale, overridden, setLocalePreference, clearLocalePreference])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider")
  return ctx
}

export function useOptionalI18n(): I18nContextValue | null {
  return useContext(I18nContext)
}
