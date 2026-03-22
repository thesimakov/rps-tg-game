"use client"

import { useState, useEffect, useRef } from "react"
import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import { purchaseCoins, isMiniAppEnvironment, showFriendsPicker, showInviteBox, joinCommunity, COIN_PACKS } from "@/lib/platform-bridge"
import { canPurchaseItem, isItemOwned, type ShopItemId } from "@/lib/shop-rules"
import { getDiscountedPrice, getLevelFromXp, getShopDiscountPercent } from "@/lib/level-system"
import { ArrowLeft, Crown, Zap, Sparkles, Box, Palette, Coins, Wallet, Flame, Droplets, UserPlus, Share2, X, Hourglass, Ticket } from "lucide-react"
import { isServerPlayerId } from "@/lib/platform-user"
import { useI18n } from "@/lib/i18n/context"
import type { MsgKey } from "@/lib/i18n/copy-en"

const INVITED_SLOTS = 4
const INVITE_REWARD = 100
const GROUP_SUB_REWARD = 40

const SHOP_ITEM_KEYS: Record<ShopItemId, { name: MsgKey; desc: MsgKey }> = {
  vip: { name: "shopItem_vip_name", desc: "shopItem_vip_desc" },
  "timer-plus-10": { name: "shopItem_timer_name", desc: "shopItem_timer_desc" },
  "card-set-ancient": { name: "shopItem_ancient_name", desc: "shopItem_ancient_desc" },
  "fast-match": { name: "shopItem_fast_name", desc: "shopItem_fast_desc" },
  "chest-basic": { name: "shopItem_chestBasic_name", desc: "shopItem_chestBasic_desc" },
  "chest-premium": { name: "shopItem_chestPremium_name", desc: "shopItem_chestPremium_desc" },
  "victory-anim": { name: "shopItem_victory_name", desc: "shopItem_victory_desc" },
  "card-skin": { name: "shopItem_cardSkin_name", desc: "shopItem_cardSkin_desc" },
  "frame-neon": { name: "shopItem_frameNeon_name", desc: "shopItem_frameNeon_desc" },
  "frame-gold": { name: "shopItem_frameGold_name", desc: "shopItem_frameGold_desc" },
  "tournament-entry": { name: "shopItem_tournament_name", desc: "shopItem_tournament_desc" },
  "lava-card": { name: "shopItem_lava_name", desc: "shopItem_lava_desc" },
  "water-card": { name: "shopItem_water_name", desc: "shopItem_water_desc" },
}

interface ShopItem {
  id: ShopItemId
  price: number
  icon: React.ReactNode
  category: string
  color: string
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: "vip",
    price: 50,
    icon: <Crown className="h-5 w-5" />,
    category: "premium",
    color: "text-accent",
  },
  {
    id: "timer-plus-10",
    price: 5,
    icon: <Hourglass className="h-5 w-5" />,
    category: "boost",
    color: "text-secondary",
  },
  {
    id: "card-set-ancient",
    price: 200,
    icon: <Palette className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-accent",
  },
  {
    id: "fast-match",
    price: 1,
    icon: <Zap className="h-5 w-5" />,
    category: "boost",
    color: "text-secondary",
  },
  {
    id: "chest-basic",
    price: 20,
    icon: <Box className="h-5 w-5" />,
    category: "chest",
    color: "text-primary",
  },
  {
    id: "chest-premium",
    price: 50,
    icon: <Box className="h-5 w-5" />,
    category: "chest",
    color: "text-accent",
  },
  {
    id: "victory-anim",
    price: 15,
    icon: <Sparkles className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-destructive",
  },
  {
    id: "card-skin",
    price: 20,
    icon: <Palette className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-accent",
  },
  {
    id: "frame-neon",
    price: 150,
    icon: <Sparkles className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-primary",
  },
  {
    id: "frame-gold",
    price: 150,
    icon: <Palette className="h-5 w-5" />,
    category: "cosmetic",
    color: "text-accent",
  },
  {
    id: "tournament-entry",
    price: 25,
    icon: <Crown className="h-5 w-5" />,
    category: "tournament",
    color: "text-secondary",
  },
  {
    id: "lava-card",
    price: 120_000,
    icon: <Flame className="h-5 w-5" />,
    category: "special",
    color: "text-destructive",
  },
  {
    id: "water-card",
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
  amount?: number
  icon?: React.ReactNode
}

/** Случайный приз для базового сундука */
function rollBasicPrize(): ChestPrize {
  const r = Math.random()
  if (r < 0.28) return { kind: "coins", amount: Math.floor(Math.random() * 8) + 1 }
  if (r < 0.5) return { kind: "bonus", amount: 2 }
  if (r < 0.72) return { kind: "rubles_small", amount: 3 + Math.floor(Math.random() * 5) }
  if (r < 0.9) return { kind: "boost", amount: 1 }
  return { kind: "double_bonus", amount: 2 }
}

/** Случайный приз для премиум сундука */
function rollPremiumPrize(): ChestPrize {
  const r = Math.random()
  if (r < 0.22) return { kind: "coins", amount: 10 + Math.floor(Math.random() * 21) }
  if (r < 0.4) return { kind: "bonus", amount: 2 }
  if (r < 0.58) return { kind: "rubles_medium", amount: 15 + Math.floor(Math.random() * 16) }
  if (r < 0.76) return { kind: "boost", amount: Math.random() > 0.5 ? 2 : 1 }
  if (r < 0.9) return { kind: "double_bonus", amount: 2 }
  return { kind: "coins", amount: 20 + Math.floor(Math.random() * 25) }
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
  const { t } = useI18n()
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
  const timerCooldownText = t("shopTimerCooldown", {
    h: timerCooldownHours,
    mm: String(timerCooldownMinutes).padStart(2, "0"),
    ss: String(timerCooldownSeconds).padStart(2, "0"),
  })
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
          setTopUpError(t("shopTopUpLimit"))
          return
        }
      }
    } catch {
      // если localStorage недоступен, просто продолжаем без учёта лимита
    }

    // Вне окружения мини-приложения сразу показываем подсказку и ничего не делаем.
    if (!isMiniAppEnvironment()) {
      setTopUpError(t("shopTopUpMiniAppOnly"))
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
          setTopUpError(t("shopTopUpTonFail"))
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
          setTopUpHint(t("shopTopUpOpenWallet"))
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
        setTopUpError(t("shopTopUpOpenFail"))
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
          json.error === "no_tonapi_key" ? t("shopTopUpTonApi") : t("shopTopUpNotConfirmed")
        setTopUpError(msg)
        return
      }
      if (!json.confirmed) {
        setTopUpHint(t("shopTopUpPending"))
        return
      }
      setPlayer((p) => ({
        ...p,
        balance: typeof json.balance === "number" ? json.balance : p.balance,
        totalPurchases: (p.totalPurchases ?? 0) + (json.credited ?? 0),
      }))
      setTopUpHint(t("shopTopUpSuccess"))
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
            await showInviteBox(t("inviteShareDefault"))
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
      await showInviteBox(t("inviteShareDefault"))
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
      setPromoMessage(t("shopPromoTelegramOnly"))
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
            ? t("shopPromoAlready")
            : json.error === "limit_reached"
              ? t("shopPromoLimit")
              : t("shopPromoInvalid")
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
          ? t("shopPromoCoins", { amount: formatAmount(reward.amount ?? 0) })
          : reward.kind === "fast_match"
            ? t("shopPromoBoost", { amount: reward.amount ?? 1 })
            : reward.kind === "lava_card"
              ? t("shopPromoLava", { amount: reward.amount ?? 5 })
              : t("shopPromoWater", { amount: reward.amount ?? 3 })
      setPromoMessage(baseText)
    } catch {
      setPromoStatus("error")
      setPromoMessage(t("shopPromoFail"))
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
          aria-label={t("commonBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-foreground uppercase tracking-wider">
          {t("shopTitle")}
        </h1>
        <div className="flex items-center gap-1.5 bg-card/60 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5">
          <Coins className="h-3.5 w-3.5 text-accent" />
          <span className="font-bold text-accent text-base tabular-nums">{formatAmount(toDisplayAmount(player.balance))} {currencyLabel}</span>
        </div>
      </div>

      <div className="w-full max-w-lg mb-4 rounded-2xl border border-border/30 bg-card/35 px-4 py-3 backdrop-blur-sm">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">{t("shopLegend")}</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-xs text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {t("shopLegendEconomy")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/35 bg-blue-500/12 px-2.5 py-1 text-xs text-blue-100">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
            {t("shopLegendSocial")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-300/35 bg-purple-500/12 px-2.5 py-1 text-xs text-purple-100">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />
            {t("shopLegendEvents")}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-emerald-200/90">
          {t("shopLevelDiscount", { n: levelNumber, pct: shopDiscountPercent })}
        </p>
      </div>

      {/* Пополнение баланса */}
      <div className="w-full max-w-lg mb-6 bg-primary/10 border border-primary/25 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-bold text-base text-foreground">{t("shopTopUpTitle")}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("shopTopUpSubtitle")}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {t("shopRateTon")}
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
            {t("shopOpenInTelegram")}
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
              {topUpLoading === pack.amount ? "..." : t("shopCoinsPack", { amount: pack.amount })}
            </button>
          ))}
        </div>
        {!!pendingTonTopupId && (
          <div className="mt-3 rounded-xl border border-border/40 bg-card/40 p-3">
            <p className="text-[11px] text-muted-foreground mb-2">{t("shopAfterPayHint")}</p>
            <button
              type="button"
              onClick={() => void handleCheckTonTopup()}
              disabled={checkingTon}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
            >
              {checkingTon ? t("shopChecking") : t("shopCheckPayment")}
            </button>
          </div>
        )}
      </div>

      {/* Награда за приглашение 4 друзей */}
      <div className="w-full max-w-lg mb-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-5 w-5 text-primary" />
          <span className="font-bold text-base text-foreground">{t("shopInviteBlockTitle", { amount: INVITE_REWARD })}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("shopInviteBlockBody")}
        </p>
        {!isMiniAppEnvironment() && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            {t("shopInviteTelegramOnly")}
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
                    {t("shopRemove")}
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
                  <span className="text-xs">{t("shopPickFriend")}</span>
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
            {t("commonInvite")}
          </button>
          <button
            type="button"
            disabled={invitedCount === 0}
            onClick={() => setShowFriendsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/40 text-xs font-semibold text-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            {t("shopViewFriends")}
          </button>
          {canClaimInviteReward && (
            <button
              type="button"
              onClick={handleClaimInviteReward}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-bold transition-all active:scale-95"
            >
              <Coins className="h-4 w-4" />
              {t("shopClaimInviteReward", { amount: INVITE_REWARD })}
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
            {t("shopSubscribeTitle", { amount: GROUP_SUB_REWARD })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("shopSubscribeBody")}
        </p>
        {!isMiniAppEnvironment() && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            {t("shopSubscribeTelegramChannel")}
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
            ? t("shopSubscribeLoading")
            : player.groupSubscribedRewardClaimed
              ? t("shopSubscribeDone")
              : t("shopSubscribeRewardBtn", { amount: GROUP_SUB_REWARD })}
        </button>
      </div>

      {/* Промокод */}
      <div className="w-full max-w-lg mb-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="h-5 w-5 text-primary" />
          <span className="font-bold text-base text-foreground">{t("shopPromoTitle")}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("shopPromoBody")}
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
            placeholder={t("shopPromoExample")}
            className="flex-1 min-w-0 rounded-xl bg-background/80 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
          />
          <button
            type="button"
            onClick={handleRedeemPromo}
            disabled={!promoCode.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            {t("shopPromoApply")}
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
          const itemId = item.id
          const keys = SHOP_ITEM_KEYS[itemId]
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
                  <h3 className="text-base font-bold text-foreground">{t(keys.name)}</h3>
                  {showPermanentOwnedBadge && (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      {t("shopBadgeOwnedForever")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">{t(keys.desc)}</p>
                {item.id === "lava-card" && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t("betsSidebarLavaStock", { n: lavaCardStock })}</p>
                )}
                {item.id === "timer-plus-10" && timerCooldownLeftMs > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t("shopTimerBuyAfter", { time: timerCooldownText })}
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
                {buyingItemId === item.id ? t("shopPurchasing") : item.id === "lava-card" && lavaOutOfStock ? t("shopOutOfStock") : alreadyOwned ? t("shopOwned") : (
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
                {t("shopFriendsModalTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setShowFriendsModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                aria-label={t("commonClose")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {invitedCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("shopFriendsModalEmpty")}
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
                        <span className="font-bold text-secondary">{t("shopChestBonus", { n: prize.amount ?? 2 })}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-6 h-6 text-primary shrink-0" />
                        <span className="font-bold text-foreground">{t("shopChestFastMatch", { n: prize.amount ?? 1 })}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleCollectChest}
                className="px-8 py-4 rounded-2xl bg-accent text-accent-foreground font-bold text-lg shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {t("shopChestCollect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
