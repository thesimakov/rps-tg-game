import type { MsgKey } from "./copy-en"
import type { Translate } from "./context"

/** Config JSON may ship one language; UI resolves by `mode` for all locales. */
const WEEKLY_EVENT_I18N: Record<string, { title: MsgKey; description: MsgKey }> = {
  elements_tournament: {
    title: "liveopsWeeklyElementsTitle",
    description: "liveopsWeeklyElementsDesc",
  },
  time_is_money: {
    title: "liveopsWeeklyTimeTitle",
    description: "liveopsWeeklyTimeDesc",
  },
  blind_luck: {
    title: "liveopsWeeklyBlindTitle",
    description: "liveopsWeeklyBlindDesc",
  },
  boss_week: {
    title: "liveopsWeeklyBossTitle",
    description: "liveopsWeeklyBossDesc",
  },
}

export function resolveWeeklyEventUi(
  mode: string | undefined,
  apiTitle: string,
  apiDescription: string,
  t: Translate,
): { title: string; description: string } {
  const row = mode ? WEEKLY_EVENT_I18N[mode] : undefined
  if (row) return { title: t(row.title), description: t(row.description) }
  return { title: apiTitle, description: apiDescription }
}
