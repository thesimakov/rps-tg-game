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

### Репозиторий и куда уходит `git push`

- Удалённый репозиторий: **[https://github.com/thesimakov/rps-tg-game](https://github.com/thesimakov/rps-tg-game)** (`git push origin main` отправляет сюда).
- Публичный URL игры в Telegram: **[https://tg.lemnity.ru/](https://tg.lemnity.ru/)**. После push в `main` workflow **[`.github/workflows/deploy-vps.yml`](.github/workflows/deploy-vps.yml)** собирает приложение и выкладывает на VPS (секреты `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`); nginx проксирует на процесс (PM2). Пример конфига nginx: [`deploy/nginx.tg.lemnity.ru.conf`](deploy/nginx.tg.lemnity.ru.conf).

Опционально: **[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)** публикует статический экспорт на GitHub Pages (отдельный сценарий, не заменяет продакшен на `tg.lemnity.ru`).

## О кодовой базе

Репозиторий заточен под **Telegram Mini App**. Общие модули вынесены нейтрально (например `lib/liveops/liveops-sync.ts`).
