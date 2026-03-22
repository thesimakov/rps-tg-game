import { payoutWinner, refundDraw } from "./balance"

export async function applyPvpMatchEconomy(m: {
  bet: number
  winnerUserId: string | null
  p0: { userId: string }
  p1: { userId: string }
}): Promise<void> {
  const pot = m.bet * 2
  if (m.winnerUserId == null) {
    await refundDraw(m.p0.userId, m.p1.userId, m.bet)
  } else {
    await payoutWinner(m.winnerUserId, pot)
  }
}
