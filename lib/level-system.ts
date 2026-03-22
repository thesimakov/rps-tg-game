import type { AppLocale } from "@/lib/i18n/types"
import { getLevelName, getLevelPerk } from "@/lib/i18n/level-copy"

export const LEVEL_STEP_XP = 100
export const MAX_LEVEL = 30
export const MAX_LEVEL_XP = LEVEL_STEP_XP * MAX_LEVEL

export interface LevelMeta {
  level: number
  name: string
  perk: string
}

export function getLevelMetaForLevel(level: number, locale: AppLocale = "en"): LevelMeta {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  return {
    level: L,
    name: getLevelName(locale, L),
    perk: getLevelPerk(locale, L),
  }
}

export function clampLevelXp(xp: number): number {
  if (!Number.isFinite(xp)) return 0
  return Math.max(0, Math.min(MAX_LEVEL_XP, Math.floor(xp)))
}

export function getLevelFromXp(levelXp: number): number {
  const xp = clampLevelXp(levelXp)
  return Math.min(MAX_LEVEL, Math.floor(xp / LEVEL_STEP_XP) + 1)
}

export function getLevelMeta(levelXp: number, locale: AppLocale = "en"): LevelMeta {
  return getLevelMetaForLevel(getLevelFromXp(levelXp), locale)
}

export function getDailyBonusPercent(levelXp: number): number {
  const level = getLevelFromXp(levelXp)
  if (level >= 29) return 30
  if (level >= 26) return 28
  if (level >= 23) return 26
  if (level >= 20) return 24
  if (level >= 17) return 22
  if (level >= 14) return 20
  if (level >= 11) return 18
  if (level >= 8) return 15
  if (level >= 5) return 10
  if (level >= 2) return 5
  return 0
}

export function getShopDiscountPercent(levelXp: number): number {
  const level = getLevelFromXp(levelXp)
  if (level >= 30) return 20
  if (level >= 27) return 16
  if (level >= 24) return 14
  if (level >= 21) return 12
  if (level >= 18) return 11
  if (level >= 15) return 10
  if (level >= 13) return 9
  if (level >= 9) return 8
  if (level >= 6) return 5
  if (level >= 4) return 3
  return 0
}

export function getRankBoostExtra(levelXp: number): number {
  const level = getLevelFromXp(levelXp)
  if (level >= 28) return 120
  if (level >= 25) return 110
  if (level >= 22) return 100
  if (level >= 19) return 90
  if (level >= 16) return 80
  if (level >= 12) return 60
  if (level >= 7) return 40
  if (level >= 3) return 20
  return 0
}

export function getDiscountedPrice(basePrice: number, levelXp: number): number {
  const discount = getShopDiscountPercent(levelXp)
  if (discount <= 0) return basePrice
  return Math.max(1, Math.floor(basePrice * (1 - discount / 100)))
}
