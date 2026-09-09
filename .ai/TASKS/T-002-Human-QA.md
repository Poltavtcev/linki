# Повний план приймального тестування (Campaign Engine Human Acceptance Test Plan)

## Огляд
Цей план містить вичерпні сценарії для ручного приймального тестування (Human QA) відновленого Campaign Engine. Тестування покриває весь observable behavior рушія, включаючи управління життєвим циклом, семантику DAG, обробку вхідних повідомлень (replies), багатопоточність та цілеспрямовану перевірку adversarial-дефектів (T-002).

**ПРАВИЛА ВЗАЄМОДІЇ:**
1. Жодних виправлень production коду під час QA.
2. Жодних виправлень тестів під час QA.
3. Кожна розбіжність фіксується як окремий дефект.
4. Opus не запускається.
5. Для кожного знайденого дефекту фіксуємо: `Observed / Expected / Reproduction / Evidence / Severity / Campaign impact`.

**КЕРУВАННЯ ЧАСОМ (TIME-TRAVEL) ДЛЯ QA:**
У Campaign Engine ноди `Delay` задаються в інтерфейсі виключно в **днях** (наприклад, 1 день, 2 дні). Щоб уникнути очікування реальних діб під час QA, дозволяється безпечне маніпулювання тестовою базою даних для прискорення часу (Time-Travel):
- **Крок 1:** Після того як проспект доходить до ноди Delay, переконайтеся у базі даних (SQLite), що рушій правильно розрахував `next_eval_at` (наприклад, рівно +24 або +48 годин від поточного часу). Це є фактичною перевіркою коректності розрахунку затримки.
- **Крок 2:** Виконайте SQL-запит до тестової БД, щоб пересунути час у минуле: 
  `UPDATE run_profile_states SET next_eval_at = datetime('now', '-1 minute') WHERE run_profile_id = 'YOUR_ID';`
- **Крок 3:** Дочекайтеся виконання наступного фонового тіка (tick) раннером. Профіль має успішно "прокинутися" і перейти до наступного кроку.
- **Увага:** Цей метод використовується тільки для пропуску часу, НЕ підміняйте ним саму перевірку того, що рушій встановлює правильні початкові значення.

---

## P0: Критичні флоу Campaign Engine (Critical Flows)

### Сценарій P0.1: Нормальне лінійне виконання (Normal DAG)
**Передумови:** Створено нову кампанію з нодами: `Connect` → `Wait 1 Day` → `Message 1` → `Message 2` → `End`. 
**Дії:**
1. Створити та зберегти DAG у конструкторі UI.
2. Активувати кампанію та додати (enroll) тестового проспекта.
3. Дочекатися проходження ноди Connect та переходу до затримки.
**Очікуваний результат:**
- **UI:** Відображає `In Progress` (або `Pending`).
- **Canonical DB State:** Після `Connect` стан переходить у `running`, `next_eval_at` встановлюється на `now() + 1 day`.
**Критерії провалу:** Проспект пропускає затримку без Time-Travel втручання, або зависає на `Connect`.

### Сценарій P0.2: Обробка Email та LinkedIn (Channel Parity)
**Передумови:** Кампанія з кроками: `Email` → `Message` → `Wait 1 Day` → `Sales Navigator InMail`.
**Дії:**
1. Запустити проспекта з валідним email та LinkedIn URL.
2. Дочекатися відправлення Email та Message.
**Очікуваний результат:**
- **UI:** Трек (track) відображає прогрес через різні канали.
- **Canonical DB State:** Записи `outbound_events` створюються для `channel='email'` та `channel='linkedin'`.
**Критерії провалу:** Падіння раннера через відсутність Playwright-лока для Email-ноди, або пропуск InMail.

### Сценарій P0.3: Очікування на відповідь (Normal Reply Routing)
**Передумови:** Кампанія з нодою `Message`, яка має гілку `on_replied` (веде до `Email`) та гілку `next` (веде до `Wait 2 Days`).
**Дії:**
1. Дочекатися відправлення `Message`.
2. Відповісти з тестового акаунта на це повідомлення.
3. Дочекатися синхронізації інбоксу (inbox sync / sdr-shim).
**Очікуваний результат:**
- **UI:** Проспект переходить на гілку відповіді (`Email`), минаючи `Wait 2 Days`.
- **Canonical DB State:** `run_profile_states.current_step_id` стає ID ноди на гілці `on_replied`. `state = 'pending'`.

---

## P1: Повне функціональне покриття (Full Functional Coverage)

### Сценарій P1.1: Enrollment та Unenrollment Semantics
**Передумови:** Активна кампанія з довгими затримками.
**Дії:**
1. Додати кілька (3-5) проспектів одночасно.
2. Зробити `Unenroll` для одного з них ДО початку виконання (в стані `pending`).
3. Зробити `Unenroll` для іншого під час виконання ноди (дочекатися відкритого браузера Playwright).
**Очікуваний результат:**
- **UI:** Обидва проспекти отримують статус `Skipped`.
- **Canonical DB State (Контракт):** Згідно з контрактом `unenroll.ts`, `run_profile_states` стає `completed`, а `run_profile_tracks` стає `skipped`. Terminal-state immunity (T-002) запобігає воскресінню (resurrection).

### Сценарій P1.2: Всі типи виконання (Execution Nodes)
**Передумови:** Кампанія, що містить ноди: `ai_qualify`, `linkedin_like`, `ai_comment`, `visit`, `integration`.
**Дії:**
1. Запустити кампанію на спеціально підготованому проспекті з недавніми постами в LinkedIn.
**Очікуваний результат:**
- **UI:** Усі кроки проходять без помилок.
- **Canonical DB State:** Раннер успішно обробляє кожен тип `step_type`.
**Критерії провалу:** Невідомий тип кроку крашить раннер, або `ai_qualify` не маршрутизує правильно (`on_fit`, `on_not_fit`).

### Сценарій P1.3: Поведінка Retry (State Machine)
**Передумови:** Кампанія з нодою `Message`. Введено неправильні облікові дані для Playwright, або відключено мережу (Network Offline).
**Дії:**
1. Запустити кампанію (нода падає).
2. **UI:** Переконатися, що статус стає `Failed`.
3. Виправити мережу/дані.
4. Натиснути кнопку `Retry` в UI.
**Очікуваний результат:**
- **UI:** Статус переходить назад у `In Progress` (чи `Pending`).
- **Canonical DB State:** `run_profile_states` стає `pending`, `run_profile_tracks` стає `in_progress`.
- **Примітка щодо F-03 (Accepted Limitation):** Якщо помилка сталася *після* фактичної відправки повідомлення (але до запису в БД), `Retry` може надіслати дублікат. Це приймається системою. Але якщо відправка не відбулася, `Retry` має просто продовжити роботу.

### Сценарій P1.4: Pause та Resume
**Передумови:** Активна кампанія.
**Дії:**
1. Натиснути `Pause` на рівні проспекта або кампанії.
2. Зачекати кілька циклів раннера (ticks).
3. Натиснути `Resume`.
**Очікуваний результат:**
- **Canonical DB State:** На паузі стан має бути `paused`. Після Resume — `pending`.

---

## P2: Edge Cases / Exploratory (T-002 Adversarial Scenarios)

Ці сценарії є специфічними hostile vectors, виявленими під час Red Team #2, для підтвердження надійності виправлень.

### Сценарій P2.1: Пізня відповідь та Heuristic Overwrite (F-01)
**Дії:** 
1. Створити DAG: `Message 1` → `Wait 3 Days` → `Message 2` (різні `on_replied` гілки).
2. Проспект доходить до `Wait 3 Days`.
3. Надіслати email-відповідь на `Message 1` (точно в тред).
**Очікуваний результат:** Deterministic routing! Профіль переходить на гілку відповіді для `Message 1`. Legacy heuristic не повинен перенаправити його на `Message 2 on_replied`.

### Сценарій P2.2: Case-Sensitivity та Paused Replies (F-02)
**Дії:** 
1. Досягти стану `paused` для профілю (наприклад, зупинити кампанію або чекати `human_approval`).
2. Надіслати email-відповідь від проспекта.
**Очікуваний результат:** `processReply` має успішно знайти профіль і обробити відповідь, розбудивши його з `paused`.

### Сценарій P2.3: Fencing Lock Check перед Side Effect (F-05)
**Дії:** 
1. Поки раннер знаходиться на кроці відправки `Message` (після відкриття браузера, але перед кліком), симулювати втрату локу (виконати `UPDATE account_locks SET locked_at = '2000-01-01'`).
**Очікуваний результат:** `assertLock()` безпосередньо перед відправкою має викинути помилку `FENCING ABORT`, і повідомлення не має бути надіслано.

### Сценарій P2.4: Race Condition під час Unenroll / Bounce (F-07 / F-08)
**Дії:** 
1. Запустити `Message`. 
2. Доки Playwright повільно друкує текст, виконати Unenroll через UI або симулювати Webhook email-bounce (hard bounce).
**Очікуваний результат:** Наприкінці тіка (tick) профіль ПОВИНЕН залишитися у стані `completed` (canonical) та `skipped`/`failed` (track). Воркер не повинен "сліпо" перезаписати статус назад на `pending` або `running`.

### Сценарій P2.5: Маскування статусу (F-10)
**Дії:** 
1. Отримати `uncorrelated_reply` (надіслати листа від проспекта, який є в системі, але не в рамках треду кампанії, або коли в нього є кілька активних run_profiles).
**Очікуваний результат:**
- **Canonical DB State:** `state = 'paused'`, `waiting_for_condition = 'uncorrelated_reply'`.
- **UI:** Профіль має чітко показувати стан паузи / потребу втручання (не маскуватися під звичайний `In Progress`). *Contract Ambiguity: Якщо UI взагалі не має екрану для uncorrelated_reply, профіль просто повинен зависнути у видимому стані Paused, а не симулювати активність.*

### Сценарій P2.6: Відповідь під час Delay
**Дії:** 
1. Кампанія на кроці `Wait 5 Days`. Перевірити, що `next_eval_at` коректно встановлено на +5 діб.
2. Не використовуючи Time-Travel, надіслати відповідь від проспекта.
**Очікуваний результат:** Профіль миттєво "прокидається", перериває затримку (ігнорує `next_eval_at`) та переходить до гілки `on_replied`.

### Сценарій P2.7: Worker Restart & Repeated Ticks (Recovery)
**Дії:** 
1. Під час масової розсилки повідомлень жорстко вбити процес воркера.
2. Перезапустити процес.
**Очікуваний результат:** Після закінчення таймауту `account_locks` (5 хвилин), воркер підхоплює профілі, що зависли в `running` або `pending`, і продовжує роботу без надсилання дублікатів (якщо попередній запис в БД був успішним).

---

## Формат звітності (Reporting Format)
Для кожного дефекту, виявленого під час тестування (навіть найменшої розбіжності між UI та фактичним станом БД), фіксуйте:

- **Observed:**
- **Expected:**
- **Reproduction Steps:**
- **Evidence:**
- **Severity (CRITICAL / HIGH / MEDIUM / LOW):**
- **Campaign Impact:**

Після закінчення QA, надайте загальний список знахідок та рекомендацію щодо наступної фази (R4 Task Force або розширення регресії).

---

## 📌 Human QA Execution Log (P0.1)
**Date:** 2026-09-09
**Status:** P0.1 Confirmed Fixed, moving to P0.3

### 1. Repeat Connect Bug (CRITICAL)
- **Observed:** Second run of campaign sent a connection request again.
- **Root Cause:** DAG migration stripped historical DB pre-checks (`targets.connection_requested_at` & `targets.degree`) from `executeStep` for `connect`. Playwright was launched unconditionally, and due to a regex miss on the fallback Connect selector (custom-invite), it successfully clicked "Send" again.
- **Fix:** Restored the exact historical pre-fencing DB checks. If `degree === 1` or `connection_requested_at` exists, the step immediately returns `{ status: "SKIPPED" }` or `{ status: "SUCCESS" }` bypassing Playwright.
- **Verification:** Verified by Human QA. Target with existing invite outputs `already connected — skipping connect step`. Status: **CONFIRMED / FIXED**.

### 2. NEXT ACTION = "Soon" (P1)
- **Observed:** Pipeline UI showed "Soon" for the next action time after reaching a Wait step.
- **Root Cause:** The UI reads `next_step_at` from `run_profile_tracks`. The C2 state machine writes next runtime to `run_profile_states.next_eval_at`. The trigger `sync_run_profile_tracks_state` was not syncing this column.
- **Fix:** Added `next_step_at = NEW.next_eval_at` to the trigger and ran a manual SQL backfill.
- **Verification:** UI correctly displays relative time (e.g. `Tomorrow`, `in 24h`). Status: **CONFIRMED / FIXED**.

### 3. PLAYBOOK Label in UI
- **Observed:** "PLAYBOOK" text was rendering statically above the steps in the Pipeline UI.
- **Root Cause:** Hardcoded decorative render block in `pages/workflows/[id].tsx:3956`.
- **Fix:** Removed the rendering node. 
- **Verification:** UI now cleanly displays `PIPELINE`. Status: **CONFIRMED / FIXED**.

### 4. Draft Account Persistence
- **Observed:** Account selections on the last step of the Wizard are lost if you click "Save" instead of "Launch".
- **Root Cause:** Application architecture binds Accounts to `runs`, not to `workflows`. Draft mode has no `run`.
- **Decision:** Works As Designed. No DB schema changes will be introduced to persist Draft accounts. Status: **CLOSED / NO FIX**.

### 5. Pipeline Branches UI
- **Observed:** Branches (like `on_replied`) do not render as a DAG in the Pipeline UI.
- **Root Cause:** Frontend blindly iterates over `steps.filter(...)` sequentially and ignores the `edges_json` DAG map.
- **Decision:** Not a blocker for Campaign Engine execution. Deferred to future UI iterations. Status: **DEFERRED**.

**Next Phase Action:** Proceed to **P0.3 Reply Routing** execution.

---

## 📌 Deferred / Backlog Findings (Human QA)
These findings were identified during the R4 Human QA phase but are explicitly deferred to maintain focus on P0 execution and Campaign Engine integrity.

### QA-01: SMTP test returns 500 on invalid credentials
- **Observed:** Invalid SMTP credentials cause a 500 Internal Server Error (crypto decryption failure) instead of a graceful UI error.
- **Severity:** HIGH
- **Impact:** Impedes reliable SMTP configuration, though it doesn't directly break Campaign Engine execution if credentials are correct.
- **Status:** Deferred — fix outside of Human QA scope.

### QA-02: HubSpot Credential Naming
- **Observed:** User reported "HubSpot Legacy App Access Token" in integrations settings.
- **Investigation:** Verified `pages/settings.tsx:2274`. Updated placeholder to `HubSpot Legacy App Access Token` per user clarification.
- **Severity:** LOW
- **Status:** Closed.

### QA-03: Undefined AI Provider Architecture
- **Observed:** Multiple AI providers (OpenAI, OpenRouter, Claude) are available in settings, but routing precedence, usage contract, and fallbacks are undocumented/undefined.
- **Severity:** MEDIUM
- **Recommendation:** Requires a dedicated "AI Provider Architecture & Routing Audit".
- **Status:** Deferred — not a blocker for Campaign Engine QA.

### QA-05: Variable Insertion Cursor Position
- **Observed:** Variables in the Message editor are always appended to the end of the text instead of the active cursor position.
- **Severity:** MEDIUM
- **Impact:** UX friction requiring manual repositioning of variables.
- **Status:** Deferred — not a blocker for Campaign Engine QA.

