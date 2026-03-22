# RPS Arena — Telegram Mini App

Камень-ножницы-бумага: PvP, ставки, магазин, рефералы, LiveOps, TON-пополнения.

## Стек

- **Next.js** (App Router)
- **React** + **Tailwind CSS**
- В Telegram: **Telegram WebApp** (`lib/platform-bridge.ts`)

## Локальный запуск

```bash
pnpm install
cp .env.example .env.local   # при необходимости
pnpm dev
```

Открой `http://127.0.0.1:3000`.

## Деплой

Продакшен-сборка: `pnpm build` → `pnpm start` (задай `PORT`, например `3001`).

Пример домена: `https://tg.lemnity.ru` — reverse proxy (nginx) на локальный порт с процесс-менеджером (PM2).

## Репозиторий

Этот репозиторий — **вариант для Telegram**. Старый код/документация с привязкой к другим платформам по возможности вынесены в нейтральные модули (например `lib/liveops/liveops-sync.ts`).
