import { promises as fs } from "fs"
import path from "path"
import type { LiveOpsState } from "@/lib/liveops/types"
import { isServerPlayerId } from "@/lib/platform-user"

// Серверное хранилище профиля игрока на JSON-файле.
// В проде по умолчанию файл лежит в /var/rps-data/players.json — один общий для всех деплоев.
// В разработке используем локальный файл в папке проекта (./data/players.json), чтобы не требовать прав на /var.

export type PlayerId = `tg_${number}` | string

export interface StoredPlayer {
  id: PlayerId
  name: string
  avatar: string
  avatarUrl: string
  balance: number
  wins: number
  losses: number
  weekWins: number
  weekEarnings: number
  ratingPoints?: number
  /** Очки уровня (XP), отдельные от рейтинга. */
  levelXp?: number
  totalPurchases?: number
  vip?: boolean
  fastMatchBoosts?: number
  victoryAnimation?: string
  cardSkin?: string
  cardDeck?: "ancient-rus"
  hasAncientDeck?: boolean
  avatarFrame?: string
  hasNeonFrame?: boolean
  hasGoldFrame?: boolean
  tournamentEntry?: boolean
  hideVkAvatar?: boolean
  lavaCardUses?: number
  waterCardUses?: number
  invitedFriends?: Array<{ id: number; first_name: string; last_name: string; photo_200: string } | null>
  invitedRewardClaimed?: boolean
  wallPostRewardClaimed?: boolean
  groupSubscribedRewardClaimed?: boolean
  lastDailyGiftClaimedAt?: number
  dailyRewardIndex?: number
  extraTimerUntil?: number
  /** Время последней покупки буста «Таймер +10 секунд (1 день)» (timestamp, ms) */
  timerPlus10BoughtAt?: number
  lottoNumbers?: number[]
  lottoDrawAt?: number
  lottoDrawnNumbers?: number[]
  /** Лото: момент последнего розыгрыша (timestamp). Результаты показываются 24 ч. */
  lottoDrawnAt?: number
  /** Лото: размер ожидающего приза, который игрок должен забрать вручную. */
  lottoPendingPrize?: number
  /** Лото: совпавшие числа последнего розыгрыша. */
  lottoMatchedNumbers?: number[]
  /** Приветственный бонус за первый вход уже получен */
  welcomeGiftClaimed?: boolean
  /** Сколько пользователь уже вывел за сегодня (для лимитов вывода) */
  withdrawTodayAmount?: number
  /** Дата (YYYY-MM-DD), к которой относится withdrawTodayAmount */
  withdrawTodayDate?: string
  /** Статус аккаунта: активен, заблокирован навсегда или временно забанен */
  status?: "active" | "blocked" | "banned"
  /** До какого момента действует бан (timestamp, ms). После истечения можно снова пускать в игру. */
  banUntil?: number
  /** Внутренние заметки для админки/разработчиков */
  notes?: string
  /** LiveOps: «голоса» (премиум-валюта в UI). Имя поля историческое — совместимость со старыми сохранениями. */
  vkVoicesBalance?: number
  /** Привязанный TON-кошелек для пополнения/вывода. */
  tonWalletAddress?: string
  /** Основной liveops-прогресс: daily/quests/pass/events/achievements. */
  liveOpsState?: LiveOpsState
  /** Активный титул из системы достижений (показывается рядом с ником). */
  activeTitleId?: string
  /** Ожидающая награда сундука босса для отдельного экрана получения. */
  bossChestPending?: {
    rarity: "rare" | "epic" | "legendary"
    rewardId: string
    rewardLabel: string
    rewardCoins: number
    rewardRating: number
    createdAt: number
  }
  /** Счётчик pity-system для сундуков босса. */
  bossChestPityCounter?: number
  /** История последних наград из сундуков босса (до 10 записей). */
  bossChestHistory?: Array<{
    rarity: "rare" | "epic" | "legendary"
    rewardId: string
    rewardLabel: string
    rewardCoins: number
    rewardRating: number
    openedAt: number
  }>
}

const DB_PATH =
  process.env.PLAYERS_DB_PATH ||
  (process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "data", "players.json")
    : "/var/rps-data/players.json")

function getDbPath(): string {
  return DB_PATH
}

async function ensureDir() {
  const dir = path.dirname(getDbPath())
  await fs.mkdir(dir, { recursive: true })
}

interface PlayerDb {
  players: Record<string, StoredPlayer>
}

async function readDb(): Promise<PlayerDb> {
  await ensureDir()
  try {
    const raw = await fs.readFile(getDbPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<PlayerDb>
    return { players: parsed.players ?? {} }
  } catch {
    return { players: {} }
  }
}

async function writeDb(db: PlayerDb) {
  await ensureDir()
  const tmp = `${getDbPath()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, getDbPath())
}

export function isValidPlayerId(id: string) {
  return isServerPlayerId(id)
}

export async function loadPlayer(userId: PlayerId): Promise<StoredPlayer | null> {
  const db = await readDb()
  const existing = db.players[userId]
  return existing ?? null
}

export async function savePlayer(player: StoredPlayer): Promise<StoredPlayer> {
  const db = await readDb()
  const safeId = player.id
  db.players[safeId] = {
    ...db.players[safeId],
    ...player,
    id: safeId,
  }
  await writeDb(db)
  return db.players[safeId]
}

/** Загрузить всех игроков как массив (для админки). */
export async function loadAllPlayers(): Promise<StoredPlayer[]> {
  const db = await readDb()
  return Object.values(db.players)
}

/** Поставить игроку статус и опционально banUntil/notes. */
async function setPlayerStatus(
  id: PlayerId,
  status: StoredPlayer["status"],
  options?: { banUntil?: number; notes?: string }
): Promise<StoredPlayer | null> {
  const db = await readDb()
  const existing = db.players[id]
  if (!existing) return null
  const updated: StoredPlayer = {
    ...existing,
    status,
    banUntil: options?.banUntil,
    notes: options?.notes ?? existing.notes,
  }
  db.players[id] = updated
  await writeDb(db)
  return updated
}

/** Заблокировать игрока навсегда (удаление из игры). */
export async function blockPlayer(id: PlayerId, note?: string) {
  return setPlayerStatus(id, "blocked", { banUntil: undefined, notes: note })
}

/** Забанить игрока на сутки от текущего момента. */
export async function banPlayerForOneDay(id: PlayerId, note?: string) {
  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const until = now + oneDayMs
  return setPlayerStatus(id, "banned", { banUntil: until, notes: note })
}

/** Снять блокировку/бан и вернуть игрока в активное состояние. */
export async function unblockPlayer(id: PlayerId, note?: string) {
  return setPlayerStatus(id, "active", { banUntil: undefined, notes: note })
}

/** Полностью удалить игрока из базы (без возможности восстановления, кроме как из бэкапа). */
export async function deletePlayer(id: PlayerId): Promise<boolean> {
  const db = await readDb()
  if (!db.players[id]) {
    return false
  }
  delete db.players[id]
  await writeDb(db)
  return true
}

function getBackupDir(): string {
  const dbPath = getDbPath()
  const dir = path.dirname(dbPath)
  return path.join(dir, "backups")
}

async function ensureBackupDir() {
  const dir = getBackupDir()
  await fs.mkdir(dir, { recursive: true })
}

/** Создать резервную копию players.json в подпапке backups с таймстемпом в имени. */
export async function backupDb() {
  await ensureDir()
  await ensureBackupDir()
  try {
    const raw = await fs.readFile(getDbPath(), "utf8")
    const backupDir = getBackupDir()
    const ts = new Date()
    const pad = (n: number) => n.toString().padStart(2, "0")
    const name = [
      ts.getFullYear(),
      pad(ts.getMonth() + 1),
      pad(ts.getDate()),
      "-",
      pad(ts.getHours()),
      pad(ts.getMinutes()),
      pad(ts.getSeconds()),
    ].join("")
    const backupPath = path.join(backupDir, `players-${name}.json`)
    await fs.writeFile(backupPath, raw, "utf8")
  } catch {
    // если исходного файла ещё нет — просто пропускаем
  }
}

