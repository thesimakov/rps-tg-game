export interface VerifyTonTxInput {
  txHash: string
  receiver: string
  expectedNanoAmount: string
  expectedMemo: string
}

export interface VerifyTonTxResult {
  ok: boolean
  reason?: string
}

function normalizeHash(hash: string): string {
  return hash.trim().toLowerCase().replace(/^0x/, "")
}

function includesAll(haystack: string, needles: string[]): boolean {
  const source = haystack.toLowerCase()
  return needles.every((n) => source.includes(n.toLowerCase()))
}

export async function verifyTonTransaction(input: VerifyTonTxInput): Promise<VerifyTonTxResult> {
  const hash = normalizeHash(input.txHash)
  if (!hash) return { ok: false, reason: "invalid_hash" }

  const token = process.env.TONAPI_API_KEY ?? ""
  if (!token) return { ok: false, reason: "no_tonapi_key" }

  try {
    const res = await fetch(`https://tonapi.io/v2/blockchain/transactions/${encodeURIComponent(hash)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })
    if (!res.ok) {
      return { ok: false, reason: "tx_not_found" }
    }

    const payload = await res.json()
    const blob = JSON.stringify(payload)
    const looksLikeMatch = includesAll(blob, [input.receiver, input.expectedMemo, input.expectedNanoAmount])
    if (!looksLikeMatch) {
      return { ok: false, reason: "tx_mismatch" }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: "verify_failed" }
  }
}

export async function findTonTxHashByMemo(input: {
  receiver: string
  expectedNanoAmount: string
  expectedMemo: string
  maxEvents?: number
}): Promise<string | null> {
  const token = process.env.TONAPI_API_KEY ?? ""
  if (!token) return null
  const maxEvents = Math.max(1, Math.min(100, input.maxEvents ?? 30))
  try {
    const res = await fetch(
      `https://tonapi.io/v2/accounts/${encodeURIComponent(input.receiver)}/events?limit=${maxEvents}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    )
    if (!res.ok) return null
    const payload = (await res.json()) as { events?: Array<{ event_id?: string; actions?: unknown[] }> }
    for (const event of payload.events ?? []) {
      const blob = JSON.stringify(event)
      if (!includesAll(blob, [input.expectedMemo, input.expectedNanoAmount])) continue
      const eventId = event.event_id
      if (typeof eventId === "string" && eventId.trim()) {
        return eventId
      }
    }
    return null
  } catch {
    return null
  }
}
