# CLAUDE.md

Контекст проекта для Claude. Читать перед любыми изменениями в коде.

---

## 1. Что это

**TrueNAS Dashboard** — open-source веб-дашборд реального времени для мониторинга домашнего сервера TrueNAS SCALE.

- Репозиторий: `AllexisO/truenas-dashboard`
- Лицензия: MIT
- Сервер: TrueNAS SCALE Fangtooth 25.04, Ryzen 7 5700G, 64 GB RAM, несколько ZFS-пулов, Docker-контейнеры под управлением Dockge
- Разработка ведётся прямо на сервере через VS Code Remote SSH

---

## 2. Стек

| Слой | Технологии |
|---|---|
| Backend | Python 3.12-slim, `asyncio`, `aiohttp`, `websockets`, `pyyaml`, `docker` |
| Источник данных | TrueNAS middleware через unix-сокет (DDP-протокол), Netdata |
| Frontend | Vanilla HTML/CSS/JS. **Без сборки, без фреймворков, без npm** |
| Графики | ApexCharts — только на detail-страницах. Нативный SVG — в summary-карточках |
| Инфраструктура | Docker Compose, Dockge, AdGuard Home (локальный DNS, домен `.local`) |

---

## 3. Структура проекта

```
truenas-dashboard/
├── docker-compose.yml
├── .env.example
├── .env                       # не в git
├── config.yml                 # конфиг виджетов, редактируется из UI
├── README.md
├── LICENSE
├── bridge/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                # точка входа, запуск Poller + Bridge
│   ├── poller.py              # подключение к TrueNAS, сбор данных
│   └── bridge.py              # HTTP + WebSocket сервер
└── dashboard/
    ├── index.html             # текущий рабочий UI
    ├── index-updated.html     # новый UI (сайдбар + топбар), в процессе миграции
    ├── cpu.html               # detail-страница (Chart.js, устаревшая)
    ├── cpu-apex.html          # detail-страница (ApexCharts)
    ├── icon.svg
    ├── css/
    │   ├── style.css          # стили текущего UI
    │   └── style-updated.css  # стили нового UI, CSS-переменные + темы
    └── js/
        ├── app.js             # точка входа: конфиг → виджеты → WebSocket
        ├── header.js          # хедер, uptime, LED-индикаторы, тултипы
        ├── settings.js        # панель настроек
        ├── cpu-page.js        # detail-страница на Chart.js
        ├── cpu-apex.js        # detail-страница на ApexCharts
        └── widgets/
            ├── cpu-widget.js
            ├── ram-widget.js
            ├── network-widget.js
            └── disks-widget.js
```

---

## 4. Архитектура

```
TrueNAS middlewared
        │  unix socket: /run/middleware/middlewared.sock (DDP)
        ▼
   poller.py  ──► self.latest_data (dict)
        │
        │  broadcast()
        ▼
   bridge.py  ──► WebSocket :8765  ──► браузер (app.js)
        └──────► HTTP      :3000  ──► статика + /config + /history
```

### poller.py

- Подключается к `/run/middleware/middlewared.sock`, handshake → `auth.login_with_api_key` → подписка на `reporting.realtime` (цикл ~2 сек).
- На каждое сообщение `msg == "added"` пишет в `latest_data["realtime"]` и вызывает `broadcast()`.
- Раз в 15 сек обновляет пулы. Раз в 10 сек — процессы (`update_processes_loop`).
- `fetch_history()` открывает **отдельное** соединение и вызывает `reporting.netdata_get_data`.

### bridge.py

- `aiohttp` для статики и API, `websockets` для realtime-канала.
- Клиенты хранятся в `poller.clients` (set), Bridge только добавляет/удаляет.

### Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/config` | отдать `config.yml` как JSON |
| POST | `/config` | сохранить конфиг в `/config/config.yml` |
| GET | `/history?graph=&hours=&live=` | исторические данные Netdata |
| GET | `/{path_info:.*}` | catch-all для статики из `/dashboard` |

**Порядок роутов в aiohttp критичен** — конкретные роуты регистрируются до catch-all.

---

## 5. Формат данных (`latest_data`)

| Ключ | Источник | Содержимое |
|---|---|---|
| `realtime` | `reporting.realtime` | `cpu`, `memory`, `interfaces`, `disks` |
| `disks` | `disk.query` | список дисков: `name`, `model`, `type`, `size` |
| `disk_temps` | `disk.temperatures` | `{ "sda": 38, ... }` |
| `pools` | `pool.query` | `name`, `allocated`, `size`, `topology`, `healthy` |
| `interfaces` | `interface.query` | сетевые интерфейсы, алиасы |
| `system` | `system.info` | `version`, `uptime`, `hostname` |
| `boot_disks` | `boot.get_disks` | имена загрузочных дисков |
| `boot_disk` | `df -B1 /` | `total`, `used`, `free` |
| `processes` | `ps aux --sort=-%cpu` | топ-10 процессов |
| `containers` | Docker SDK | `id`, `name`, `image`, `status`, `uptime` |
| `memory_info` | `dmidecode --type memory` | планки: `slot`, `size`, `speed`, `type` |

Вложенность realtime:
```
realtime.cpu.cpu.usage / .temp        # агрегат
realtime.cpu.cpu0 … cpuN.usage        # потоки
realtime.memory.physical_memory_total / .physical_memory_available / .arc_size
realtime.interfaces.<iface>.received_bytes_rate / .sent_bytes_rate / .speed / .link_state
realtime.disks.busy
```

---

## 6. Frontend

### Жизненный цикл (`app.js`)

1. `loadConfig()` → `GET /config` → `appConfig` (глобальная).
2. `initSettings(config)`.
3. `createWidget(templateId, order)` для каждого включённого виджета — клонирует `<template>` и вставляет в `#cards` по `data-order`.
4. `initTooltips()`.
5. `connect()` — WebSocket, в `onmessage` вызываются все `updateXxx(data)`.

### Правила виджетов

- Каждый виджет — отдельный файл в `js/widgets/`, экспортирует глобальную `updateXxx(data)`.
- Функция всегда начинается с guard'ов: проверка наличия данных, потом наличия DOM-узла. Виджет может быть выключен в конфиге — узла в DOM не будет.
- Списки (диски, ядра, пулы) строятся **один раз** через клонирование `<template>`; дальше обновляются только значения. Признак «уже построено» — `grid.children.length > 0`.
- Никакого `innerHTML` для построения разметки.

### Темы и сайдбар (новый UI)

- Тема: `html[data-theme="dark"|"light"]`, значение в `localStorage`, применяется inline-скриптом в `<head>` до первой отрисовки.
- Сайдбар: `html[data-sidebar="collapsed"]`, тоже `localStorage`.
- CSS-переменные определены на `html[data-theme=...]`. **В нативных media query breakpoints CSS-переменные не работают** — учитывать при адаптиве.

---

## 7. Соглашения по коду

**Обязательно к соблюдению. Отклонения будут отклонены на ревью.**

- **Никакого дублирования логики.** Перед добавлением функции или константы — проверить, нет ли уже существующей. Переиспользовать, а не плодить (`formatBytesUnit`, `RING_CIRCUMFERENCE` и т.д.).
- **Никаких захардкоженных значений.** Количество потоков, название CPU, имена интерфейсов — всё берётся динамически из API.
- **Семантические имена классов**, описывающие сущность, а не раскладку: `server-card-row`, а не `server-full-width`.
- **Описательные имена переменных**: `error`, а не `e`; `response`, а не `r`.
- **`<button>`, а не `<a>`** для SPA-навигации.
- **Flex предпочтительнее grid.**
- **CSS custom properties** для всех цветов и повторяющихся значений.
- **Комментарий-шапка** в начале каждого JS-файла: имя файла + краткое описание.
- Разработка **маленькими инкрементами**. Не вываливать всё сразу — по одному куску, с объяснением.

---

## 8. Подводные камни

- **`reporting.realtime` — только подписка.** Через `midclt` не вызывается. Температуры дисков — `disk.temperatures`, история I/O по дискам — `reporting.netdata_graph "disk"`.
- **Авторизация работает только через unix-сокет.** Сетевой WebSocket (`/api/current` с Bearer, `/websocket` с login) не работает — не пытаться.
- **Осиротевшие подписки.** Повторные `docker compose up -d --build` накапливают подписки `reporting.realtime` на стороне `middlewared`. Лечится `systemctl restart middlewared`. Делать периодически во время активной разработки.
- **`setInterval` внутри обработчика WebSocket-сообщения** — источник утечки: флаг «уже загружено» должен быть в модульной области видимости, а не внутри функции, вызываемой каждые 2 секунды.
- **Race в `broadcast()`**: `self.clients` может мутировать во время итерации. Итерировать по снимку — `list(self.clients)`.
- **Неанимируемые CSS-свойства** (`justify-content`, `display`) вызывают дёрганье. Для сворачивания сайдбара — переход по `opacity` + `width`, не `display: none`.
- **Min/max CPU** брать из агрегаций Netdata (`aggregations.max/min`), а не сканировать усреднённые точки истории.

---

## 9. Разработка и деплой

### Что требует пересборки контейнера

| Изменение | Действие |
|---|---|
| `dashboard/**` (HTML/CSS/JS) | ничего — volume-mount, обновляется вживую, достаточно F5 |
| `bridge/**` (Python) | `docker compose up -d --build` |
| `config.yml` | ничего — читается при старте, правится через UI |
| `.env` | `docker compose up -d` |

### Команды

```bash
docker compose up -d --build      # пересобрать и поднять
docker compose logs -f            # логи
docker compose restart            # перезапуск без сборки
systemctl restart middlewared     # сбросить осиротевшие подписки
```

### Git-процесс

- Ветки: `TRUENAS-XX` (или `TRUENAS-XX.Y` для подзадач).
- Коммиты и пуш — с сервера, вручную.
- PR создаются **вручную через веб-интерфейс GitHub**. Claude отдаёт только заголовок PR и markdown-описание.
- У Claude read-only доступ к репозиторию через fine-grained PAT. Claude читает код из репозитория сам, а не просит вставлять сниппеты.

---

## 10. Известные проблемы в текущем коде

Незакрытые баги — исправлять при касании соответствующих файлов:

- `disks-widget.js` → `buildDiskGrid()`: `disk.length` вместо `disks.length` в конце функции.
- `disks-widget.js`: селектор `.disk-count`, а в разметке `#disks-count`.
- `app.js`: сетевая карточка создаётся по условию `config.widgets.memory.enabled` вместо `config.widgets.network.enabled`.
- `app.js`: конструкции вида `className = "a online" || "b"` — правая часть мертва, `||` здесь бессмысленна.
- `app.js`: опечатки в именах — `getCollpseToogle`.
- `index.html`: дублирующийся атрибут `id` на `#server-status-text`.
- `ram-widget.js`: опечатка `ramFreeSedibar`; обращение к sidebar-узлам без проверки на `null`.
- `settings.js`: в POST уходит исходный `config`, а не обновлённый `appConfig`.
- `poller.py` → `fetch_processes()`: присваивание `latest_data['processes']` внутри цикла.
- `bridge.py` → `http_handler()`: голый `except`, path traversal не фильтруется.

---

## 11. Дорожная карта

Ближайшее:
- Система логирования (backend + frontend).
- CSS: равная высота summary-карточек с внутренним скроллом для списка дисков.
- Завершение миграции на новый UI (`index-updated.html` / `style-updated.css` → заменить `index.html` / `style.css`).

Готово: карточки CPU / RAM / Network / Disks, Disks Overview с live-графиком чтения/записи, панель пулов, топ-10 процессов, адаптивный мобильный сайдбар.

---

## 12. Чего не делать

- Не добавлять сборщики, npm, бандлеры, фреймворки.
- Не добавлять зависимости в `requirements.txt` без явной необходимости.
- Не переписывать целые файлы, если просили изменить одну функцию.
- Не создавать новые утилиты, если похожая уже есть в проекте.
- Не отдавать «финальный вариант всего сразу» — только следующий инкремент.
