import { loadPlayer, savePlayer, type StoredPlayer } from "@/lib/player-store"

export async function tryDeductStake(userId: string, bet: number): Promise<StoredPlayer | null> {
  const p = await loadPlayer(userId)
  if (!p || p.balance < bet) return null
  return savePlayer({ ...p, balance: p.balance - bet })
}

export async function creditWinner(userId: string, amount: number): Promise<void> {
  const p = await loadPlayer(userId)
  if (!p) return
  await savePlayer({ ...p, balance: p.balance + amount })
}

/** Ничья: вернуть обоим ставку. */
export async function refundDraw(userIdA: string, userIdB: string, bet: number): Promise<void> {
  const a = await loadPlayer(userIdA)
  const b = await loadPlayer(userIdB)
  if (a) await savePlayer({ ...a, balance: a.balance + bet })
  if (b) await savePlayer({ ...b, balance: b.balance + bet })
}

/** Победитель забирает весь банк (оба уже заплатили по bet). */
export async function payoutWinner(winnerId: string, pot: number): Promise<void> {
  await creditWinner(winnerId, pot)
}
