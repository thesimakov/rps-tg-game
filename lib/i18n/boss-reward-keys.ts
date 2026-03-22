import type { MsgKey } from "./copy-en"

/** Maps persisted boss chest `rewardId` to UI message keys. */
export const BOSS_REWARD_LABEL_KEY: Record<string, MsgKey> = {
  rare_obsidian_rock: "bossSkinRareObsidian",
  rare_phantom_scissors: "bossSkinRarePhantom",
  epic_aurora_paper: "bossSkinEpicAurora",
  epic_solar_blade: "bossSkinEpicSolar",
  legendary_void_hand: "bossSkinLegendaryVoid",
}
