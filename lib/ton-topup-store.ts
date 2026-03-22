import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

export type TonTopupStatus = "pending" | "confirmed" | "rejected"

export interface TonTopupRequest {
  id: string
  userId: string
  coinsAmount: number
  tonNanoAmount: string
  receiver: string
  memo: string
  status: TonTopupStatus
  txHash?: string
  rejectReason?: string
  createdAt: number
  updatedAt: number
  confirmedAt?: number
}

interface TonTopupDb {
  requests: TonTopupRequest[]
}

const DB_PATH = path.join(process.cwd(), "data", "ton-topups.json")

async function ensureDir() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
}

async function readDb(): Promise<TonTopupDb> {
  await ensureDir()
  try {
    const raw = await fs.readFile(DB_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<TonTopupDb>
    return { requests: parsed.requests ?? [] }
  } catch {
    return { requests: [] }
  }
}

async function writeDb(db: TonTopupDb) {
  await ensureDir()
  const tmp = `${DB_PATH}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, DB_PATH)
}

export async function createTonTopup(input: {
  id?: string
  userId: string
  coinsAmount: number
  tonNanoAmount: string
  receiver: string
  memo: string
}): Promise<TonTopupRequest> {
  const db = await readDb()
  const now = Date.now()
  const item: TonTopupRequest = {
    id: input.id ?? crypto.randomUUID(),
    userId: input.userId,
    coinsAmount: Math.max(0, Math.floor(input.coinsAmount)),
    tonNanoAmount: input.tonNanoAmount,
    receiver: input.receiver,
    memo: input.memo,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  }
  db.requests.push(item)
  await writeDb(db)
  return item
}

export async function getTonTopupById(id: string): Promise<TonTopupRequest | null> {
  const db = await readDb()
  return db.requests.find((r) => r.id === id) ?? null
}

export async function listTonTopups(limit: number = 200): Promise<TonTopupRequest[]> {
  const db = await readDb()
  return [...db.requests].sort((a, b) => b.createdAt - a.createdAt).slice(0, Math.max(1, limit))
}

export async function listPendingTonTopupsByUser(userId: string, limit: number = 20): Promise<TonTopupRequest[]> {
  const db = await readDb()
  return db.requests
    .filter((r) => r.userId === userId && r.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(1, limit))
}

export async function listPendingTonTopups(limit: number = 200): Promise<TonTopupRequest[]> {
  const db = await readDb()
  return db.requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(1, limit))
}

export async function updateTonTopupStatus(
  id: string,
  patch: {
    status: TonTopupStatus
    txHash?: string
    rejectReason?: string
  }
): Promise<TonTopupRequest | null> {
  const db = await readDb()
  const idx = db.requests.findIndex((r) => r.id === id)
  if (idx < 0) return null
  const existing = db.requests[idx]
  const now = Date.now()
  const next: TonTopupRequest = {
    ...existing,
    status: patch.status,
    txHash: patch.txHash ?? existing.txHash,
    rejectReason: patch.rejectReason ?? existing.rejectReason,
    updatedAt: now,
    confirmedAt: patch.status === "confirmed" ? now : existing.confirmedAt,
  }
  db.requests[idx] = next
  await writeDb(db)
  return next
}

export function tonTopupsToCsv(items: TonTopupRequest[]): string {
  const header = ["id", "userId", "coinsAmount", "tonNanoAmount", "receiver", "memo", "status", "txHash", "rejectReason", "createdAt", "updatedAt", "confirmedAt"]
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`
  const rows = items.map((i) =>
    [
      i.id,
      i.userId,
      i.coinsAmount,
      i.tonNanoAmount,
      i.receiver,
      i.memo,
      i.status,
      i.txHash ?? "",
      i.rejectReason ?? "",
      i.createdAt,
      i.updatedAt,
      i.confirmedAt ?? "",
    ]
      .map(escape)
      .join(",")
  )
  return [header.join(","), ...rows].join("\n")
}
