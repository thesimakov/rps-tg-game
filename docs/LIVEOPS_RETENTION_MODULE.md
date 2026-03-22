# LiveOps: 30-day retention module

Модуль удержания на ~30 дней для **RPS Arena (Telegram Mini App)**:

- Ежедневные награды, серия и платное восстановление серии (валюта «голоса» в UI).
- Квесты (daily/weekly/monthly) с XP и жетонами событий.
- 30-уровневый ивент-пасс (бесплатная и премиум ветки).
- Недельные события на 4 недели (`elements_tournament`, `time_is_money`, `blind_luck`, `boss_week`).
- Достижения с титулами.
- Валидация по серверному времени.
- Конфиг в JSON без обязательного редеплоя.

## Файлы

- `config/liveops-month-1.json` — контент месяца.
- `lib/liveops/types.ts` — типы.
- `lib/liveops/config.ts` — загрузка/кэш конфига.
- `lib/liveops/engine.ts` — логика LiveOps.
- `lib/liveops/liveops-sync.ts` — синхронизация премиум-валюты и флагов платформы (Telegram).
- `lib/liveops/client.ts` — клиент для Mini App.
- `app/api/liveops/*` — API.
- `app/api/admin/liveops/config/route.ts` — админский конфиг.
- `backend/python/liveops_module.py` — ядро для Python-бэкенда (опционально).

## API

Ответы с `Cache-Control: no-store`.

- `POST /api/liveops/state` `{ userId }` — в ответе поле **`liveopsSync`** (баланс голосов и флаги).
- Остальные эндпоинты: `claim-daily`, `restore-streak`, `track-action`, `claim-quest`, `claim-achievement`, `unlock-pass-premium`, `claim-pass-reward`, `weekly-rules`, админский конфиг.

## Хранение игрока

`StoredPlayer` расширен, в т.ч.:

- `vkVoicesBalance?: number` — **legacy-имя** поля для баланса «голосов» LiveOps (совместимость со старыми JSON).
- `liveOpsState`, `activeTitleId`, и др.

## Интеграция с Telegram

`lib/liveops/liveops-sync.ts` — точка расширения: при необходимости добавь проверку подписки на канал, внешние биллинг-эндпоинты и т.д.

## Безопасность

- Решения о наградах по серверному `Date.now()`.
- `clientTimestamp` только для sanity-check.
- Защита от повторных клеймов через `claimedAt`.

## Следующие шаги

1. Вызов трекинга матчей из финала боя.
2. UI квестов/пасса (виджеты уже есть).
3. Покупка премиум-пасса через реальный платёжный поток (TON / Stars — по продукту).
4. Перенос хранилища с JSON на БД с сохранением схемы.
