"use client"

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react"
import { initPlatformBridge, getPlatformUser, getBridgeReady, type PlatformUser } from "@/lib/platform-bridge"
import { useI18n } from "@/lib/i18n/context"
import { getClientAppLocale } from "@/lib/i18n/detect"
import type { AppLocale } from "@/lib/i18n/types"
import { getBotProfiles } from "@/lib/i18n/bots"
import type { LiveOpsState } from "@/lib/liveops/types"
import { clampLevelXp, getRankBoostExtra } from "@/lib/level-system"
import { isServerPlayerId } from "@/lib/platform-user"

export type Move = "rock" | "scissors" | "paper" | "water" | "fire"
export type WeeklyMode = "elements_tournament" | "time_is_money" | "blind_luck" | "boss_week"
export type GameScreen =
  | "entry"
  | "menu"
  | "levels"
  | "bet-select"
  | "matchmaking"
  | "arena"
  | "result"
  | "boss-reward"
  | "leaderboard"
  | "profile"
  | "referral"
  | "shop"
  | "bets"
  | "admin"

export interface Player {
  id: string
  name: string
  avatar: string
  avatarUrl: string
  balance: number
  wins: number
  losses: number
  weekWins: number
  weekEarnings: number
  /** Рейтинговые бонусы (очки), полученные за победы */
  ratingPoints?: number
  /** Очки уровня (XP), отдельные от рейтинга и бустов рейтинга. */
  levelXp?: number
  /** Суммарные покупки монет за всё время (для банка турнира сезона) */
  totalPurchases?: number
  vip: boolean
  /** Осталось матчей с приоритетом поиска (покупка «Быстрый поиск») */
  fastMatchBoosts?: number
  /** Анимация при победе: "fire" и т.д. */
  victoryAnimation?: string
  /** Скин карт: "gold" и т.д. */
  cardSkin?: string
  /** Набор карт: "ancient-rus" и т.д. */
  cardDeck?: "ancient-rus"
  /** Купленные наборы карт (для сохранения доступа к темам) */
  hasAncientDeck?: boolean
  /** Рамка аватара: "neon" и т.д. */
  avatarFrame?: string
  /** Рамка «Неон» куплена */
  hasNeonFrame?: boolean
  /** Рамка «Золото» куплена */
  hasGoldFrame?: boolean
  /** Участие в турнире дня */
  tournamentEntry?: boolean
  /** Скрыть внешний аватар (купили за 100 монет) */
  hideVkAvatar?: boolean
  /** Карта «Лава»: осталось использований (5 за покупку) */
  lavaCardUses?: number
  /** Карта «Вода»: осталось использований (3 за покупку). Побеждает камень, проигрывает бумаге, ничья с ножницами. */
  waterCardUses?: number
  /** Таймер в бою +10 секунд до указанного времени (timestamp, ms) */
  extraTimerUntil?: number
  /** Время последней покупки буста «Таймер +10 секунд (1 день)» (timestamp, ms) */
  timerPlus10BoughtAt?: number
  /** Приглашённые друзья (до 4 слотов). Когда друг принимает приглашение — появляется в ячейке. */
  invitedFriends?: Array<{ id: number; first_name: string; last_name: string; photo_200: string } | null>
  /** Награда 100 монет за 4 приглашённых друга уже получена */
  invitedRewardClaimed?: boolean
  /** Награда 100 монет за пост «расскажи друзьям» уже получена */
  wallPostRewardClaimed?: boolean
  /** Награда за подписку на канал уже получена */
  groupSubscribedRewardClaimed?: boolean
  /** Время последнего получения ежедневного подарка (timestamp). Следующий доступен через 24 ч. */
  lastDailyGiftClaimedAt?: number
  /** Индекс текущего дня в цепочке ежедневных наград (0..6). */
  dailyRewardIndex?: number
  /** Лото: выбранные игроком числа (1..99, максимум 10 штук), действуют 3 дня. */
  lottoNumbers?: number[]
  /** Лото: момент, когда должен состояться розыгрыш (timestamp, ms). */
  lottoDrawAt?: number
  /** Лото: выпавшие числа в последнем розыгрыше. */
  lottoDrawnNumbers?: number[]
  /** Лото: момент проведения последнего розыгрыша (timestamp). Результаты висят сутки. */
  lottoDrawnAt?: number
  /** Лото: размер ожидающего приза, который игрок должен забрать кнопкой. */
  lottoPendingPrize?: number
  /** Лото: совпавшие числа последнего розыгрыша (для подсветки и объяснения результата). */
  lottoMatchedNumbers?: number[]
  /** Приветственный бонус за первый вход уже получен */
  welcomeGiftClaimed?: boolean
  /** Внутренний баланс платформенной валюты. */
  vkVoicesBalance?: number
  /** Привязанный TON-кошелек для вывода/пополнения. */
  tonWalletAddress?: string
  /** Полный прогресс liveops (daily/quests/pass/events/achievements). */
  liveOpsState?: LiveOpsState
  /** Активный титул игрока, показывается возле ника в матчах. */
  activeTitleId?: string
  /** Выбранный режим события для следующего матча. */
  activeWeeklyMode?: WeeklyMode
  /** Ожидающая награда за победу над боссом. */
  bossChestPending?: {
    rarity: "rare" | "epic" | "legendary"
    rewardId: string
    rewardLabel: string
    rewardCoins: number
    rewardRating: number
    createdAt: number
  }
  /** Счётчик pity-system: сколько сундуков подряд без legendary. */
  bossChestPityCounter?: number
  /** История последних наград из сундуков босса (до 10). */
  bossChestHistory?: Array<{
    rarity: "rare" | "epic" | "legendary"
    rewardId: string
    rewardLabel: string
    rewardCoins: number
    rewardRating: number
    openedAt: number
  }>
}

export interface WeeklyRules {
  event: {
    mode: WeeklyMode
    title: string
    description: string
  }
  allowedMoves: Move[]
  hideOpponentBet: boolean
  autoStakeDoubleEveryRounds: number
  hasBossNpc: boolean
}

export interface LeaderboardEntry {
  rank: number
  id: string
  name: string
  avatar: string
  avatarUrl: string
  wins: number
  earnings: number
  vip: boolean
  isPlayer?: boolean
}

/** Режим ставки: разово (удаляется после игры) или держать 1 час */
export type BetDuration = "once" | "1h"

/** URL аватарки робота — фото живых людей (RandomUser), один seed → одно и то же лицо */
export const BOT_AVATAR_URL = (seed: string) => {
  const num = parseInt(seed.replace(/\D/g, ""), 10) || 0
  const portraitId = (num % 99) + 1
  const gender = num % 2 ? "women" : "men"
  return `https://randomuser.me/api/portraits/${gender}/${portraitId}.jpg`
}

/** Ставка от другого игрока или своя (в списке) */
export interface BetEntry {
  id: string
  creatorId: string
  creatorName: string
  creatorAvatar: string
  creatorWins: number
  amount: number
  createdAt: number
  /** Если задано — ставка скрывается после этого времени (режим «1 час») */
  expiresAt?: number
  /** ВИП-игрок — такие ставки всегда сверху */
  vip?: boolean
  /** Имитация жизни: ставка робота исчезает в этот момент (рандом ~15 сек от появления) */
  botExpiresAt?: number
  /** Аватарка создателя (для роботов — картинка, для своих — не задаётся) */
  creatorAvatarUrl?: string
}

/** Созданная пользователем ставка в ожидании отклика */
export interface PendingBet {
  id: string
  amount: number
  createdAt: number
}

/** Отклик на ставку — показать модалку принять/отклонить */
export interface BetResponse {
  id: string
  betId: string
  responderId: string
  responderName: string
  responderAvatar: string
  responderWins: number
  amount: number
}

export interface MatchRoundSummary {
  round: number
  playerMove: Move
  opponentMove: Move
  outcome: "win" | "loss" | "draw"
}

export interface MatchResult {
  playerMove: Move | null
  opponentMove: Move | null
  outcome: "win" | "loss" | "draw"
  earnings: number
  bet: number
  /** Бонусные очки рейтинга за матч */
  bonus: number
  /** Все раунды матча (для отображения истории ходов на экране результата) */
  rounds?: MatchRoundSummary[]
}

interface GameState {
  screen: GameScreen
  setScreen: (s: GameScreen) => void
  player: Player
  setPlayer: React.Dispatch<React.SetStateAction<Player>>
  opponent: Player | null
  setOpponent: React.Dispatch<React.SetStateAction<Player | null>>
  currentBet: number
  setCurrentBet: (b: number) => void
  lastResult: MatchResult | null
  setLastResult: React.Dispatch<React.SetStateAction<MatchResult | null>>
  leaderboard: LeaderboardEntry[]
  playerRank: number
  /** Тренд рейтинга: вырос — зелёный, упал — красный */
  rankTrend: "up" | "down" | null
  leaderboardVersion: number
  /** Покупка буста рейтинга: 250 монет → +100 к недельным очкам */
  purchaseRankBoost: () => boolean
  platformUser: PlatformUser | null
  /** Войти через Telegram Mini App */
  loginWithPlatform: () => Promise<void>
  /** Войти локально гостем */
  loginAsGuest: () => void
  /** Выйти из аккаунта — возврат на экран входа */
  logout: () => void
  isLoading: boolean
  loadingStage: string
  loadingProgress: number
  /** Сообщение об ошибке входа (бан/блок), отображается на экране входа */
  loginErrorMessage: string | null
  bets: BetEntry[]
  pendingBet: PendingBet | null
  betResponse: BetResponse | null
  createBet: (amount: number, duration?: BetDuration) => void
  removeBet: (betId: string) => void
  /** Изменить размер активной ставки (только если есть pendingBet) */
  updatePendingBetAmount: (newAmount: number) => boolean
  acceptBetResponse: () => void
  declineBetResponse: () => void
  clearPendingBet: () => void
  /** Количество ходов в матче: 1 (быстрая игра), 3 или 5 */
  totalRounds: 1 | 3 | 5
  setTotalRounds: (n: 1 | 3 | 5) => void
  /** Горячая новинка: карта «Лава», остаток в наличии (3 штуки всего) */
  lavaCardStock: number
  purchaseLavaCard: () => boolean
  purchaseWaterCard: () => boolean
  /** Учитывать «траты» для реферальной программы (начисление 10% рефереру) */
  trackSpend: (amount: number, reason: string) => void
  /** Для отображения: числовое значение баланса (можно переопределить формат) */
  toDisplayAmount: (amount: number) => number
  /** Подпись валюты (например, "монет") */
  currencyLabel: string
  weeklyRules: WeeklyRules | null
  /** Роботы для ставок и матчмейкинга (имена на языке клиента) */
  opponents: Player[]
}

const GameContext = createContext<GameState | null>(null)

/** Детерминированные значения по индексу (без Math.random/Date.now), чтобы SSR и клиент совпадали при гидратации */
function buildBotsForLocale(locale: AppLocale): Player[] {
  const profiles = getBotProfiles(locale)
  return profiles.map((b, i) => {
    const id = `bot-${i}`
    const wins = 10 + (i * 17) % 90
    return {
      id,
      name: b.name,
      avatar: b.avatar,
      avatarUrl: BOT_AVATAR_URL(id),
      balance: 300 + (i * 37) % 1000,
      wins,
      losses: 5 + (i * 11) % 50,
      weekWins: Math.floor(wins / 3),
      weekEarnings: 50 + (i * 23) % 400,
      vip: b.vip,
    }
  })
}

function buildLeaderboardFromBots(bots: Player[]): Omit<LeaderboardEntry, "rank">[] {
  return bots.map((b, i) => ({
    id: `lb-${b.id}`,
    name: b.name,
    avatar: b.avatar,
    avatarUrl: b.avatarUrl,
    wins: b.wins + (i * 7) % 20,
    earnings: b.weekEarnings * 8 + (i * 13) % 500,
    vip: b.vip,
  }))
}

/** Базовая метка времени для createdAt (фиксированная, чтобы не ломать гидратацию) */
const MOCK_BETS_BASE_TIME = 1000000000000

function buildMockBetsFromBots(bots: Player[]): BetEntry[] {
  return bots.slice(0, 20).map((b, i) => ({
    id: `bet-${b.id}-${i}`,
    creatorId: b.id,
    creatorName: b.name,
    creatorAvatar: b.avatar,
    creatorAvatarUrl: b.avatarUrl,
    creatorWins: b.wins,
    amount: [25, 50, 100, 150, 200][i % 5],
    createdAt: MOCK_BETS_BASE_TIME - (i + 1) * 60000,
    vip: b.vip,
  }))
}

/** В блоке ставок всегда показывать минимум столько слотов; недостающее заполнять роботами */
export const MIN_BETS_DISPLAY = 10

const BET_AMOUNTS = [25, 50, 100, 150, 200]

/** Генерирует доп. ставки роботов для отображения (только для списка, не в state). */
export function getFillerBetEntries(count: number, bots: Player[]): BetEntry[] {
  if (count <= 0 || bots.length === 0) return []
  const base = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const bot = bots[i % bots.length]
    return {
      id: `filler-${i}-${bot.id}`,
      creatorId: bot.id,
      creatorName: bot.name,
      creatorAvatar: bot.avatar,
      creatorAvatarUrl: bot.avatarUrl,
      creatorWins: bot.wins,
      amount: BET_AMOUNTS[i % BET_AMOUNTS.length],
      createdAt: base - (i + 1) * 1000,
      vip: bot.vip,
    }
  })
}

/** Интервал обновления рейтинга — каждые 30 секунд (видно изменение очков и мест) */
const LEADERBOARD_UPDATE_MS = 30 * 1000

/** Сохранение в localStorage: версия для совместимости при будущих обновлениях */
const SAVE_STORAGE_KEY = "rps_save"
const SAVE_VERSION = 2
const BRIDGE_INIT_TIMEOUT_MS = 6000
const AUTH_RESOLVE_TIMEOUT_MS = 7000

async function postJSON<T = unknown>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function deriveInitialLevelXp(player: Pick<Player, "levelXp" | "ratingPoints">): number {
  if (typeof player.levelXp === "number") return clampLevelXp(player.levelXp)
  return clampLevelXp(player.ratingPoints ?? 0)
}

function toStoredPlayer(player: Player): import("./player-store").StoredPlayer {
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    avatarUrl: player.avatarUrl,
    balance: player.balance,
    wins: player.wins,
    losses: player.losses,
    weekWins: player.weekWins,
    weekEarnings: player.weekEarnings,
    ratingPoints: player.ratingPoints,
    levelXp: player.levelXp,
    totalPurchases: player.totalPurchases,
    vip: player.vip,
    fastMatchBoosts: player.fastMatchBoosts,
    victoryAnimation: player.victoryAnimation,
    cardSkin: player.cardSkin,
    cardDeck: player.cardDeck,
    hasAncientDeck: player.hasAncientDeck,
    avatarFrame: player.avatarFrame,
    hasNeonFrame: player.hasNeonFrame,
    hasGoldFrame: player.hasGoldFrame,
    tournamentEntry: player.tournamentEntry,
    hideVkAvatar: player.hideVkAvatar,
    lavaCardUses: player.lavaCardUses,
    waterCardUses: player.waterCardUses,
    invitedFriends: player.invitedFriends,
    invitedRewardClaimed: player.invitedRewardClaimed,
    wallPostRewardClaimed: player.wallPostRewardClaimed,
    groupSubscribedRewardClaimed: player.groupSubscribedRewardClaimed,
    lastDailyGiftClaimedAt: player.lastDailyGiftClaimedAt,
    dailyRewardIndex: player.dailyRewardIndex,
    extraTimerUntil: player.extraTimerUntil,
    timerPlus10BoughtAt: player.timerPlus10BoughtAt,
    lottoNumbers: player.lottoNumbers,
    lottoDrawAt: player.lottoDrawAt,
    lottoDrawnNumbers: player.lottoDrawnNumbers,
    lottoDrawnAt: player.lottoDrawnAt,
    lottoPendingPrize: player.lottoPendingPrize,
    lottoMatchedNumbers: player.lottoMatchedNumbers,
    welcomeGiftClaimed: player.welcomeGiftClaimed,
    vkVoicesBalance: player.vkVoicesBalance,
    tonWalletAddress: player.tonWalletAddress,
    liveOpsState: player.liveOpsState,
    activeTitleId: player.activeTitleId,
    bossChestPending: player.bossChestPending,
    bossChestPityCounter: player.bossChestPityCounter,
    bossChestHistory: player.bossChestHistory,
  }
}

const DEFAULT_PLAYER: Player = {
  id: "player1",
  name: "Player",
  avatar: "P",
  avatarUrl: "",
  balance: 0,
  wins: 0,
  losses: 0,
  weekWins: 0,
  weekEarnings: 0,
  vip: false,
  ratingPoints: 0,
  levelXp: 0,
  totalPurchases: 0,
  groupSubscribedRewardClaimed: false,
  cardDeck: undefined,
  hasAncientDeck: false,
  hasNeonFrame: false,
  hasGoldFrame: false,
  extraTimerUntil: undefined,
  timerPlus10BoughtAt: undefined,
  welcomeGiftClaimed: false,
  vkVoicesBalance: 0,
  liveOpsState: undefined,
  activeTitleId: undefined,
  activeWeeklyMode: undefined,
  bossChestPending: undefined,
  bossChestPityCounter: 0,
  bossChestHistory: [],
}

function loadSavedState(): {
  player: Player
  lavaCardStock: number
} | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { version?: number; player?: Partial<Player>; lavaCardStock?: number }
    if (!data || (data.version != null && data.version > SAVE_VERSION)) return null
    // Если сохранение относится к серверному аккаунту, не восстанавливаем прогресс из localStorage —
    // для таких игроков источником правды является сервер (API /api/player/load/save).
    const isVkPlayer = typeof data.player?.id === "string" && isServerPlayerId(data.player.id)
    const hasWelcomeGiftFlag = typeof data.player?.welcomeGiftClaimed === "boolean"
    let player: Player = isVkPlayer ? { ...DEFAULT_PLAYER } : { ...DEFAULT_PLAYER, ...data.player }
    player = { ...player, levelXp: deriveInitialLevelXp(player) }
    // Миграция старого состояния: раньше стартовый баланс был 100.
    // Если бонус ещё не помечен как полученный и это "чистый" профиль, переводим старт обратно в 0.
    if (
      !hasWelcomeGiftFlag &&
      player.balance === 100 &&
      player.wins === 0 &&
      player.losses === 0 &&
      player.weekWins === 0 &&
      (player.totalPurchases ?? 0) === 0
    ) {
      player = { ...player, balance: 0, welcomeGiftClaimed: false }
    }
    const lavaCardStock = typeof data.lavaCardStock === "number" ? Math.max(0, data.lavaCardStock) : 3
    return { player, lavaCardStock }
  } catch {
    return null
  }
}

function saveState(player: Player, lavaCardStock: number) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        player: {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          avatarUrl: player.avatarUrl,
          balance: player.balance,
          wins: player.wins,
          losses: player.losses,
          weekWins: player.weekWins,
          weekEarnings: player.weekEarnings,
          vip: player.vip,
          ratingPoints: player.ratingPoints,
          levelXp: player.levelXp,
          totalPurchases: player.totalPurchases,
          fastMatchBoosts: player.fastMatchBoosts,
          victoryAnimation: player.victoryAnimation,
          cardSkin: player.cardSkin,
          cardDeck: player.cardDeck,
          hasAncientDeck: player.hasAncientDeck,
          avatarFrame: player.avatarFrame,
          hasNeonFrame: player.hasNeonFrame,
          hasGoldFrame: player.hasGoldFrame,
          tournamentEntry: player.tournamentEntry,
          hideVkAvatar: player.hideVkAvatar,
          lavaCardUses: player.lavaCardUses,
          waterCardUses: player.waterCardUses,
          invitedFriends: player.invitedFriends,
          invitedRewardClaimed: player.invitedRewardClaimed,
          wallPostRewardClaimed: player.wallPostRewardClaimed,
          groupSubscribedRewardClaimed: player.groupSubscribedRewardClaimed,
          lastDailyGiftClaimedAt: player.lastDailyGiftClaimedAt,
          dailyRewardIndex: player.dailyRewardIndex,
          extraTimerUntil: player.extraTimerUntil,
          timerPlus10BoughtAt: player.timerPlus10BoughtAt,
          lottoNumbers: player.lottoNumbers,
          lottoDrawAt: player.lottoDrawAt,
          lottoDrawnNumbers: player.lottoDrawnNumbers,
          lottoDrawnAt: player.lottoDrawnAt,
          lottoPendingPrize: player.lottoPendingPrize,
          lottoMatchedNumbers: player.lottoMatchedNumbers,
          welcomeGiftClaimed: player.welcomeGiftClaimed,
          vkVoicesBalance: player.vkVoicesBalance,
          tonWalletAddress: player.tonWalletAddress,
          liveOpsState: player.liveOpsState,
          activeTitleId: player.activeTitleId,
          activeWeeklyMode: player.activeWeeklyMode,
          bossChestPending: player.bossChestPending,
          bossChestPityCounter: player.bossChestPityCounter,
          bossChestHistory: player.bossChestHistory,
        },
        lavaCardStock,
      })
    )
  } catch {
    // ignore
  }
}

function shuffleEarnings(entries: Omit<LeaderboardEntry, "rank">[]): Omit<LeaderboardEntry, "rank">[] {
  return entries.map((e) => ({
    ...e,
    earnings: Math.max(0, e.earnings + Math.floor((Math.random() - 0.5) * 80)),
    wins: Math.max(0, e.wins + Math.floor((Math.random() - 0.5) * 4)),
  }))
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n()
  const opponents = useMemo(() => buildBotsForLocale(locale), [locale])

  const [screen, setScreen] = useState<GameScreen>("entry")
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null)
  const [bridgeInitialized, setBridgeInitialized] = useState(false)
  const [authResolved, setAuthResolved] = useState(false)
  const [bridgeTimedOut, setBridgeTimedOut] = useState(false)
  const [authTimedOut, setAuthTimedOut] = useState(false)
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null)
  const [player, setPlayer] = useState<Player>(DEFAULT_PLAYER)
  const [opponent, setOpponent] = useState<Player | null>(null)
  const [currentBet, setCurrentBet] = useState(5)
  const [lastResult, setLastResult] = useState<MatchResult | null>(null)
  const [bets, setBets] = useState<BetEntry[]>(() => buildMockBetsFromBots(buildBotsForLocale(getClientAppLocale())))
  const [pendingBet, setPendingBet] = useState<PendingBet | null>(null)
  const [betResponse, setBetResponse] = useState<BetResponse | null>(null)
  const [leaderboardVersion, setLeaderboardVersion] = useState(0)
  const [totalRounds, setTotalRounds] = useState<1 | 3 | 5>(1)
  const [lavaCardStock, setLavaCardStock] = useState(3)
  const [weeklyRules, setWeeklyRules] = useState<WeeklyRules | null>(null)
  const [hasLoadedSave, setHasLoadedSave] = useState(false)
  const leaderboardDataRef = useRef(buildLeaderboardFromBots(buildBotsForLocale(getClientAppLocale())).map((e) => ({ ...e })))

  useEffect(() => {
    leaderboardDataRef.current = buildLeaderboardFromBots(opponents).map((e) => ({ ...e }))
    setBets(buildMockBetsFromBots(opponents))
  }, [opponents])

  const betResponseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Таймер: через 1 мин без принятия ставки робот подхватывает, если сумма ≤ 100 */
  const botAutoAcceptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBetRef = useRef<PendingBet | null>(null)
  useEffect(() => {
    pendingBetRef.current = pendingBet
  }, [pendingBet])
  const lastBotBetAddedRef = useRef(0)
  const screenRef = useRef<GameScreen>("entry")

  // Динамика ставок: у роботов botExpiresAt ~15 сек, потом ставка исчезает и список подтягивается; периодически добавляется новая
  useEffect(() => {
    const now = Date.now()
    setBets((prev) =>
      prev.map((b) => {
        if (b.botExpiresAt != null || b.creatorId === player.id) return b
        return { ...b, botExpiresAt: now + 10000 + Math.random() * 10000 }
      })
    )
  }, [player.id])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setBets((prev) => {
        let next = prev.filter((b) => !b.botExpiresAt || b.botExpiresAt > now)
        if (now - lastBotBetAddedRef.current >= 8000 + Math.random() * 10000) {
          lastBotBetAddedRef.current = now
          const r = opponents[Math.floor(Math.random() * opponents.length)]
          const amounts = [25, 50, 100, 150, 200]
          const newBet: BetEntry = {
            id: `bet-bot-${now}-${Math.floor(Math.random() * 1000)}`,
            creatorId: r.id,
            creatorName: r.name,
            creatorAvatar: r.avatar,
            creatorAvatarUrl: r.avatarUrl,
            creatorWins: r.wins,
            amount: amounts[Math.floor(Math.random() * amounts.length)],
            createdAt: now,
            vip: r.vip,
            botExpiresAt: now + 10000 + Math.random() * 10000,
          }
          next = [newBet, ...next]
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [opponents])

  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  // Загрузка сохранённых данных (совместимость с будущими версиями: новые поля берутся из дефолтов)
  useEffect(() => {
    const saved = loadSavedState()
    if (saved) {
      setPlayer(saved.player)
      setLavaCardStock(saved.lavaCardStock)
    }
    setHasLoadedSave(true)
  }, [])

  // Сохранение в localStorage при изменении игрока и остатка карты «Лава»
  useEffect(() => {
    if (!hasLoadedSave) return
    saveState(player, lavaCardStock)
  }, [hasLoadedSave, player, lavaCardStock])

  // Синхронизация прогресса серверного пользователя с бэкендом.
  useEffect(() => {
    if (!hasLoadedSave) return
    if (!platformUser) return
    const userId = player.id
    if (!userId || !isServerPlayerId(userId)) return

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      void postJSON("/api/player/save", { player: toStoredPlayer(player) })
    }, 1500)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [hasLoadedSave, platformUser, player])

  // Загружаем серверные weekly-правила события.
  useEffect(() => {
    let active = true
    const loadWeeklyRules = async () => {
      const res = await postJSON<{ ok: boolean; rules?: WeeklyRules }>("/api/liveops/weekly-rules", {})
      if (!active || !res?.ok || !res.rules) return
      setWeeklyRules(res.rules)
      setPlayer((p) => ({
        ...p,
        activeWeeklyMode: p.activeWeeklyMode ?? res.rules!.event.mode,
      }))
    }
    void loadWeeklyRules()
    return () => {
      active = false
    }
  }, [setPlayer])

  // Инициализация bridge мини-приложения.
  useEffect(() => {
    let active = true
    let settled = false
    const timeout = setTimeout(() => {
      if (!active || settled) return
      settled = true
      setBridgeTimedOut(true)
      setBridgeInitialized(true)
    }, BRIDGE_INIT_TIMEOUT_MS)

    void initPlatformBridge().finally(() => {
      if (!active || settled) return
      settled = true
      clearTimeout(timeout)
      setBridgeInitialized(true)
    })

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [])

  const trackSpend = useCallback(
    (amount: number, reason: string) => {
      if (!platformUser) return
      const userId = player.id
      if (!userId || !isServerPlayerId(userId)) return
      if (!Number.isFinite(amount) || amount <= 0) return
      void postJSON("/api/referrals/spend", { userId, amount: Math.floor(amount), reason })
    },
    [player.id, platformUser]
  )

  const hydratePlatformPlayer = useCallback(async (user: PlatformUser) => {
    const platformId = `tg_${user.id}`
    setPlatformUser(user)
    setPlayer((p) => ({
      ...p,
      id: platformId,
      name: user.first_name,
      avatar: user.first_name.charAt(0).toUpperCase(),
      avatarUrl: user.photo_200 || user.photo_100 || "",
      hideVkAvatar: p.hideVkAvatar ?? false,
    }))

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("rps_user_id", platformId)
      } catch {
        // ignore
      }
      try {
        window.dispatchEvent(new Event("rps_login_success"))
      } catch {
        // ignore
      }
    }

    const res = await postJSON<{ ok: boolean; exists?: boolean; player?: import("./player-store").StoredPlayer; error?: string; banUntil?: number }>(
      "/api/player/load",
      { userId: platformId }
    )
    if (!res) return
    if (!res.ok) {
      if (res.error === "blocked") {
        setLoginErrorMessage(t("loginErrorBlocked"))
      } else if (res.error === "banned") {
        const until = res.banUntil ? new Date(res.banUntil) : null
        const formatted = until
          ? until.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""
        setLoginErrorMessage(
          t("loginErrorBannedPrefix") + (formatted ? t("loginErrorBannedUntil", { date: formatted }) : "") + t("loginErrorBannedSuffix")
        )
      }
      return
    }
    if (res.player) {
      const serverPlayer = res.player
      setPlayer((p) => ({
        ...p,
        ...serverPlayer,
        levelXp: deriveInitialLevelXp({ levelXp: serverPlayer.levelXp, ratingPoints: serverPlayer.ratingPoints }),
      }))
      return
    }
    void postJSON("/api/player/save", {
      player: toStoredPlayer({
        ...DEFAULT_PLAYER,
        id: platformId,
        name: user.first_name,
        avatar: user.first_name.charAt(0).toUpperCase(),
        avatarUrl: user.photo_200 || user.photo_100 || "",
      }),
    })
  }, [locale, t])

  // Реферальная привязка: если открыли ссылку с ?ref=tg_123 — привязать реферера один раз.
  useEffect(() => {
    if (!platformUser) return
    const userId = player.id
    if (!userId || !isServerPlayerId(userId)) return
    if (typeof window === "undefined") return

    const key = `rps_ref_applied_${userId}`
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    const pendingCode = (window.localStorage.getItem("rps_pending_ref_code") ?? "").trim()

    const referrerIdFromCode = pendingCode && isServerPlayerId(pendingCode) && pendingCode !== userId ? pendingCode : ""

    const validRefFromUrl = ref && isServerPlayerId(ref) && ref !== userId ? ref : ""

    // Если уже помечали applied, но есть "pending code" — всё равно пробуем (на случай, когда пользователь
    // сначала заходил без кода, а потом ввёл код на экране входа).
    if (window.localStorage.getItem(key) === "1" && !referrerIdFromCode) return

    const referrerIdToApply = validRefFromUrl || referrerIdFromCode
    if (!referrerIdToApply) {
      // всё равно создаём запись пользователя
      void postJSON("/api/referrals/upsert", { userId }).then(() => {
        window.localStorage.setItem(key, "1")
      })
      return
    }

    void postJSON("/api/referrals/accept", { userId, referrerId: referrerIdToApply })
      .then((r) => {
        const err = (r as { error?: string } | null)?.error
        if (err === "no_server") return
        window.localStorage.removeItem("rps_pending_ref_code")
        window.localStorage.setItem(key, "1")
      })
      .finally(() => {
        void postJSON("/api/referrals/upsert", { userId })
      })
  }, [player.id, platformUser])

  const loginWithBridge = useCallback(async () => {
    const user = await getPlatformUser()
    if (!user) return
    await hydratePlatformPlayer(user)
    setScreen("menu")
  }, [hydratePlatformPlayer])

  useEffect(() => {
    if (!bridgeInitialized) return
    if (platformUser) {
      setAuthResolved(true)
      return
    }
    if (!getBridgeReady()) {
      setAuthResolved(true)
      return
    }

    let active = true
    let settled = false
    const authFallbackTimer = setTimeout(() => {
      if (!active || settled) return
      settled = true
      setAuthTimedOut(true)
      setAuthResolved(true)
    }, AUTH_RESOLVE_TIMEOUT_MS)
    void loginWithBridge().finally(() => {
      if (!active || settled) return
      settled = true
      clearTimeout(authFallbackTimer)
      setAuthResolved(true)
    })
    return () => {
      clearTimeout(authFallbackTimer)
      active = false
    }
  }, [bridgeInitialized, platformUser, loginWithBridge])

  const isLoading = !hasLoadedSave || !bridgeInitialized || !authResolved
  const loadingStage =
    bridgeTimedOut || authTimedOut
      ? t("loadingMiniappFallback")
      : !hasLoadedSave
        ? t("loadingSaves")
        : !bridgeInitialized
          ? t("loadingPlatform")
          : !authResolved
            ? t("loadingAuth")
            : t("loaderLaunching")
  const loadingProgress = !hasLoadedSave ? 25 : !bridgeInitialized ? 50 : !authResolved ? 75 : 100

  const loginWithPlatform = useCallback(async () => {
    await loginWithBridge()
  }, [loginWithBridge])

  const loginAsGuest = useCallback(() => {
    const gn = t("guestName")
    setLoginErrorMessage(null)
    setPlatformUser({
      id: 0,
      first_name: gn,
      last_name: "",
      photo_100: "",
      photo_200: "",
    })
    setPlayer((p) => ({
      ...p,
      id: p.id && !isServerPlayerId(p.id) ? p.id : "guest_player",
      name: p.name || gn,
      avatar: (p.name || gn).charAt(0).toUpperCase(),
      avatarUrl: "",
    }))
    setScreen("menu")
  }, [t])

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("rps_user_id")
      } catch {
        // ignore
      }
    }
    setPlatformUser(null)
    setLoginErrorMessage(null)
    const pn = t("playerDefaultName")
    setPlayer((p) => ({ ...p, id: "player1", name: pn, avatar: pn.charAt(0).toUpperCase(), avatarUrl: "" }))
    setScreen("entry")
  }, [t])

  const pickRandomOpponent = useCallback(() => {
    const idx = Math.floor(Math.random() * opponents.length)
    setOpponent(opponents[idx])
  }, [opponents])

  const handleSetScreen = useCallback(
    (s: GameScreen) => {
      if (s === "matchmaking") {
        pickRandomOpponent()
      }
      setScreen(s)
    },
    [pickRandomOpponent]
  )

  // Динамический рейтинг: обновление каждые 30 минут с анимацией
  const [displayLeaderboard, setDisplayLeaderboard] = useState<LeaderboardEntry[]>(() => {
    const playerEntry: Omit<LeaderboardEntry, "rank"> = {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      avatarUrl: player.avatarUrl,
      wins: player.wins,
      earnings: player.weekEarnings ?? 0,
      vip: player.vip,
      isPlayer: true,
    }
    const all = [...leaderboardDataRef.current, playerEntry].sort((a, b) => b.earnings - a.earnings)
    return all.map((e, i) => ({ ...e, rank: i + 1 }))
  })

  const updateLeaderboardData = useCallback(() => {
    const playerEntry: Omit<LeaderboardEntry, "rank"> = {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      avatarUrl: player.avatarUrl,
      wins: player.wins,
      earnings: player.weekEarnings ?? 0,
      vip: player.vip,
      isPlayer: true,
    }
    const base = leaderboardDataRef.current.filter((e) => e.id !== player.id)
    const shuffled = shuffleEarnings(base)
    leaderboardDataRef.current = shuffled
    const all = [...shuffled, playerEntry].sort((a, b) => b.earnings - a.earnings)
    const ranked: LeaderboardEntry[] = all.map((e, i) => ({ ...e, rank: i + 1 }))
    setDisplayLeaderboard(ranked)
    setLeaderboardVersion((v) => v + 1)
  }, [player.id, player.name, player.avatar, player.avatarUrl, player.wins, player.weekEarnings, player.vip])

  useEffect(() => {
    const playerEntry: Omit<LeaderboardEntry, "rank"> = {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      avatarUrl: player.avatarUrl,
      wins: player.wins,
      earnings: player.weekEarnings ?? 0,
      vip: player.vip,
      isPlayer: true,
    }
    const base = leaderboardDataRef.current.filter((e) => e.id !== player.id)
    const all = [...base, playerEntry].sort((a, b) => b.earnings - a.earnings)
    setDisplayLeaderboard(all.map((e, i) => ({ ...e, rank: i + 1 })))
  }, [player.wins, player.weekEarnings, player.id, player.name, player.avatar, player.avatarUrl, player.vip])

  useEffect(() => {
    const t = setInterval(updateLeaderboardData, LEADERBOARD_UPDATE_MS)
    return () => clearInterval(t)
  }, [updateLeaderboardData])

  const { leaderboard, playerRank } = useMemo(() => {
    const pRank = displayLeaderboard.findIndex((e) => e.isPlayer) + 1
    return { leaderboard: displayLeaderboard, playerRank: pRank || displayLeaderboard.length + 1 }
  }, [displayLeaderboard])

  const rankTrendRef = useRef<{ rank: number; earnings: number } | null>(null)
  const [rankTrend, setRankTrend] = useState<"up" | "down" | null>(null)
  useEffect(() => {
    const earnings = player.weekEarnings ?? 0
    const prev = rankTrendRef.current
    if (prev === null) {
      rankTrendRef.current = { rank: playerRank, earnings }
      setRankTrend(null)
      return
    }
    if (playerRank < prev.rank || earnings > prev.earnings) setRankTrend("up")
    else if (playerRank > prev.rank || earnings < prev.earnings) setRankTrend("down")
    else setRankTrend(null)
    rankTrendRef.current = { rank: playerRank, earnings }
  }, [playerRank, player.weekEarnings])

  // Прогресс уровня отдельно от рейтинга: начисляем XP за матчи.
  // Победа = +30 XP, поражение = +12 XP.
  const xpProgressRef = useRef<{ id: string; wins: number; losses: number } | null>(null)
  useEffect(() => {
    const snapshot = xpProgressRef.current
    if (!snapshot || snapshot.id !== player.id) {
      xpProgressRef.current = { id: player.id, wins: player.wins, losses: player.losses }
      if (typeof player.levelXp !== "number") {
        setPlayer((p) => ({ ...p, levelXp: deriveInitialLevelXp(p) }))
      }
      return
    }

    const winDelta = Math.max(0, player.wins - snapshot.wins)
    const lossDelta = Math.max(0, player.losses - snapshot.losses)
    xpProgressRef.current = { id: player.id, wins: player.wins, losses: player.losses }
    if (winDelta === 0 && lossDelta === 0) return

    const xpGain = winDelta * 30 + lossDelta * 12
    setPlayer((p) => ({ ...p, levelXp: clampLevelXp((p.levelXp ?? deriveInitialLevelXp(p)) + xpGain) }))
  }, [player.id, player.wins, player.losses, player.levelXp, setPlayer])

  const purchaseRankBoost = useCallback(() => {
    const cost = 250
    const bonus = 100 + getRankBoostExtra(player.levelXp ?? 0)
    if (player.balance < cost) return false
    trackSpend(cost, "rank-boost")
    setPlayer((p) => ({
      ...p,
      balance: p.balance - cost,
      ratingPoints: Math.min(1000, (p.ratingPoints ?? 0) + bonus),
    }))
    return true
  }, [player.balance, player.levelXp, trackSpend])

  const BOT_AUTO_ACCEPT_AFTER_MS = 30 * 1000

  const createBet = useCallback(
    (amount: number, duration: BetDuration = "once") => {
      if (player.balance < amount) return
      if (betResponseTimeoutRef.current) {
        clearTimeout(betResponseTimeoutRef.current)
        betResponseTimeoutRef.current = null
      }
      if (botAutoAcceptTimeoutRef.current) {
        clearTimeout(botAutoAcceptTimeoutRef.current)
        botAutoAcceptTimeoutRef.current = null
      }
      const now = Date.now()
      const id = `pending-${now}`
      setPendingBet({ id, amount, createdAt: now })
      const expiresAt = duration === "1h" ? now + 60 * 60 * 1000 : undefined
      const myBet: BetEntry = {
        id,
        creatorId: player.id,
        creatorName: player.name,
        creatorAvatar: player.avatar,
        creatorWins: player.wins,
        amount,
        createdAt: now,
        expiresAt,
        vip: player.vip,
      }
      setBets((prev) => [myBet, ...prev])
      const r = opponents[Math.floor(Math.random() * opponents.length)]
      const responseId = `resp-${Date.now()}`
      const hasLivePlayers = Math.random() < 0.7
      const delayMs = hasLivePlayers ? 2500 : BOT_AUTO_ACCEPT_AFTER_MS
      betResponseTimeoutRef.current = setTimeout(() => {
        betResponseTimeoutRef.current = null
        setBetResponse({
          id: responseId,
          betId: id,
          responderId: r.id,
          responderName: r.name,
          responderAvatar: r.avatar,
          responderWins: r.wins,
          amount,
        })
      }, delayMs)
      // Через 30 секунд, если ставку не приняли — робот подхватывает сам.
      const scheduleBotAutoAccept = (delayMs: number) => {
        botAutoAcceptTimeoutRef.current = setTimeout(() => {
          const current = pendingBetRef.current
          if (!current || current.id !== id) return

          const currentScreen = screenRef.current
          // Если игрок в этот момент играет — ждём завершения игры.
          if (currentScreen === "arena" || currentScreen === "matchmaking") {
            scheduleBotAutoAccept(10 * 1000)
            return
          }

          botAutoAcceptTimeoutRef.current = null
          if (betResponseTimeoutRef.current) {
            clearTimeout(betResponseTimeoutRef.current)
            betResponseTimeoutRef.current = null
          }
          const bot = opponents[Math.floor(Math.random() * opponents.length)]
          setOpponent({
            ...bot,
            balance: 500,
            weekWins: Math.floor(bot.wins / 2),
            weekEarnings: amount * 5,
          })
          setCurrentBet(amount)
          setBets((prev) => prev.filter((b) => b.id !== id))
          setPendingBet(null)
          setBetResponse(null)
          setTotalRounds(1)
          setScreen("arena")
        }, delayMs)
      }

      scheduleBotAutoAccept(BOT_AUTO_ACCEPT_AFTER_MS)
    },
    [player.balance, player.id, player.name, player.avatar, player.wins, opponents, setScreen, setOpponent, setCurrentBet, setTotalRounds]
  )

  const removeBet = useCallback((betId: string) => {
    setBets((prev) => prev.filter((b) => b.id !== betId))
  }, [])

  const MIN_BET_AMOUNT = 5
  const updatePendingBetAmount = useCallback(
    (newAmount: number) => {
      if (!pendingBet || newAmount < MIN_BET_AMOUNT) return false
      const diff = newAmount - pendingBet.amount
      if (diff === 0) return true
      if (diff > 0 && player.balance < newAmount) return false
      setPendingBet((p) => (p ? { ...p, amount: newAmount } : null))
      setBets((prev) =>
        prev.map((b) => (b.id === pendingBet.id ? { ...b, amount: newAmount } : b))
      )
      return true
    },
    [pendingBet, player.balance]
  )

  // Очистка таймера отклика и ожидающей ставки только при переходе на экраны,
  // где список ставок точно не нужен. На menu/bets/bet-select/arena ставка должна оставаться.
  const screensThatClearPendingBet: GameScreen[] = []
  useEffect(() => {
    if (screensThatClearPendingBet.includes(screen)) {
      if (betResponseTimeoutRef.current) {
        clearTimeout(betResponseTimeoutRef.current)
        betResponseTimeoutRef.current = null
      }
      if (botAutoAcceptTimeoutRef.current) {
        clearTimeout(botAutoAcceptTimeoutRef.current)
        botAutoAcceptTimeoutRef.current = null
      }
      if (pendingBet) {
        setBets((prev) => prev.filter((b) => b.id !== pendingBet.id))
        setPendingBet(null)
        setBetResponse(null)
      }
    }
    return () => {
      if (betResponseTimeoutRef.current) {
        clearTimeout(betResponseTimeoutRef.current)
        betResponseTimeoutRef.current = null
      }
      if (botAutoAcceptTimeoutRef.current) {
        clearTimeout(botAutoAcceptTimeoutRef.current)
        botAutoAcceptTimeoutRef.current = null
      }
    }
  }, [screen, pendingBet])

  const acceptBetResponse = useCallback(() => {
    if (!betResponse) return
    if (botAutoAcceptTimeoutRef.current) {
      clearTimeout(botAutoAcceptTimeoutRef.current)
      botAutoAcceptTimeoutRef.current = null
    }
    setBets((prev) => prev.filter((b) => b.id !== betResponse.betId))
    const bot = opponents.find((o) => o.id === betResponse.responderId)
    setOpponent(
      bot
        ? { ...bot, balance: 500, weekWins: Math.floor(betResponse.responderWins / 2), weekEarnings: betResponse.amount * 5 }
        : {
            id: betResponse.responderId,
            name: betResponse.responderName,
            avatar: betResponse.responderAvatar,
            avatarUrl: BOT_AVATAR_URL(betResponse.responderId),
            balance: 500,
            wins: betResponse.responderWins,
            losses: 20,
            weekWins: Math.floor(betResponse.responderWins / 2),
            weekEarnings: betResponse.amount * 5,
            vip: false,
          }
    )
    setCurrentBet(betResponse.amount)
    setBetResponse(null)
    setPendingBet(null)
    setTotalRounds(1)
    setScreen("arena")
  }, [betResponse, opponents, setScreen, setOpponent, setCurrentBet, setTotalRounds])

  const declineBetResponse = useCallback(() => {
    if (!betResponse) return
    if (botAutoAcceptTimeoutRef.current) {
      clearTimeout(botAutoAcceptTimeoutRef.current)
      botAutoAcceptTimeoutRef.current = null
    }
    setBetResponse(null)
    setPendingBet(null)
  }, [betResponse])

  const clearPendingBet = useCallback(() => {
    if (botAutoAcceptTimeoutRef.current) {
      clearTimeout(botAutoAcceptTimeoutRef.current)
      botAutoAcceptTimeoutRef.current = null
    }
    if (pendingBet) {
      setBets((prev) => prev.filter((b) => b.id !== pendingBet.id))
    }
    setPendingBet(null)
    setBetResponse(null)
  }, [pendingBet])

  const LAVA_CARD_PRICE = 120_000
  const purchaseLavaCard = useCallback(() => {
    if (lavaCardStock <= 0 || player.balance < LAVA_CARD_PRICE) return false
    trackSpend(LAVA_CARD_PRICE, "lava-card")
    setLavaCardStock((s) => s - 1)
    setPlayer((p) => ({
      ...p,
      balance: p.balance - LAVA_CARD_PRICE,
      lavaCardUses: (p.lavaCardUses ?? 0) + 5,
    }))
    return true
  }, [lavaCardStock, player.balance, trackSpend])

  const WATER_CARD_PRICE = 500
  const purchaseWaterCard = useCallback(() => {
    if (player.balance < WATER_CARD_PRICE) return false
    trackSpend(WATER_CARD_PRICE, "water-card")
    setPlayer((p) => ({
      ...p,
      balance: p.balance - WATER_CARD_PRICE,
      waterCardUses: (p.waterCardUses ?? 0) + 3,
    }))
    return true
  }, [player.balance, trackSpend])

  const toDisplayAmount = useCallback((amount: number) => amount, [])
  const currencyLabel = t("commonCoins")

  return (
    <GameContext.Provider
      value={{
        screen,
        setScreen: handleSetScreen,
        player,
        setPlayer,
        opponent,
        setOpponent,
        currentBet,
        setCurrentBet,
        lastResult,
        setLastResult,
        leaderboard,
        playerRank,
        rankTrend,
        leaderboardVersion,
        purchaseRankBoost,
        platformUser,
        loginWithPlatform,
        loginAsGuest,
        logout,
        isLoading,
        loadingStage,
        loadingProgress,
        loginErrorMessage,
        bets,
        pendingBet,
        betResponse,
        createBet,
        removeBet,
        updatePendingBetAmount,
        acceptBetResponse,
        declineBetResponse,
        clearPendingBet,
        totalRounds,
        setTotalRounds,
        lavaCardStock,
        purchaseLavaCard,
        purchaseWaterCard,
        trackSpend,
        toDisplayAmount,
        currencyLabel,
        weeklyRules,
        opponents,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error("useGame must be inside GameProvider")
  return ctx
}
