import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

export interface WithdrawRequest {
  id: string
  userId: string
  amount: number
  walletAddress: string
  status: "pending" | "paid" | "rejected"
  createdAt: number
  updatedAt: number
  processedAt?: number
  txHash?: string
  rejectReason?: string
}

interface WithdrawDb {
  requests: WithdrawRequest[]
}

const DB_PATH = path.join(process.cwd(), "data", "withdraw-requests.json")

async function ensureDir() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
}

async function readDb(): Promise<WithdrawDb> {
  await ensureDir()
  try {
    const raw = await fs.readFile(DB_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<WithdrawDb>
    return { requests: parsed.requests ?? [] }
  } catch {
    return { requests: [] }
  }
}

async function writeDb(db: WithdrawDb) {
  await ensureDir()
  const tmp = `${DB_PATH}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, DB_PATH)
}

export async function createWithdrawRequest(input: {
  userId: string
  amount: number
  walletAddress: string
}): Promise<WithdrawRequest> {
  const db = await readDb()
  const now = Date.now()
  const request: WithdrawRequest = {
    id: crypto.randomUUID(),
    userId: input.userId,
    amount: Math.max(0, Math.floor(input.amount)),
    walletAddress: input.walletAddress,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  }
  db.requests.push(request)
  await writeDb(db)
  return request
}

export async function listWithdrawRequests(limit: number = 200): Promise<WithdrawRequest[]> {
  const db = await readDb()
  return [...db.requests].sort((a, b) => b.createdAt - a.createdAt).slice(0, Math.max(1, limit))
}

export async function updateWithdrawStatus(
  id: string,
  patch: {
    status: "pending" | "paid" | "rejected"
    txHash?: string
    rejectReason?: string
  }
): Promise<WithdrawRequest | null> {
  const db = await readDb()
  const idx = db.requests.findIndex((r) => r.id === id)
  if (idx < 0) return null
  const now = Date.now()
  const current = db.requests[idx]
  const updated: WithdrawRequest = {
    ...current,
    status: patch.status,
    txHash: patch.txHash ?? current.txHash,
    rejectReason: patch.rejectReason ?? current.rejectReason,
    updatedAt: now,
    processedAt: patch.status === "pending" ? current.processedAt : now,
  }
  db.requests[idx] = updated
  await writeDb(db)
  return updated
}

export function withdrawRequestsToCsv(items: WithdrawRequest[]): string {
  const header = ["id", "userId", "amount", "walletAddress", "status", "txHash", "rejectReason", "createdAt", "updatedAt", "processedAt"]
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`
  const rows = items.map((i) =>
    [
      i.id,
      i.userId,
      i.amount,
      i.walletAddress,
      i.status,
      i.txHash ?? "",
      i.rejectReason ?? "",
      i.createdAt,
      i.updatedAt,
      i.processedAt ?? "",
    ]
      .map(escape)
      .join(",")
  )
  return [header.join(","), ...rows].join("\n")
}
