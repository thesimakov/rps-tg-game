import { getTonTopupById, updateTonTopupStatus } from "@/lib/ton-topup-store"
import { loadPlayer, savePlayer } from "@/lib/player-store"
import { verifyTonTransaction } from "@/lib/ton-verifier"

export async function confirmTonTopupByTx(input: { requestId: string; txHash: string }) {
  const requestId = input.requestId.trim()
  const txHash = input.txHash.trim()
  if (!requestId || !txHash) {
    return { ok: false as const, status: 400, error: "invalid_payload" }
  }
  const topup = await getTonTopupById(requestId)
  if (!topup) return { ok: false as const, status: 404, error: "not_found" }
  if (topup.status === "confirmed") {
    const player = await loadPlayer(topup.userId)
    return { ok: true as const, alreadyConfirmed: true, balance: player?.balance }
  }
  if (topup.status === "rejected") return { ok: false as const, status: 409, error: "rejected" }

  const verify = await verifyTonTransaction({
    txHash,
    receiver: topup.receiver,
    expectedNanoAmount: topup.tonNanoAmount,
    expectedMemo: topup.memo,
  })
  if (!verify.ok) {
    return { ok: false as const, status: 400, error: verify.reason ?? "verify_failed" }
  }
  const player = await loadPlayer(topup.userId)
  if (!player) return { ok: false as const, status: 404, error: "player_not_found" }

  const updatedPlayer = await savePlayer({
    ...player,
    balance: player.balance + topup.coinsAmount,
    totalPurchases: (player.totalPurchases ?? 0) + topup.coinsAmount,
  })
  const updatedTopup = await updateTonTopupStatus(topup.id, { status: "confirmed", txHash })
  return {
    ok: true as const,
    credited: topup.coinsAmount,
    balance: updatedPlayer.balance,
    topup: updatedTopup,
  }
}
