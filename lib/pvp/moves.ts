/** Классический онлайн-дуэльный режим: только камень / ножницы / бумага. */
export type PvpClassicMove = "rock" | "scissors" | "paper"

export function isPvpClassicMove(v: string): v is PvpClassicMove {
  return v === "rock" || v === "scissors" || v === "paper"
}

/** Исход для игрока с индексом 0 (p1). */
export function classicOutcome(p0: PvpClassicMove, p1: PvpClassicMove): "p0_win" | "p1_win" | "draw" {
  if (p0 === p1) return "draw"
  if (
    (p0 === "rock" && p1 === "scissors") ||
    (p0 === "scissors" && p1 === "paper") ||
    (p0 === "paper" && p1 === "rock")
  ) {
    return "p0_win"
  }
  return "p1_win"
}
