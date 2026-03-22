import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"
import { isServerPlayerId } from "@/lib/platform-user"

export type ReferralUserId = `tg_${number}` | string

export interface ReferralUser {
  id: ReferralUserId
  createdAt: string
  referrerId?: ReferralUserId
}

export interface ReferralEarning {
  id: string
  createdAt: string
  claimedAt?: string
  referrerId: ReferralUserId
  referredId: ReferralUserId
  spendAmount: number
  commissionAmount: number
  reason: string
}

interface ReferralDb {
  users: Record<string, ReferralUser>
  earnings: ReferralEarning[]
}

const DB_RELATIVE_PATH = path.join("data", "referrals.json")
const COMMISSION_RATE = 0.1

function getDbPath() {
  return path.join(process.cwd(), DB_RELATIVE_PATH)
}

async function ensureDir() {
  const dir = path.dirname(getDbPath())
  await fs.mkdir(dir, { recursive: true })
}

async function readDb(): Promise<ReferralDb> {
  await ensureDir()
  try {
    const raw = await fs.readFile(getDbPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<ReferralDb>
    return {
      users: parsed.users ?? {},
      earnings: parsed.earnings ?? [],
    }
  } catch {
    return { users: {}, earnings: [] }
  }
}

async function writeDb(db: ReferralDb) {
  await ensureDir()
  const tmp = `${getDbPath()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, getDbPath())
}

export function isValidVkUserId(id: string) {
  return isServerPlayerId(id)
}

export async function upsertUser(userId: ReferralUserId) {
  const db = await readDb()
  const existing = db.users[userId]
  if (existing) return existing
  const created: ReferralUser = { id: userId, createdAt: new Date().toISOString() }
  db.users[userId] = created
  await writeDb(db)
  return created
}

export async function acceptReferral(userId: ReferralUserId, referrerId: ReferralUserId) {
  const db = await readDb()
  const user = db.users[userId] ?? { id: userId, createdAt: new Date().toISOString() }
  if (user.referrerId) {
    db.users[userId] = user
    await writeDb(db)
    return { already: true, referrerId: user.referrerId }
  }
  if (userId === referrerId) {
    db.users[userId] = user
    await writeDb(db)
    return { already: false, applied: false }
  }
  const ref = db.users[referrerId] ?? { id: referrerId, createdAt: new Date().toISOString() }
  db.users[referrerId] = ref
  db.users[userId] = { ...user, referrerId }
  await writeDb(db)
  return { applied: true, referrerId }
}

export async function recordSpend(userId: ReferralUserId, amount: number, reason: string) {
  const db = await readDb()
  const user = db.users[userId] ?? { id: userId, createdAt: new Date().toISOString() }
  db.users[userId] = user
  const referrerId = user.referrerId
  if (!referrerId) {
    await writeDb(db)
    return { commission: 0 }
  }
  const commission = Math.floor(amount * COMMISSION_RATE)
  if (commission <= 0) {
    await writeDb(db)
    return { commission: 0 }
  }
  const earning: ReferralEarning = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    referrerId,
    referredId: userId,
    spendAmount: Math.floor(amount),
    commissionAmount: commission,
    reason: (reason || "spend").slice(0, 64),
  }
  db.earnings.push(earning)
  await writeDb(db)
  return { commission }
}

export async function getStats(referrerId: ReferralUserId) {
  const db = await readDb()
  const referredCount = Object.values(db.users).filter((u) => u.referrerId === referrerId).length
  const earnings = db.earnings.filter((e) => e.referrerId === referrerId)
  const totalReferredSpend = earnings.reduce((s, e) => s + (e.spendAmount ?? 0), 0)
  const totalEarned = earnings.reduce((s, e) => s + (e.commissionAmount ?? 0), 0)
  const availableToClaim = earnings.filter((e) => !e.claimedAt).reduce((s, e) => s + (e.commissionAmount ?? 0), 0)
  const last = [...earnings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 20)
  return { referredCount, totalReferredSpend, totalEarned, availableToClaim, last }
}

export async function claim(referrerId: ReferralUserId) {
  const db = await readDb()
  let amount = 0
  const now = new Date().toISOString()
  db.earnings = db.earnings.map((e) => {
    if (e.referrerId !== referrerId) return e
    if (e.claimedAt) return e
    amount += e.commissionAmount ?? 0
    return { ...e, claimedAt: now }
  })
  await writeDb(db)
  return { amount }
}

