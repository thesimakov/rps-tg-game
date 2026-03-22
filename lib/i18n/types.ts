/**
 * Supported UI locales. English is the default for all non-Russian Telegram language codes.
 * Russian (`ru`) is used when the Telegram client language is Russian (RU segment).
 *
 * Additional languages (e.g. German, Spanish, Ukrainian, Turkish) are planned — add a new
 * code here, extend `resolveAppLocale`, and add a full message bundle next to `en` and `ru`.
 */
export type AppLocale = "en" | "ru"

export const SUPPORTED_LOCALES: AppLocale[] = ["en", "ru"]

/** Documented roadmap only; not used at runtime until implemented. */
export const PLANNED_LOCALES = ["de", "es", "uk", "tr", "pt"] as const
