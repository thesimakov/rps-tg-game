"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { AppLocale } from "./types"
import { getClientAppLocale, readTelegramLanguageCode, resolveAppLocale } from "./detect"
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
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() => getClientAppLocale())

  useEffect(() => {
    const fromTg = readTelegramLanguageCode()
    const next = resolveAppLocale(fromTg ?? (typeof navigator !== "undefined" ? navigator.language : undefined))
    setLocale(next)
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
    }
  }, [locale])

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
