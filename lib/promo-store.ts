import { promises as fs } from "fs"
import path from "path"

export type PromoUserId = `tg_${number}` | string

export type PromoRewardKind = "rubles" | "fast_match" | "lava_card" | "water_card"

export interface PromoReward {
  kind: PromoRewardKind
  amount?: number
}

export interface PromoCodeEntry {
  code: string
  reward: PromoReward
  maxUses: number
  usedBy: PromoUserId[]
}

interface PromoDb {
  codes: PromoCodeEntry[]
}

const DB_RELATIVE_PATH = path.join("data", "promocodes.json")

function getDbPath() {
  return path.join(process.cwd(), DB_RELATIVE_PATH)
}

async function ensureDir() {
  const dir = path.dirname(getDbPath())
  await fs.mkdir(dir, { recursive: true })
}

async function readDb(): Promise<PromoDb> {
  await ensureDir()
  try {
    const raw = await fs.readFile(getDbPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<PromoDb>
    return {
      codes: parsed.codes ?? [],
    }
  } catch {
    return { codes: [] }
  }
}

async function writeDb(db: PromoDb) {
  await ensureDir()
  const tmp = `${getDbPath()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, getDbPath())
}

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "")
}

export async function redeemPromoCode(userId: PromoUserId, rawCode: string) {
  const code = normalizePromoCode(rawCode)
  if (!code) {
    return { ok: false as const, error: "empty" as const }
  }
  const db = await readDb()
  const entry = db.codes.find((c) => normalizePromoCode(c.code) === code)
  if (!entry) {
    return { ok: false as const, error: "not_found" as const }
  }
  if (entry.usedBy.includes(userId)) {
    return { ok: false as const, error: "already_used" as const }
  }
  if (entry.maxUses > 0 && entry.usedBy.length >= entry.maxUses) {
    return { ok: false as const, error: "limit_reached" as const }
  }

  entry.usedBy.push(userId)
  await writeDb(db)
  return { ok: true as const, reward: entry.reward }
}

