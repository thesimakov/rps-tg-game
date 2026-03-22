"use client"

import { useState, useEffect, useRef } from "react"
import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { purchaseCoins, isMiniAppEnvironment, showFriendsPicker, showInviteBox, joinCommunity, COIN_PACKS } from "@/lib/platform-bridge"
import { canPurchaseItem, isItemOwned, type ShopItemId } from "@/lib/shop-rules"
import { getDiscountedPrice, getLevelFromXp, getShopDiscountPercent } from "@/lib/level-system"
import { ArrowLeft, Crown, Zap, Sparkles, Box, Palette, Coins, Wallet, Flame, Droplets, UserPlus, Share2, X, Hourglass, Ticket } from "lucide-react"
import { isServerPlayerId } from "@/lib/platform-user"

const INVITED_SLOTS = 4
const INVITE_REWARD = 100
const GROUP_SUB_REWARD = 40

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  icon: React.ReactNode
  category: string
  color: string
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: "vip",
    name: "VIP Статус",
    description: "Цветной ник, приоритет, статус в профиле",
    price: 50,
    icon: <Crown className="h-5 w-5" />,
    category: "premium",
    color: "text-accent",
  },
  {
    id: "timer-plus-10",
    name: "Таймер +10 секунд (1 день)",
    description: "Увеличивает время выбора хода до 25 секунд на сутки.",
    price: 5,
    icon: <Hourglass className="h-5 w-5" />,
    category: "boost",
    color: "text-secondary",
  },
  {
    id: "card-set-ancient",
    name: "Карты: Древняя Русь",
    description: "Средневековый набор карт. Видят вы и ваши соперники.",
    price: 200,
    icon: <Palette className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-accent",
  },
  {
    id: "fast-match",
    name: "Быстрый поиск",
    description: "Приоритет в очереди на 10 матчей",
    price: 1,
    icon: <Zap className="h-5 w-5" />,
    category: "boost",
    color: "text-secondary",
  },
  {
    id: "chest-basic",
    name: "Базовый сундук",
    description: "Шанс получить бонусы или аватарку",
    price: 20,
    icon: <Box className="h-5 w-5" />,
    category: "chest",
    color: "text-primary",
  },
  {
    id: "chest-premium",
    name: "Премиум сундук",
    description: "Гарантированный бонус или редкость",
    price: 50,
    icon: <Box className="h-5 w-5" />,
    category: "chest",
    color: "text-accent",
  },
  {
    id: "victory-anim",
    name: "Анимация: Огонь",
    description: "Огненная анимация при победе",
    price: 15,
    icon: <Sparkles className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-destructive",
  },
  {
    id: "card-skin",
    name: "Скин: Золото",
    description: "Золотое оформление карт",
    price: 20,
    icon: <Palette className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-accent",
  },
  {
    id: "frame-neon",
    name: "Рамка: Неон",
    description: "Неоновая рамка аватара",
    price: 150,
    icon: <Sparkles className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-primary",
  },
  {
    id: "frame-gold",
    name: "Рамка: Золото",
    description: "Золотая рамка аватара с анимацией",
    price: 150,
    icon: <Palette className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-accent",
  },
  {
    id: "tournament-entry",
    name: "Турнир дня",
    description: "16 игроков, призовой фонд 500+ монет",
    price: 25,
    icon: <Crown className="h-5 w-5" />,
    category: "tournament",
    color: "text-secondary",
  },
  {
    id: "lava-card",
    name: "Карта «Лава»",
    description: "Уничтожает любую карту соперника. 5 использований. Рекомендуем при турнире.",
    price: 120_000,
    icon: <Flame className="h-5 w-5" />,
    category: "special",
    color: "text-destructive",
  },
  {
    id: "water-card",
    name: "Карта «Вода»",
    description: "Побеждает камень. Проигрывает бумаге. Ничья с ножницами. 3 использования.",
    price: 500,
    icon: <Droplets className="h-5 w-5" />,
    category: "special",
    color: "text-primary",
  },
]

type ChestType = "basic" | "premium"

/** Типы призов из сундуков */
type PrizeKind = "coins" | "bonus" | "rubles_small" | "rubles_medium" | "boost" | "double_bonus"

interface ChestPrize {
  kind: PrizeKind
  label: string
  amount?: number
  icon?: React.ReactNode
}

/** Случайный приз для базового сундука */
function rollBasicPrize(): ChestPrize {
  const r = Math.random()
  if (r < 0.28) return { kind: "coins", amount: Math.floor(Math.random() * 8) + 1, label: "монет" }
  if (r < 0.5) return { kind: "bonus", amount: 2, label: "Бонусы +2" }
  if (r < 0.72) return { kind: "rubles_small", amount: 3 + Math.floor(Math.random() * 5), label: "монет" }
  if (r < 0.9) return { kind: "boost", amount: 1, label: "Быстрый поиск +1" }
  return { kind: "double_bonus", amount: 2, label: "Бонусы +2" }
}

/** Случайный приз для премиум сундука */
function rollPremiumPrize(): ChestPrize {
  const r = Math.random()
  if (r < 0.22) return { kind: "coins", amount: 10 + Math.floor(Math.random() * 21), label: "монет" }
  if (r < 0.4) return { kind: "bonus", amount: 2, label: "Бонусы +2" }
  if (r < 0.58) return { kind: "rubles_medium", amount: 15 + Math.floor(Math.random() * 16), label: "монет" }
  if (r < 0.76) return { kind: "boost", amount: Math.random() > 0.5 ? 2 : 1, label: "Быстрый поиск" }
  if (r < 0.9) return { kind: "double_bonus", amount: 2, label: "Бонусы +2" }
  return { kind: "coins", amount: 20 + Math.floor(Math.random() * 25), label: "монет" }
}

/** Выдать N случайных призов для сундука */
function rollChestPrizes(type: ChestType, count: number): ChestPrize[] {
  const roll = type === "premium" ? rollPremiumPrize : rollBasicPrize
  return Array.from({ length: count }, () => roll())
}

/** Применить приз к игроку, вернуть обновлённого игрока */
function applyPrize(prize: ChestPrize, player: { balance: number; fastMatchBoosts?: number }): { balance: number; fastMatchBoosts: number } {
  let balance = player.balance
  let fastMatchBoosts = player.fastMatchBoosts ?? 0
  switch (prize.kind) {
    case "coins":
    case "rubles_small":
    case "rubles_medium":
      balance += prize.amount ?? 0
      break
    case "bonus":
    case "double_bonus":
      fastMatchBoosts += prize.amount ?? 2
      break
    case "boost":
      fastMatchBoosts += prize.amount ?? 1
      break
  }
  return { balance, fastMatchBoosts }
}

/** Нормализует массив приглашённых до 4 слотов (null = пусто) */
function normalizeInvitedSlots(
  invitedFriends: Array<{ id: number; first_name: string; last_name: string; photo_200: string } | null> | undefined
): Array<{ id: number; first_name: string; last_name: string; photo_200: string } | null> {
  const base = Array.from({ length: INVITED_SLOTS }, (_, i) => invitedFriends?.[i] ?? null)
  return base
}

export function ShopScreen() {
  const { setScreen, player, setPlayer, platformUser, lavaCardStock, purchaseLavaCard, purchaseWaterCard, trackSpend, toDisplayAmount, currencyLabel } = useGame()
  const [topUpLoading, setTopUpLoading] = useState<number | null>(null)
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null)
  const [topUpError, setTopUpError] = useState<string>("")
  const [topUpHint, setTopUpHint] = useState<string>("")
  const [pendingTonTopupId, setPendingTonTopupId] = useState<string>("")
  const [checkingTon, setCheckingTon] = useState(false)
  const [openingChest, setOpeningChest] = useState<{ type: ChestType; prizes: ChestPrize[] } | null>(null)
  const [chestPhase, setChestPhase] = useState<"fly" | "open" | "reward" | "collect">("fly")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [groupSubLoading, setGroupSubLoading] = useState(false)
  const [groupSubError, setGroupSubError] = useState("")
  const [promoCode, setPromoCode] = useState("")
  const [promoStatus, setPromoStatus] = useState<"idle" | "success" | "error">("idle")
  const [promoMessage, setPromoMessage] = useState("")
  const confettiRef = useRef<HTMLDivElement>(null)
  const purchaseLockRef = useRef(false)
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())

  const invitedSlots = normalizeInvitedSlots(player.invitedFriends)
  const invitedCount = invitedSlots.filter(Boolean).length
  const canClaimInviteReward = invitedCount >= INVITED_SLOTS && !player.invitedRewardClaimed
  const canClaimGroupReward = !player.groupSubscribedRewardClaimed
  const oneDayMs = 24 * 60 * 60 * 1000
  const timerCooldownLeftMs = player.timerPlus10BoughtAt ? Math.max(0, oneDayMs - (nowTs - player.timerPlus10BoughtAt)) : 0
  const timerCooldownTotalSeconds = Math.ceil(timerCooldownLeftMs / 1000)
  const timerCooldownHours = Math.floor(timerCooldownTotalSeconds / 3600)
  const timerCooldownMinutes = Math.floor((timerCooldownTotalSeconds % 3600) / 60)
  const timerCooldownSeconds = timerCooldownTotalSeconds % 60
  const timerCooldownText = `${timerCooldownHours} часов ${String(timerCooldownMinutes).padStart(2, "0")} минут ${String(
    timerCooldownSeconds
  ).padStart(2, "0")} секунд`
  const levelXp = player.levelXp ?? 0
  const levelNumber = getLevelFromXp(levelXp)
  const shopDiscountPercent = getShopDiscountPercent(levelXp)

  const getItemById = (itemId: ShopItemId) => SHOP_ITEMS.find((item) => item.id === itemId)
  const getItemPrice = (item: ShopItem, xp = levelXp) => getDiscountedPrice(item.price, xp)

  const isOwned = (itemId: ShopItemId, p = player) =>
    isItemOwned(itemId, {
      balance: p.balance,
      vip: p.vip,
      victoryAnimation: p.victoryAnimation,
      cardSkin: p.cardSkin,
      avatarFrame: p.avatarFrame,
      hasNeonFrame: p.hasNeonFrame,
      hasGoldFrame: p.hasGoldFrame,
      tournamentEntry: p.tournamentEntry,
      hasAncientDeck: p.hasAncientDeck,
      timerPlus10BoughtAt: p.timerPlus10BoughtAt,
    })

  const canBuyItem = (itemId: ShopItemId, p = player) => {
    const item = getItemById(itemId)
    if (!item) return false
    const price = getItemPrice(item, p.levelXp ?? 0)
    return canPurchaseItem({
      itemId,
      price,
      state: {
        balance: p.balance,
        vip: p.vip,
        victoryAnimation: p.victoryAnimation,
        cardSkin: p.cardSkin,
        avatarFrame: p.avatarFrame,
        hasNeonFrame: p.hasNeonFrame,
        hasGoldFrame: p.hasGoldFrame,
        tournamentEntry: p.tournamentEntry,
        hasAncientDeck: p.hasAncientDeck,
        timerPlus10BoughtAt: p.timerPlus10BoughtAt,
      },
      lavaCardStock,
    })
  }

  useEffect(() => {
    if (!openingChest) return
    setChestPhase("fly")
    const t1 = setTimeout(() => setChestPhase("open"), 800)
    const t2 = setTimeout(() => setChestPhase("reward"), 1600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [openingChest])

  useEffect(() => {
    if (!player.timerPlus10BoughtAt || timerCooldownLeftMs <= 0) return
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [player.timerPlus10BoughtAt, timerCooldownLeftMs])

  const handleCollectChest = () => {
    if (!openingChest) return
    setPlayer((p) => {
      let balance = p.balance
      let fastMatchBoosts = p.fastMatchBoosts ?? 0
      for (const prize of openingChest.prizes) {
        const next = applyPrize(prize, { balance, fastMatchBoosts })
        balance = next.balance
        fastMatchBoosts = next.fastMatchBoosts
      }
      return { ...p, balance, fastMatchBoosts }
    })
    setOpeningChest(null)
    setChestPhase("fly")
  }

  const handleTopUp = async (amount: number) => {
    setTopUpError("")
    setTopUpHint("")

    // Лимит пополнений: не более 3000 монет в сутки на пользователя.
    try {
      if (typeof window !== "undefined" && isServerPlayerId(player.id)) {
        const today = new Date().toISOString().slice(0, 10)
        const key = `rps_topup_${player.id}_${today}`
        const usedRaw = window.localStorage.getItem(key)
        const used = Number(usedRaw) || 0
        if (used + amount > 3000) {
          setTopUpError("Лимит пополнения 3000 монет в сутки уже достигнут или будет превышен этой покупкой.")
          return
        }
      }
    } catch {
      // если localStorage недоступен, просто продолжаем без учёта лимита
    }

    // Вне окружения мини-приложения сразу показываем подсказку и ничего не делаем.
    if (!isMiniAppEnvironment()) {
      setTopUpError("Пополнение доступно только внутри Telegram Mini App.")
      return
    }

    setTopUpLoading(amount)
    try {
      const isTelegramTopup = player.id.startsWith("tg_")
      let transferUrl: string | undefined
      let paymentMemo: string | undefined
      if (isTelegramTopup) {
        const create = await fetch("/api/ton/topup/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: player.id, amount }),
        })
        const createJson = (await create.json()) as {
          ok?: boolean
          request?: { id: string; transferUrl: string; memo: string }
        }
        if (!create.ok || !createJson.ok || !createJson.request) {
          setTopUpError("Не удалось создать TON-платеж. Попробуйте позже.")
          return
        }
        transferUrl = createJson.request.transferUrl
        paymentMemo = createJson.request.memo
        setPendingTonTopupId(createJson.request.id)
      }

      const success = await purchaseCoins(amount, { transferUrl, paymentMemo })
      // Баланс обновляется только после подтверждения платежа на бэкенде.
      if (success) {
        if (isTelegramTopup) {
          setTopUpHint("Откройте кошелек и выполните перевод. Затем нажмите «Проверить оплату».")
        } else {
          setPlayer((p) => ({
            ...p,
            balance: p.balance + amount,
            totalPurchases: (p.totalPurchases ?? 0) + amount,
          }))
          try {
            if (typeof window !== "undefined" && isServerPlayerId(player.id)) {
              const today = new Date().toISOString().slice(0, 10)
              const key = `rps_topup_${player.id}_${today}`
              const usedRaw = window.localStorage.getItem(key)
              const used = Number(usedRaw) || 0
              window.localStorage.setItem(key, String(used + amount))
            }
          } catch {
            // ignore
          }
        }
      } else {
        setTopUpError("Не удалось открыть форму оплаты. Попробуйте ещё раз или перезапустите мини‑приложение.")
      }
    } finally {
      setTopUpLoading(null)
    }
  }

  const handleCheckTonTopup = async () => {
    if (!pendingTonTopupId) return
    setCheckingTon(true)
    setTopUpError("")
    setTopUpHint("")
    try {
      const res = await fetch("/api/ton/topup/auto-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: player.id }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; confirmed?: boolean; balance?: number; credited?: number }
      if (!res.ok || !json.ok) {
        const msg =
          json.error === "no_tonapi_key"
            ? "На сервере не настроен TONAPI_API_KEY для проверки транзакции."
            : "Подтверждение не прошло. Подождите и попробуйте снова."
        setTopUpError(msg)
        return
      }
      if (!json.confirmed) {
        setTopUpHint("Платеж пока не найден в сети. Подождите 10-30 секунд и нажмите ещё раз.")
        return
      }
      setPlayer((p) => ({
        ...p,
        balance: typeof json.balance === "number" ? json.balance : p.balance,
        totalPurchases: (p.totalPurchases ?? 0) + (json.credited ?? 0),
      }))
      setTopUpHint("Платеж подтвержден сервером, монеты зачислены.")
      setPendingTonTopupId("")
    } finally {
      setCheckingTon(false)
    }
  }

  const handlePickFriend = async (slotIndex: number) => {
    setInviteLoading(true)
    try {
      const users = await showFriendsPicker()
      if (users?.length) {
        const friend = users[0]
        setPlayer((p) => {
          const current = normalizeInvitedSlots(p.invitedFriends)
          const next = [...current]
          next[slotIndex] = {
            id: friend.id,
            first_name: friend.first_name,
            last_name: friend.last_name,
            photo_200: friend.photo_200,
          }
          return { ...p, invitedFriends: next }
        })

        // После выбора друга сразу открываем стандартное окно приглашения,
        // чтобы ему пришло уведомление «Начать играть».
        try {
          if (isMiniAppEnvironment()) {
            await showInviteBox()
          }
        } catch {
          // игнорируем сбой открытия инвайта, слоты всё равно обновлены
        }
      }
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemoveInvited = (slotIndex: number) => {
    setPlayer((p) => {
      const current = normalizeInvitedSlots(p.invitedFriends)
      const next = [...current]
      next[slotIndex] = null
      return { ...p, invitedFriends: next }
    })
  }

  const handleInviteFriends = async () => {
    setInviteLoading(true)
    try {
      await showInviteBox()
    } finally {
      setInviteLoading(false)
    }
  }

  const handleClaimInviteReward = () => {
    if (!canClaimInviteReward) return
    setPlayer((p) => ({ ...p, balance: p.balance + INVITE_REWARD, invitedRewardClaimed: true }))
  }

  const handleGroupSubscribe = async () => {
    if (!canClaimGroupReward) return
    setGroupSubError("")
    setGroupSubLoading(true)
    try {
      const ok = await joinCommunity()
      if (ok) {
        setPlayer((p) => ({
          ...p,
          balance: p.balance + GROUP_SUB_REWARD,
          groupSubscribedRewardClaimed: true,
        }))
      }
    } finally {
      setGroupSubLoading(false)
    }
  }

  const handleRedeemPromo = async () => {
    if (!promoCode.trim() || promoStatus === "success") return
    if (!platformUser || !isServerPlayerId(player.id)) {
      setPromoStatus("error")
      setPromoMessage("Промокоды доступны после входа в Telegram Mini App.")
      return
    }
    setPromoStatus("idle")
    setPromoMessage("")
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: player.id, code: promoCode }),
      })
      const json = (await res.json()) as {
        ok: boolean
        error?: string
        reward?: { kind: "rubles" | "fast_match" | "lava_card" | "water_card"; amount?: number }
      }
      if (!json.ok || !json.reward) {
        const msg =
          json.error === "already_used"
            ? "Вы уже активировали этот промокод."
            : json.error === "limit_reached"
              ? "Лимит активаций этого промокода исчерпан."
              : "Промокод не найден или недействителен."
        setPromoStatus("error")
        setPromoMessage(msg)
        return
      }
      // Применяем награду к игроку.
      const reward = json.reward
      setPlayer((p) => {
        const amount = reward.amount ?? 0
        const updated = { ...p }
        if (reward.kind === "rubles") {
          updated.balance = p.balance + amount
        } else if (reward.kind === "fast_match") {
          updated.fastMatchBoosts = (p.fastMatchBoosts ?? 0) + (amount || 1)
        } else if (reward.kind === "lava_card") {
          updated.lavaCardUses = (p.lavaCardUses ?? 0) + (amount || 5)
        } else if (reward.kind === "water_card") {
          updated.waterCardUses = (p.waterCardUses ?? 0) + (amount || 3)
        }
        return updated
      })
      setPromoStatus("success")
      const baseText =
        reward.kind === "rubles"
          ? `Начислено ${formatAmount(reward.amount ?? 0)} монет.`
          : reward.kind === "fast_match"
            ? `Начислено ${reward.amount ?? 1} использований быстрого поиска.`
            : reward.kind === "lava_card"
              ? `Добавлено ${reward.amount ?? 5} использований карты «Лава».`
              : `Добавлено ${reward.amount ?? 3} использований карты «Вода».`
      setPromoMessage(baseText)
    } catch {
      setPromoStatus("error")
      setPromoMessage("Не удалось активировать промокод. Попробуйте позже.")
    }
  }

  const handleBuy = (itemId: ShopItemId) => {
    if (purchaseLockRef.current || buyingItemId) return
    const item = getItemById(itemId)
    if (!item) return
    const price = getItemPrice(item)
    if (!canBuyItem(itemId)) return
    purchaseLockRef.current = true
    setBuyingItemId(itemId)
    const releasePurchaseLock = () => {
      purchaseLockRef.current = false
      setBuyingItemId(null)
    }

    if (itemId === "lava-card") {
      purchaseLavaCard()
      setTimeout(releasePurchaseLock, 300)
      return
    }
    if (itemId === "water-card") {
      purchaseWaterCard()
      setTimeout(releasePurchaseLock, 300)
      return
    }

    if (itemId === "chest-basic" || itemId === "chest-premium") {
      trackSpend(price, itemId)
      const type: ChestType = itemId === "chest-basic" ? "basic" : "premium"
      const count = type === "premium" ? 3 : 2
      const prizes = rollChestPrizes(type, count)
      setPlayer((p) => {
        if (p.balance < price) return p
        return { ...p, balance: p.balance - price }
      })
      setOpeningChest({ type, prizes })
      setTimeout(releasePurchaseLock, 300)
      return
    }

    trackSpend(price, itemId)
    setPlayer((p) => {
      if (!canBuyItem(itemId, p)) return p
      switch (itemId) {
        case "vip":
          return { ...p, balance: p.balance - price, vip: true }
        case "fast-match":
          return {
            ...p,
            balance: p.balance - price,
            fastMatchBoosts: (p.fastMatchBoosts ?? 0) + 10,
          }
        case "victory-anim":
          return { ...p, balance: p.balance - price, victoryAnimation: "fire" }
        case "card-skin":
          return { ...p, balance: p.balance - price, cardSkin: "gold" }
        case "card-set-ancient":
          return {
            ...p,
            balance: p.balance - price,
            hasAncientDeck: true,
            cardDeck: p.cardDeck ?? "ancient-rus",
          }
        case "frame-neon":
          return { ...p, balance: p.balance - price, avatarFrame: "neon", hasNeonFrame: true }
        case "frame-gold":
          return { ...p, balance: p.balance - price, avatarFrame: "gold", hasGoldFrame: true }
        case "tournament-entry":
          return { ...p, balance: p.balance - price, tournamentEntry: true }
        case "timer-plus-10": {
          const now = Date.now()
          const current = p.extraTimerUntil && p.extraTimerUntil > now ? p.extraTimerUntil : now
          const oneDay = 24 * 60 * 60 * 1000
          return {
            ...p,
            balance: p.balance - price,
            extraTimerUntil: current + oneDay,
            timerPlus10BoughtAt: now,
          }
        }
        default:
          // неизвестный id — ничего не покупаем
          return p
      }
    })
    setTimeout(releasePurchaseLock, 300)
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center mb-6">
        <button
          onClick={() => setScreen("menu")}
          className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-foreground"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground uppercase tracking-wider">
          Магазин
        </h1>
        <div className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5">
          <Coins className="h-3.5 w-3.5 text-accent" />
          <span className="font-bold text-accent text-base tabular-nums">{formatAmount(toDisplayAmount(player.balance))} {currencyLabel}</span>
        </div>
      </div>

      <div className="w-full max-w-lg mb-4 rounded-2xl border border-border/30 bg-card/35 px-4 py-3 backdrop-blur-sm">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Легенда магазина</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-xs text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Экономика
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/35 bg-blue-500/12 px-2.5 py-1 text-xs text-blue-100">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
            Социальное
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-300/35 bg-purple-500/12 px-2.5 py-1 text-xs text-purple-100">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />
            События и бонусы
          </span>
        </div>
        <p className="mt-2 text-[11px] text-emerald-200/90">
          Уровень {levelNumber}: скидка в магазине {shopDiscountPercent}%.
        </p>
      </div>

      {/* Пополнение баланса */}
      <div className="w-full max-w-lg mb-6 bg-primary/10 border border-primary/25 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-bold text-base text-foreground">Пополнить баланс</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Выберите удобный пакет пополнения.
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Внутренний курс: 1 монета = 0,1 TON-экв.
        </p>
        {topUpError && (
          <p className="text-xs text-red-500 mb-2 font-medium">
            {topUpError}
          </p>
        )}
        {topUpHint && (
          <p className="text-xs text-emerald-400 mb-2 font-medium">{topUpHint}</p>
        )}
        {!isMiniAppEnvironment() && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            Для пополнения откройте приложение в Telegram.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {COIN_PACKS.map((pack) => (
            <button
              key={pack.amount}
              onClick={() => handleTopUp(pack.amount)}
              disabled={topUpLoading !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <Coins className="h-4 w-4" />
              {topUpLoading === pack.amount ? "..." : `${pack.amount} монет`}
            </button>
          ))}
        </div>
        {!!pendingTonTopupId && (
          <div className="mt-3 rounded-xl border border-border/40 bg-card/40 p-3">
            <p className="text-[11px] text-muted-foreground mb-2">После оплаты проверьте поступление автоматически.</p>
            <button
              type="button"
              onClick={() => void handleCheckTonTopup()}
              disabled={checkingTon}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
            >
              {checkingTon ? "Проверяем..." : "Проверить оплату"}
            </button>
          </div>
        )}
      </div>

      {/* Награда за приглашение 4 друзей */}
      <div className="w-full max-w-lg mb-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-5 w-5 text-primary" />
          <span className="font-bold text-base text-foreground">Получить {INVITE_REWARD} монет за приглашение 4 друзей</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Пригласите друзей в игру. Когда они примут приглашение — появятся в ячейках. За 4 принявших приглашение — награда.
        </p>
        {!isMiniAppEnvironment() && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            Откройте приложение в Telegram, чтобы приглашать друзей.
          </p>
        )}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {invitedSlots.map((friend, index) => (
            <div
              key={index}
              className="rounded-xl border border-border/40 bg-muted/20 p-2 min-h-[72px] flex flex-col items-center justify-center"
            >
              {friend ? (
                <>
                  <img
                    src={friend.photo_200 || ""}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover mb-1"
                  />
                  <span className="text-xs font-medium text-foreground truncate w-full text-center">
                    {friend.first_name} {friend.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInvited(index)}
                    disabled={inviteLoading}
                    className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Удалить
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePickFriend(index)}
                  disabled={inviteLoading || !isMiniAppEnvironment()}
                  className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-dashed border-border/50 py-2"
                >
                  <UserPlus className="h-6 w-6" />
                  <span className="text-xs">Выбрать друга</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={handleInviteFriends}
            disabled={inviteLoading || !isMiniAppEnvironment()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/80 text-primary-foreground text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Пригласить
          </button>
          <button
            type="button"
            disabled={invitedCount === 0}
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/40 text-xs font-semibold text-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            Посмотреть
          </button>
          {canClaimInviteReward && (
            <button
              type="button"
              onClick={handleClaimInviteReward}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-bold transition-all active:scale-95"
            >
              <Coins className="h-4 w-4" />
              Получить {INVITE_REWARD} монет
            </button>
          )}
        </div>
      </div>

      {/* Блок «100 монет — расскажи друзьям» скрыт, так как приложению недоступно создание постов на стене */}

      {/* Награда за подписку на канал */}
      <div className="w-full max-w-lg mb-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-5 w-5 text-secondary" />
          <span className="font-bold text-base text-foreground">
            Подпишитесь на наш канал и получите {GROUP_SUB_REWARD} монет
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Нажмите «Подписаться» — откроем канал и начислим награду один раз.
        </p>
        {!isMiniAppEnvironment() && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            Откройте приложение в Telegram, чтобы подписаться на канал.
          </p>
        )}
        {groupSubError && (
          <p className="text-xs text-red-500 mb-2 font-medium">
            {groupSubError}
          </p>
        )}
        <button
          type="button"
          onClick={handleGroupSubscribe}
          disabled={!canClaimGroupReward || groupSubLoading || !isMiniAppEnvironment() || !platformUser}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          {groupSubLoading
            ? "Подписка…"
            : player.groupSubscribedRewardClaimed
              ? "Вы уже подписаны"
              : `Подписаться и получить ${GROUP_SUB_REWARD} монет`}
        </button>
      </div>

      {/* Промокод */}
      <div className="w-full max-w-lg mb-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="h-5 w-5 text-primary" />
          <span className="font-bold text-base text-foreground">Промокод</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Иногда мы дарим промокоды с балансом, особыми картами или бустами. Введите код сюда, чтобы получить подарок.
        </p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value)
              setPromoStatus("idle")
              setPromoMessage("")
            }}
            placeholder="Например: RPS2026"
            className="flex-1 min-w-0 rounded-xl bg-background/80 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
          />
          <button
            type="button"
            onClick={handleRedeemPromo}
            disabled={!promoCode.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            Активировать
          </button>
        </div>
        {promoStatus === "success" && promoMessage && (
          <p className="text-xs text-emerald-400 font-medium">{promoMessage}</p>
        )}
        {promoStatus === "error" && promoMessage && (
          <p className="text-xs text-red-400 font-medium">{promoMessage}</p>
        )}
      </div>

      {/* Items */}
      <div className="w-full max-w-lg flex flex-col gap-2.5">
        {SHOP_ITEMS.map((item) => {
          const itemId = item.id as ShopItemId
          const alreadyOwned = isOwned(itemId)
          const showPermanentOwnedBadge = (itemId === "frame-neon" || itemId === "frame-gold") && alreadyOwned
          const lavaOutOfStock = itemId === "lava-card" && lavaCardStock <= 0
          const canBuy = canBuyItem(itemId)
          const effectivePrice = getItemPrice(item)
          const hasDiscount = effectivePrice < item.price
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-3.5"
            >
              <div className={`w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-foreground">{item.name}</h3>
                  {showPermanentOwnedBadge && (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      Куплено навсегда
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{item.description}</p>
                {item.id === "lava-card" && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">В наличии: {lavaCardStock} из 3</p>
                )}
                {item.id === "timer-plus-10" && timerCooldownLeftMs > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Можно купить через {timerCooldownText}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleBuy(itemId)}
                disabled={!canBuy || !!buyingItemId}
                className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-base font-bold transition-all flex-shrink-0 ${
                  canBuy
                    ? "bg-primary text-primary-foreground cursor-pointer active:scale-95 shadow-md shadow-primary/20"
                    : "bg-muted/30 text-muted-foreground border border-border/30 cursor-not-allowed"
                }`}
              >
                {buyingItemId === item.id ? "Покупка..." : item.id === "lava-card" && lavaOutOfStock ? "Нет в наличии" : alreadyOwned ? "Куплено" : (
                  <>
                    <Coins className="h-3 w-3" />
                    {formatAmount(toDisplayAmount(effectivePrice))} {currencyLabel}
                    {hasDiscount && (
                      <span className="ml-1 text-[10px] line-through opacity-70">
                        {formatAmount(toDisplayAmount(item.price))}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Модалка: друзья, которые уже в игре */}
      {showFriendsModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFriendsModal(false)
          }}
        >
          <div className="w-full max-w-sm mx-4 rounded-2xl bg-card/95 border border-border/40 shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">
                Друзья, которые уже играют
              </h2>
              <button
                type="button"
                onClick={() => setShowFriendsModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {invitedCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                Пока ни один друг не принял приглашение. Пригласите друзей, и они появятся здесь.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {invitedSlots
                  .filter(Boolean)
                  .map((friend, idx) => (
                    <div
                      key={friend!.id ?? idx}
                      className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border/40 px-3 py-2"
                    >
                      <img
                        src={friend!.photo_200 || ""}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                      <span className="text-sm font-medium text-foreground truncate">
                        {friend!.first_name} {friend!.last_name}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модалка открытия сундука: вылетает, открывается, конфетти, награда, «Собрать» */}
      {openingChest && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={(e) => e.target === e.currentTarget && chestPhase === "reward" && handleCollectChest()}
        >
          {/* Конфетти */}
          <div ref={confettiRef} className="absolute inset-0 pointer-events-none overflow-hidden">
            {chestPhase !== "fly" &&
              Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-sm animate-chest-confetti"
                  style={{
                    left: `${50 + ((i % 10) - 5) * 6}%`,
                    top: "38%",
                    backgroundColor: ["#fbbf24", "#f59e0b", "#84cc16", "#22c55e", "#eab308"][i % 5],
                    animationDelay: `${i * 0.03}s`,
                    ["--cx" as string]: `${(i % 7 - 3) * 45}px`,
                  }}
                />
              ))}
          </div>

          <div className="relative flex flex-col items-center gap-6 px-6">
            {/* Сундук: вылетает и открывается */}
            <div
              className={`transition-all duration-500 ${
                chestPhase === "fly"
                  ? "scale-50 opacity-0 translate-y-8"
                  : chestPhase === "open"
                    ? "scale-110 animate-chest-bounce"
                    : "scale-100"
              }`}
            >
              <div
                className={`w-28 h-28 rounded-2xl flex items-center justify-center border-4 shadow-2xl ${
                  openingChest.type === "premium"
                    ? "bg-amber-500/30 border-amber-400 text-amber-200"
                    : "bg-primary/30 border-primary text-primary-foreground"
                }`}
              >
                <Box className={`w-14 h-14 ${chestPhase === "open" ? "rotate-12 scale-110" : ""} transition-transform duration-500`} />
              </div>
            </div>

            {/* Награды (2 или 3 приза) и кнопка Собрать */}
            <div
              className={`flex flex-col items-center gap-4 transition-all duration-300 ${
                chestPhase === "reward" || chestPhase === "collect" ? "opacity-100 scale-100" : "opacity-0 scale-90"
              }`}
            >
              <div className="flex flex-wrap justify-center gap-3">
                {openingChest.prizes.map((prize, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/80 border border-border/50"
                  >
                    {prize.kind === "coins" || prize.kind === "rubles_small" || prize.kind === "rubles_medium" ? (
                      <>
                        <Coins className="w-6 h-6 text-accent shrink-0" />
                        <span className="font-bold text-base text-accent">+{formatAmount(toDisplayAmount(prize.amount ?? 0))} {currencyLabel}</span>
                      </>
                    ) : prize.kind === "bonus" || prize.kind === "double_bonus" ? (
                      <>
                        <Zap className="w-6 h-6 text-secondary shrink-0" />
                        <span className="font-bold text-secondary">Бонусы +{prize.amount ?? 2}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-6 h-6 text-primary shrink-0" />
                        <span className="font-bold text-foreground">Быстрый поиск +{prize.amount ?? 1}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleCollectChest}
                className="px-8 py-4 rounded-2xl bg-accent text-accent-foreground font-bold text-lg shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Собрать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
