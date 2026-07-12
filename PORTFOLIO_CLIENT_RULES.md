# Portfolio – правила за клиент vs админ

Прочитай този файл преди промени в `portfolio*` файловете.

## Роли

| Зона | Кой я ползва | Какво вижда |
|------|--------------|-------------|
| **Клиент** | `portfolio.html`, `portfolio.js`, checkout, product pages | Само retail цени, налични продукти, цели/категории |
| **Админ** | Admin → Portfolio B2B, `/portfolio/import/*`, sync, orders | B2B цени, марж, markup, AI подбор по отстъпка |

## Задължителни правила (клиент)

1. **Никога не показвай марж, B2B цена или markup** в UI, sort labels, API bootstrap или sort options.
2. **Само налични продукти** се показват на клиента – без checkbox „Само налични“, без badge „Изчерпан“, без sort „Налични първо“.
3. **Подредба „Препоръчани“** (`sort=relevance`) – вътрешно ползва margin ranking за админ изгода, но клиентът вижда само етикет „Препоръчани“.
4. **Филтри в toolbar** – категория и цел (goal) като падащи менюта, не chips.
5. **Дизайн** – филтрите трябва да са визуално изчистени, touch-friendly, съгласувани с `portfolio.css`.

## Админ – подбор по отстъпка/марж

- `max_margin` / `max_margin_pct` в KV index – **само за админ** (`/portfolio/import/ai-select`, admin catalog).
- Bootstrap (`/portfolio/bootstrap`) **strip-ва** margin полета преди отговор към клиента.
- AI import prompt: приоритизира продукти с най-висока търговска отстъпка (margin), без да се споменава пред клиента.

## Цели (goals)

- Дефиниции: `portfolio-goals.js`
- Mapping: keywords + optional `product_overrides[group_id].goals` в settings
- Client filter: `#filter-goal` dropdown

## Синхронизация

След промени в index schema → **resync** на portfolio каталога от Admin.
