# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

IPRS Platform Backend for an AI-powered onboarding & Q&A chatbot platform (musicians joining IPRS).

**Implemented**: auth (OTP/JWT), user + registration modules, document upload with real OCR
(`ocr.choira.io`) for PAN/Aadhaar/bank, and a backend-driven Typebot relay (`conversation` module)
that drives the onboarding conversation via Typebot's Chat API.

**Still out of scope / later milestones**: the AI Q&A chatbot itself (RAG/vector DB/tool calling —
`aiEngine.js` is still a stub, only reachable once `ApplicationStatus === 1`), WhatsApp channel
integration, staff dashboard, payments, escalation. Don't implement these without being asked.

## Stack

- **Node.js 20+** (ES Modules, `"type": "module"`)
- **Express 4**
- **Prisma ORM 5 + SQL Server** (local instance `SQLEXPRESS01`, DB `Dreamsoft_UAT`)
- **JWT** (`jsonwebtoken`), **Zod** validation
- **Helmet**, **CORS**, **express-rate-limit**
- **Pino / pino-http** logging
- **bcryptjs**, **http-status-codes**, **dotenv**
- Tests via **`node:test`**

## Commands

```bash
npm run dev              # node --watch src/server.js
npm start                # production boot
npm test                 # node:test against "test/**/*.test.js"
npm run prisma:migrate   # prisma migrate dev
npm run prisma:generate  # prisma generate
npm run prisma:studio    # prisma studio
npm run build:progress-map  # regenerate progressMap.js from the live Typebot flow
npm run setup:db         # enable SQL Server TCP/SQL auth, create Dreamsoft_UAT + iprs_app login, write DATABASE_URL to .env
```

- Always run `npm test` (and `node --check` on any file you touch) before finishing.
- No linter/formatter/typecheck is configured — don't hunt for ESLint/Prettier. `node --check` + `npm test` are the only verification.
- `setup:db` is a Windows-only PowerShell script (`scripts/setup-db.ps1`) that must be run **as Administrator**.
  It assumes a local SQL Server named instance `SQLEXPRESS01` and rewrites `DATABASE_URL` in `.env`.
  After it runs, import the schema from the production dump: `sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/mra_cleaned.sql`.
- **`AUTO_CLOSE` must stay OFF.** SQL Express defaults it ON for a database created this way, and
  with it on SQL Server shuts the database down once the last connection closes, reopening it on the
  next connect. Prisma's pool closes idle connections, so any idle gap triggers a reopen that takes
  seconds and can fail outright — surfacing as `P1001` "Can't reach database server" mid-conversation
  (observed: a `SELECT 1` at 2843ms after idle, then 2ms). `setup-db.ps1` now sets it off
  unconditionally; on a database created before that, run it by hand:
  `sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d master -Q "ALTER DATABASE Dreamsoft_UAT SET AUTO_CLOSE OFF;"`
  Check with `SELECT is_auto_close_on FROM sys.databases WHERE name='Dreamsoft_UAT'` — must be `0`.

## Architecture & Data Flow

```
Route → Controller → Service → Repository → Prisma → SQL Server
```

Layering rules (non-negotiable):
- **Controllers**: thin. Parse already-validated input, call a service, format response via `shared/response.js`. No business logic.
- **Services**: all business logic (use cases, orchestration, throwing `AppError`s).
- **Repositories**: data access only. **No validation, no business logic.**
- **Validators**: Zod schemas only.

### Folder layout
```
src/
├─ config/          env.js (Zod-validated env loader)
├─ shared/          prisma.js, response.js, errors.js, errorHandler.js, validate.js, asyncHandler.js
├─ utils/           logger.js (Pino), token.js (JWT)
├─ middlewares/     auth.js (JWT), rateLimiter.js
├─ modules/
│  ├─ auth/         services/otp/{interface,factory,mock,msg91} + tokenBlacklist.js
│  ├─ user/         repository only - service/controller/routes/validators removed, unused
│  │                (auth.service.js imports user.repository.js directly at login)
│  ├─ registration/  controllers/services/repositories/validators
│  ├─ conversation/ services/{conversation.router,typebot/*} + engines/{aiEngine,registrationEngine}.js
│  └─ health/
├─ app.js           middleware + route assembly
└─ server.js        DB connectivity check (fail-fast) + bootstrap + graceful shutdown
prisma/             schema.prisma (no migrations/ folder - schema comes from the SQL dump)
scripts/            setup-db.ps1
test/               smoke, spotify, email-otp, workMatch, workLink,
                    emailOtpGate, registrationReview, progressMap
```

Each module is self-contained (its own routes/controllers/services/repositories/validators). Extend by adding modules rather than growing cross-module dependencies.

## Code Conventions

- Use **`async`/`await`** everywhere. Node 20+, ESM.
- Use **ES Modules with `.js` extensions** on all imports (Node ESM requires explicit extensions).
- Use **private class methods** (`#method`) for internal helpers on services.
- Follow **SOLID** and keep modules **loosely coupled**; use dependency injection where it aids testability.
- `default`-export route routers; use named exports elsewhere.
- Add comments only where they clarify intent.
- No code style: decorators (none), classes used for services/repositories.
- Do not duplicate logic — reuse shared helpers.

## Response & Error Conventions

**Success shape** — via `shared/response.js`:
```json
{ "success": true, "data": { ... }, "meta"? }
```
Use `ok(res, { data, meta?, status? })`, `created(res, data)`, `accepted(res)`.

**Error shape** — produced by `shared/errorHandler.js`:
```json
{ "success": false, "error": { "code": "...", "message": "...", "details"? } }
```

**Error factories** in `src/shared/errors.js` (function-based; each returns a real `Error` shaped for the central handler):
- `badRequestError` (400, `BAD_REQUEST`)
- `unauthorizedError` (401, `UNAUTHORIZED`)
- `forbiddenError` (403, `FORBIDDEN`)
- `notFoundError` (404, `NOT_FOUND`)
- `conflictError` (409, `CONFLICT`)
- `validationError` (422, `VALIDATION_ERROR`)
- `appError` (generic; default 500, `INTERNAL_ERROR`)

Central handler (`shared/errorHandler.js`) maps:
- **Zod errors** → 422 `VALIDATION_ERROR` (with `details`)
- **Prisma** `P2002` → 409, `P2025` → 404, `P2003`/`P2014` → 400, other known → 500
- **JWT** verify failures → 401 (raised in `middlewares/auth.js`)
- Malformed JSON body → 400
- Unknown errors → sanitized 500 (never leak internals); logged with full stack.

Routes wrapped with `asyncHandler` (Express 4 doesn't catch rejected promises).

## Validation Middleware

`src/shared/validate.js` uses `schema.shape`, **not** `schema.body`:
```js
router.post('/x', validate(someSchema), controller.handler);
```
Schemas are objects shaped `{ body?, query?, params? }`. Always call `.parse`; Zod throws → central handler returns 422.

## Auth & Middleware

- `authenticate` (JWT) middleware sets `req.user = { id, phone, registrationStatus }`.
- Use it on protected routes. Blacklist-aware logout lives in the auth service.
- Rate limits: global + stricter auth limiter in `middlewares/rateLimiter.js` (configurable via env).

### One account per phone number, one per email

`AccountMobile` is the login identity, so the *stored* spelling of a number has to be canonical.
**`src/utils/phone.js`'s `normalizePhone()` is the only definition of that format**: digits only,
country code included, no leading `+` (a bare 10-digit number is assumed Indian and gets `91`
prefixed); anything outside 10–15 digits returns `null`.

`auth.service.js` normalizes **once** at the top of `sendOtp()`/`verifyOtp()` and uses the result for
the OTP call, the `findByAccountMobile()` lookup and the `create()` payload alike. Before this,
the number was stored exactly as typed while `msg91OtpProvider.js` normalized only for the outbound
SMS — so `+919876543210`, `919876543210` and `9876543210` all passed OTP (MSG91 sees one number)
but missed the lookup each time and produced **three accounts**. `msg91OtpProvider.js` now imports
the same helper rather than keeping its own.

Emails are stored **trimmed and lowercased** by `saveConversationField()`, and the chat's email step
calls `registrationService.isEmailTakenByAnotherAccount()` *before* sending an OTP — a member whose
address belongs to someone else is told so and re-asked, with no wasted mail (`email-already-registered`
in `registrationEngine.js`, beside the existing `email-invalid-format` branch).

Both are backed by **filtered unique indexes** created by `scripts/add-unique-indexes.sql`
(`UQ_App_Accounts_AccountMobile`, `UQ_App_Accounts_AccountEmail`). Read that file before touching any
of this — three things matter:
- **The filter is not optional.** SQL Server treats `NULL` as a value in a unique index and permits
  only *one* NULL row; most accounts have no email until they reach that chat step, so an unfiltered
  index would reject the second such account. The predicate excludes `NULL` and `''`.
- **They are deliberately not in `schema.prisma`.** Prisma can't express a filtered index and
  `@unique` would generate exactly the broken unfiltered form. The cost is that **`prisma db push`
  doesn't know they exist and may drop them — re-run the script after any push.** It's idempotent.
- `verifyOtp()` catches `P2002` on create and re-fetches, so two requests racing to register the same
  new number both end up logged into one account instead of one seeing an error.

## Environment / Config

- `config/env.js` reads `.env` and validates via Zod (fails fast) — **add env keys to `.env`, `.env.example`, and the `envSchema`**.
- Key vars: `PORT`, `DATABASE_URL`, `JWT_SECRET` (≥16 chars), `JWT_EXPIRES_IN`, `JWT_ISSUER`, `CORS_ORIGIN`,
  `OTP_PROVIDER` (mock|sms), `OTP_TTL_SECONDS`, `OTP_MOCK_VALUE` (dev-only fixed OTP),
  `MSG91_AUT_KEY`, `MSG91_TEMP_ID`, `MSG91_OTP_LENGTH`, `MSG91_OTP_EXPIRY`, plus global/auth rate-limit values.
- OCR: `OCR_PROVIDER` (http|stub), `OCR_API_BASE_URL`, `OCR_REQUEST_TIMEOUT_MS`.
- `SUPPORT_CONTACT` - shown at the pre-payment review when the member says something needs
  correcting. Optional; blank falls back to "our team will get in touch".
- Work links: `YOUTUBE_REQUEST_TIMEOUT_MS`; `GEMINI_API_KEY` (**optional** - blank disables title
  parsing and the card falls back to the raw video title), `GEMINI_MODEL`, `GEMINI_REQUEST_TIMEOUT_MS`.
  There is no YouTube API key: metadata comes from the keyless oEmbed endpoint - see "Work Links".
- Typebot: `TYPEBOT_API_BASE_URL`, `TYPEBOT_ID`, `TYPEBOT_PREVIEW_MODE`, `TYPEBOT_API_TOKEN` (optional),
  `TYPEBOT_REQUEST_TIMEOUT_MS`, `MAX_UPLOAD_SIZE_MB` (multer limit on `POST /conversation/upload`).
- Never commit real `.env` (it's git-ignored); keep `.env.example` in sync.

## Prisma

- `prisma/schema.prisma` is generated from the live DB with `npx prisma db pull` (the 13 tables
  imported from `scripts/mra_cleaned.sql` / `Dreamsoft_UAT`). When the DB changes, re-run `db pull`.
- The "user" table is `App_Accounts` (`@@map("App_Accounts")`), model `AppAccounts`; PK `AccountId` is a
  SQL Server `bigint` → Prisma `BigInt` (stringify ids when putting them in JWTs / route params).
  `AccountMobile` is the OTP login identifier; `ApplicationStatus` (1 = completed) drives registration routing.
  Field names mirror the DB columns (PascalCase, e.g. `AccountName`, `AccountMobile_Alt`) — verify with
  `npx prisma db pull` rather than hand-writing. `@db.Money` columns are typed `Float`, not `Decimal`.
- No migrations are used: the schema is imported from the production dump (`scripts/mra_cleaned.sql`), so
  there is no `prisma/migrations/` folder. For an additive schema change (e.g. the `PANNo` column,
  added for OCR), use `npx prisma db push` after editing `schema.prisma` — `prisma:migrate` (`prisma
  migrate dev`) fails here because it needs shadow-database `CREATE DATABASE` permission the
  `iprs_app` DB user doesn't have. This still isn't a green light to add columns freely — the
  `PANNo` addition (see "Typebot Registration Flow" below) only happened after confirming no
  existing column could hold it; treat any further schema change the same way: stop, check whether
  an existing column genuinely can't work, and say so explicitly before editing `schema.prisma`.
- Use the shared singleton from `shared/prisma.js` in repositories. It exposes `pingDatabase()`
  (a `SELECT 1` probe) used by `server.js` at boot and by the health service.
- **Not everything in the DB is in `schema.prisma`.** The two filtered unique indexes on
  `App_Accounts` (`AccountMobile`, `AccountEmail`) live only in `scripts/add-unique-indexes.sql`,
  because Prisma cannot express a filtered index — `db pull` won't bring them back and `db push` may
  drop them. Re-run that script after any push. See "One account per phone number, one per email".
- Prisma is pinned to v5 (`prisma` + `@prisma/client` `^5.22.0`). **Do not upgrade to v6/v7** —
  it's a breaking change (mandatory `prisma.config.ts`, driver adapters, new generator) with no benefit
  for this milestone. If you ever do, treat it as a dedicated migration task.

## Pluggable Providers (design extension points)

- **OTP**: `modules/auth/services/otp/otpProvider.interface.js` defines the contract;
  `mockOtpProvider.js` (default, echoes OTP in dev) and `otpProvider.factory.js` selects by
  `OTP_PROVIDER`. For future third-party SMS: add `SmsOtpProvider`, flip env. Do not touch controllers/services.
- **Token blacklist**: `modules/auth/services/tokenBlacklist.js` in-memory now; swap for Redis behind the same interface in a later milestone.

## Typebot Registration Flow

These endpoints are mounted on the existing `/registration` router (no `/api/v1` prefix — nothing
else in this app uses one) and sit behind the existing `authenticate` middleware. Originally
designed for Typebot's own Studio HTTP Request blocks to call directly; as of the backend-driven
relay (see Conversation Router below), `saveDocument()` is instead called **in-process** from
`registrationEngine.handleUpload()` for uploads that arrive through `/conversation/upload`, and
`complete()` is called **in-process** from `registrationEngine.handle()` when the Typebot session
ends. **The live published flow has zero HTTP Request blocks of any kind** (confirmed via the
builder API, `bot.builder.choira.io/api/v1/typebots/{id}/publishedTypebot`) — Typebot itself never
called `basic-details` or `complete` even before this, since no HTTP Request blocks exist in the
flow to call them.

**`POST /registration/start`, `PATCH /registration/:registrationId/basic-details`, and
`PUT /registration/status` were removed** — grepped every call site in `src/` and confirmed nothing
in the live chat flow (or anywhere else internally) ever called them; `registrationId` is just the
stringified `App_Accounts.AccountId` already returned at login (`user.id`), so `start()` was a
no-op wrapper, and `saveBasicDetails()`/`updateStep()` collected fields (`FirstName`/`LastName`/
`DOB`/`Gender`/`AccountAddress`, or a linear step count) the Typebot flow never asks for and no
other caller ever populated. `registration.service.js` no longer exports `start`/`saveBasicDetails`/
`updateStep`. `GET /registration/status` stays — it's the real, documented signal the frontend uses
to check `completed: true/false`.

- `POST /registration/:registrationId/documents/:documentType` — body `{ documentUrl }` (S3 URL
  from Typebot's own upload). `documentType` is a Zod enum: `PAN`, `AADHAAR`, `BANK`, `NOC`,
  `COMPANY_DOC`, `PROFILE_PHOTO` (a single generalized route, not one per type — reuses
  `saveDocument`/`upsertDocument` unchanged for every type, to avoid duplicating the same logic
  across N routes). Upserts an `App_Accounts_Doc` row keyed by `(AccountId, DocumentName)`
  (manual find-then-update-or-create — no unique constraint exists to use Prisma's native
  `upsert`). **`DocumentName` holds the type string, `DocumentCaption` holds the S3 URL** — this is
  the user's required orientation and it is the *opposite* of what the column names suggest, so
  don't "fix" it. Both columns are `NVarChar(500)`: `DocumentCaption` was widened from
  `NVarChar(100)` via `npx prisma db push` specifically because the S3 URLs run ~220 chars and
  would otherwise fail every upload with a SQL Server truncation error. The API response keys
  (`documentType`/`documentUrl` in `toDocumentPublic()`) intentionally keep their self-describing
  names and just read from the swapped columns, so nothing downstream changed.
  **`DocumentLookupId` is intentionally left `null`** — `Doc_LookUp` has zero seed rows in the
  current DB/dump, so there's nothing valid to reference; wire it up once that lookup table is
  populated.
- `POST /registration/:registrationId/complete` — requires `AccountEmail` set + all
  3 *required document groups* satisfied (see `REQUIRED_DOC_GROUPS` in `registration.service.js`),
  else 400 `REGISTRATION_INCOMPLETE` with a `details.missing` list of group labels.
  Each group is satisfied by **any one** of its types, because the same real-world requirement is
  collected under a different doc type on each role path:
  - `identity` — `PAN` (Indian individual) | `COMPANY_PAN` (company) | `PASSPORT` / `TIN` (NRI,
    who often has no Indian PAN at all)
  - `bank` — `BANK`
  - `address-proof` — `PERMANENT_ADDRESS_PROOF` (individual) | `REGISTERED_ADDRESS_PROOF` (company).
    `COMM_ADDRESS_PROOF`/`COMM_ADDRESS_PROOF_2` deliberately don't count — they're the secondary
    correspondence address, not proof of the primary one.

  Everything else (`NOC`, `COMPANY_DOC`, `PROFILE_PHOTO`, `CURRENT_ADDRESS_PROOF`, and every
  path-specific upload like `TRC`/`SS_NUMBER`/`MOA_AOA`) is conditional in the Typebot flow and
  doesn't gate completion.

  **This used to be a flat `REQUIRED_DOC_TYPES = [PAN, BANK, PERMANENT_ADDRESS_PROOF]`**, which made
  completion *impossible* on the three company/NRI paths: they upload `COMPANY_PAN` /
  `REGISTERED_ADDRESS_PROOF` / `PASSPORT`+`TIN` instead, so `complete()` threw
  `REGISTRATION_INCOMPLETE` forever. Nothing surfaced the failure — the chat just ended,
  `ApplicationStatus` stayed `null`, the `TeritoryAppFor` fallback never fired, and the member never
  reached the AI engine. **When a new role path is added, check its uploads against these groups.** Otherwise reuses the existing `markCompleted`/`toPublic`
  (`ApplicationStatus = 1`) already used by `GET /status`.

**Fields intentionally not persisted**: the actual Typebot flow also asks about role
(lyricist/composer), membership in another society, tax residency, and a Spotify link. None of
these map to a documented `AppAccounts` column — the generic `Detail1`…`Detail12` free-text columns
are shared production data (`Dreamsoft_UAT`) whose usage elsewhere is unverified, so nothing guesses
a mapping for these. These answers live only in Typebot's own result store, not in this DB, until a
real column/mapping is confirmed.

**GST number, stage name/alias, email, place of birth, role (lyricist/composer/both), and territory
applied for (INDIA/WORLD)** *are* persisted (via `conversationFieldMap.js` +
`registrationService.saveConversationField()`, see "Conversation Router" below) — `GSTNo` (new
column, added the same way `PANNo` was) and the existing
`AccountAlias`/`AccountEmail`/`PlaceOfBirth`/`RollTypeIds`/`TeritoryAppFor` columns. Territory
initially had no `options.variableId` set in Studio at all (Typebot only branched on it, never
stored it to a variable) — the user assigned it a variable and republished, confirmed live via the
builder API (`variableId = vufrpq6qr5rpcbewbffajjb73`), then it was wired the same way as every
other `conversationFieldMap.js` entry.

**`TeritoryAppFor` defaults to `'WORLD'`** if it's still empty when `complete()` runs — a real
INDIA/WORLD answer is persisted normally by `saveConversationField()` and wins; the fallback only
fills the gap when the user skipped the territory question or never reached it. It deliberately sits
in `complete()` rather than on the skip itself: the territory blocks have no Typebot skip option
configured on any of the four role paths, and `registrationEngine.handle()` only persists a truthy
answer, so there is no skip event to hook (and how the frontend would signal one isn't decided).
It's placed after the `missing` validation so an abandoned registration isn't silently stamped, and
it's idempotent — it only fires while the column is empty.

**Bug found and fixed**: `PlaceOfBirth`'s key was `vfvvwcz6g7ueiw2lhqnwvg9z` — which turned out to
be the **block id** of the "Please enter your place of birth" text-input block, not its
`options.variableId` (`vy80zc5eoveac6euqlurki58o`, confirmed via the builder API). Since
`resolveConversationField()` matches against `input.options.variableId`, not the block id, this
entry never matched anything and the field was never persisted — in any session, since it was first
added. Fixed by correcting the key. **Every `conversationFieldMap.js`/`addressProofTypeMap.js`
entry must be verified against `options.variableId` specifically** (fetch the live published flow
via the builder API and check the block's `options.variableId`, not its `id` or any other field) —
a block id and a variableId can look superficially similar and this exact mixup is easy to repeat.

**DOB and Gender from OCR** are also now persisted, alongside `PANNo`/bank fields/address in
`runOcrAndPersist()`: `DOB` (from whichever doc type's OCR happens to include `extracted.dob` - PAN,
previously also Passport - parsed from the API's `DD/MM/YYYY` string format via a small
`parseOcrDate()` helper, since `Date`'s constructor assumes `MM/DD/YYYY`), `Gender` (from
Aadhaar/Voter ID's `extracted.gender`). Both follow the same "opportunistic, whichever OCR call
produced it" pattern as `address` above, and the same "never let a bad value break the upload"
guarantee (`parseOcrDate()` returns `undefined` — skipping the write — on anything that doesn't
match `DD/MM/YYYY`, rather than throwing). `Nationality` is written from the passport's OCR (Passport is the only
document that carries it) **and** from the NRI path's `nationality` chat answer via
`conversationFieldMap.js` — last write wins. This write did not actually exist until Passport OCR
was re-enabled; this note described it as merely "dormant", which was wrong.

**The all-role typebot (live)**: the flow covering all 4 IPRS role paths is the one `.env`'s
`TYPEBOT_ID` points at — publicId `all-flow-finished-p4opm8e`, internal id
`mn21d4958sjb2buibp4opm8e`. It replaced `all-flow-fanished-hp9331j` (internal
`snhwth8081stwrvmthp9331j`), which is a **spelling-corrections-only** re-publish: verified id by id
against the old flow — same 149 groups, 276 blocks, 234 edges, 58 variables, identical block→variable
bindings, item ids and edge wiring. Only 9 button labels and 68 message texts changed, and no code
matches any of them (every gate keys off a variableId or block id). The old bot is still live if a
revert is ever needed. It is reached from a single top-level choice (Group with the choice input
"(Individual) Author/Composer | (NRI) Author/Composer | Owner/Publisher | (NRI) Owner/Publisher" —
Owner/Publisher further splits into Corporate/Partnership/Sole Proprietorship). The earlier
individual-only typebot (`uday-updated-typebot-flow-42ihn4e` / internal `t8zbgib0plx83gw7242ihn4e`)
is no longer used. To inspect a flow: `startChat` against its publicId returns its internal `typebot.id` in the response, which you
then pass to the builder API (`bot.builder.choira.io/api/v1/typebots/{internal-id}/publishedTypebot`)
to get the full `groups`/`edges`/`variables` graph — the publicId alone doesn't work against the
builder API, only the internal id does. **BFS the `edges` graph from the desired role-choice item's
`outgoingEdgeId`** to find exactly which groups/variables belong to that path — group titles are
Typebot's auto-generated defaults (`"Group #44"` etc.) and are **not unique**; several unrelated
groups across different branches can share the same title, so never use group titles to disambiguate
branches, only edge-traced group ids.

**(NRI) Author/Composer path — wired.** Confirmed via the BFS above: the individual path's existing
`conversationFieldMap.js`/`documentTypeMap.js`/`addressProofTypeMap.js` entries (GST, role, stage
name, email, place of birth, photo, passbook, permanent/current address proof, Spotify URL, NOC) are
reused unchanged by the NRI path — same variableIds. Two things needed fixing/adding:
- `teritory`'s variableId **changed** in the new typebot: `vn91tusicqaolw34d4zq2id33` (was
  `vufrpq6qr5rpcbewbffajjb73`) — this isn't NRI-specific, it's the same territory question for every
  path, just republished with a new id. Fixed in `conversationFieldMap.js`.
- New NRI-only fields, each mapped to an already-existing, previously-unused `AppAccounts` column
  (no schema change needed) — added to `conversationFieldMap.js` + `CONVERSATION_FIELDS`:
  `nationality` (text) → `Nationality` (same column OCR already writes from a passport upload —
  opportunistic, last-write-wins, same pattern as `DOB`/`Gender`); `dual_nationality` (Yes/No choice)
  → `DualNationality` (`Int`/TinyInt — `saveConversationField()` special-cases this field to convert
  "Yes"/"No" to `1`/`0` instead of writing the raw string, since every other `CONVERSATION_FIELDS`
  entry is a plain string column); `assosiation_name` → `AssociationName_India`.
- New NRI-only uploads, all save-only (no OCR endpoint exists for any of them, same treatment as
  `NOC`) — added to `DOC_TYPES` + `documentTypeMap.js`: `TRC` (Tax Residency Certificate — `TRCNo`
  column stays unused, there's no OCR text to extract from an upload-only block), `SS_NUMBER`
  (`SocialSecurityNo` stays unused, same reason), `FORM_41` (`TenFform` stays unused), `TIN` (no
  matching column exists on `AppAccounts`), `SELF_DECLARATION` (no matching column). One exception:
  `passport_indivisual` (a real passport upload) maps straight to the **existing** `DOC_TYPES.PASSPORT`
  — at the time this was wired, `PASSPORT` was still in `OCR_DOC_TYPES`, so this upload got the same
  `DOB`/`Nationality` extraction as every other passport OCR call, for free. Passport OCR is now
  temporarily disabled (see below), so this upload currently just saves as-is (`DocStatus = 0`),
  same as any other no-OCR type — no mapping change needed here when Passport OCR comes back, the
  behavior just resumes automatically.
- New **manual address entry**: the NRI path adds a 6th choice, "Type your address", to both
  address-proof-type questions (Individual's lists are unchanged, still 5 options with no manual
  option). Picking it skips the file-upload step and branches straight to a plain text-input block
  instead — `P_address` (permanent) and `c_address` (current), each with its own dedicated
  variableId. No new session-stash or engine branching was needed for this: they're just two more
  `conversationFieldMap.js` entries (`P_address` → `AccountAddress`, `c_address` →
  `AccountAddress_PR`), since the existing `resolveConversationField()`/`saveConversationField()`
  pathway already handles arbitrary text-input variableId → column writes regardless of block type.
  The only other change needed was suppressing a spurious "did not resolve to an OCR type" warning
  in `registrationEngine.js` for this specific answer (`addressProofTypeMap.js`'s
  `isManualAddressAnswer()`) — picking "Type your address" still answers the address-proof-**type**
  choice question first, so the existing OCR-type-resolution code path runs for it too, just with a
  known, expected non-match.

**(NRI) Owner/Publisher path — wired.** Traced the same way (BFS from the role-fork's
"(NRI) Owner/Publisher" item, edge `ygk4nzbboap2jgdsech9wmkt` → 37 reachable groups). Reuses
`gst_no`/`email`/`teritory`/`assosiation_name` and the `Noc`/`passbook`/`tin_upload`/
`SS_NumberUpload`/`Form41_upload` uploads unchanged. New wiring:
- **Text fields** (`conversationFieldMap.js` + `CONVERSATION_FIELDS`): `chanel_desc` → `ChanlDesc`,
  `traderName` → `AccountAlias` (the company path's trade name reuses the column the individual path
  uses for a stage name — the two paths are mutually exclusive, so they can't collide),
  `designation` → `KindAttention1` (previously unused).
- **New uploads** (`DOC_TYPES` + `documentTypeMap.js`), all save-only: `COMPANY_PHOTO`, `PEC`,
  `ENTITY_INCORPORATION`, `COMPANY_TRC`, `LETTER`, plus the 3 address slots below. Note
  `COMPANY_TRC` (`trc_upload`, `vxgkslcbrxivgw9h7eruiz11z`) is a **different variable** from the
  individual path's `TRC` (`vasdkr52ehegpcpqfw2a8sxkv`) — same document type, two separate blocks.
- **Three address-proof-type instances, all reusing the SAME variableId**
  (`vgbmeklrpc3b4hu8tvmodnt4e`, i.e. `address_proof_type_current`) with different choice lists, each
  leading to a different upload — edge-traced, since a group's title (`"Group #44"` for all three)
  can't distinguish them:

  | Choice list | → upload slot | manual-entry option → column |
  |---|---|---|
  | Electricity/Telephone/Mobile Bill, GST Cert, Rent Agreement, letter from Owner | `REGISTERED_ADDRESS_PROOF` | "Type registered address" → `registered_address_type` → `AccountAddress` |
  | MOA, Telephone Bill, Incorporation Certificate, Board Resolution copy, Trade License, Letter from Bank | `COMM_ADDRESS_PROOF` | none |
  | Electricity/Telephone/Mobile Bill, GST Cert, Rent Agreement, letter from Owner | `COMM_ADDRESS_PROOF_2` | "Type communication address" → `comm_address2_type` → `AccountAddress_PR` |

  Despite its name, `comm_address` (→ `COMM_ADDRESS_PROOF`) follows the *entity-existence* document
  list (MOA/Incorporation/Board Resolution/Trade License/Letter from Bank), not an address — so it's
  deliberately absent from `ADDRESS_COLUMN_BY_SLOT` and never writes an address column.
  `comm_address2` is the real communication-address proof.
- **Address-column routing was refactored** from an if/else-if chain into
  `ADDRESS_COLUMN_BY_SLOT` (`registration.service.js`), a slot→column lookup now covering
  `PERMANENT_ADDRESS_PROOF`/`REGISTERED_ADDRESS_PROOF` → `AccountAddress` and
  `CURRENT_ADDRESS_PROOF`/`COMM_ADDRESS_PROOF_2` → `AccountAddress_PR`.
- **`handleUpload()`'s `isAddressProofUpload`** check (`registrationEngine.js`) was widened from two
  hardcoded captions to the `ADDRESS_PROOF_UPLOAD_TYPES` set, so a stashed `addressProofOcrType`
  actually reaches the company address uploads too.
- **OCR intent**: eventually every address-proof choice should be OCR'd, but only
  "Electricity/Light Bill" has a live endpoint today. No new `OCR_TYPE_BY_ANSWER` entries were
  needed — everything else correctly resolves to `null` (save-only), exactly like "Letter from
  Property Owner" already did. When more endpoints ship, adding them to that one map is the only
  change required; the routing above already carries the type through.
- **Deliberately not persisted on this path**: `gst_options` (Applicable/Not Applicable — no
  dedicated column, and the `Detail*` columns are unverified shared production data) and
  `workUrl1` (no matching column).

**Owner/Publisher path — wired** (the last of the four role paths; all four are now integrated).
Traced by BFS from the role fork's "Owner/Publisher" item → 44 groups. It opens with an entity-type
fork (Corporate (Pvt Ltd/Ltd Company) / Partnership / sole proprietry consern); the three sub-paths
share almost everything and differ only in a few documents:

| | Documents |
|---|---|
| Common to all three | `company_pan`, `gst_certificate_upload`, plus the already-wired `Noc`, `passbook`, `company_photo`, `comm_address`, `registered_address` set |
| Corporate | `MAA_Upload`, `BR_Upload`, `company_noc` |
| Partnership | `PartnerD_upload`, `AuthorityLetter_Upload` |
| Sole Proprietorship | `TUM_Upload`, `selfDecleration_upload`, `letter` |

Every text/choice field on this path (`email`, `designation`, `assosiation_name`, `chanel_desc`,
`traderName`, `teritory`) was already mapped by the earlier paths — `conversationFieldMap.js` needed
no changes at all. Eight new save-only doc types were added: `COMPANY_PAN`, `GST_CERTIFICATE`,
`MOA_AOA`, `BOARD_RESOLUTION`, `COMPANY_NOC`, `PARTNERSHIP_DEED`, `AUTHORITY_LETTER`, `TUM`.

**`COMPANY_PAN` is the one exception to save-only** — it's OCR'd as a `PAN` (writing `PANNo`/
`Detail2` like the individual path's PAN). Unlike the address proofs, whose OCR type comes from a
preceding choice question stashed per-session, this one is static, so `registration.service.js` has
a small `OCR_TYPE_BY_DOC_TYPE = { COMPANY_PAN: 'PAN' }` map and `saveDocument()` resolves
`ocrDocType ?? OCR_TYPE_BY_DOC_TYPE[docType] ?? docType`. The row keeps the honest `COMPANY_PAN`
caption so a human reviewer can tell a company PAN from an individual one. Verified both ways: with
`OCR_ENABLED=true` a `COMPANY_PAN` upload attempts PAN OCR (`DocStatus = 2` on an unreachable test
URL) while `MOA_AOA` doesn't; with `OCR_ENABLED=false` neither does.

**A Studio gap was found and fixed during this work**: the address-proof upload block
(`yvahr8qbkgfhfuonsrkr49mq`, Group #54, shared by all three entity types) had **no `variableId`
assigned**, so its document would have been silently dropped — `resolveDocumentType(undefined)`
returns `null` and `handleUpload()` then skips `saveDocument()` entirely and just advances. The user
assigned `registered_address` to it and republished, which made it resolve to the already-mapped
`REGISTERED_ADDRESS_PROOF`. **When wiring any new path, scan its subtree for file-input blocks with
no `options.variableId`** — they fail silently, with no error anywhere.

**The entity type is persisted to `EntityType`.** The fork's choice block
(`flgpd2vixmu0djiomet77kmn`) originally had no `variableId` in Studio; the user assigned one
(`EntityType`, `vdrt7gflf0w9rwhkdwbk27mhf`) and republished, and it's wired like any other
`conversationFieldMap.js` entry. **`EntityType` was widened from `NVarChar(10)` to `NVarChar(50)`**
via `npx prisma db push` because all three answers overflow the original width
("Corporate (Pvt Ltd/Ltd Company)" is 31 chars, "sole proprietry consern" 23, "Partnership" 11) —
writing them raw would have failed every Owner/Publisher registration with a truncation error. The
answers are stored verbatim rather than as short codes (a deliberate call by the user; note the
neighbouring `AccountType`/`AccountRegType`/`ApprovalType` columns are `NVarChar(5)` code columns,
so verbatim labels here are a departure from that convention). The column had no pre-existing values
in the dump, so no external convention was being overwritten.

**Deliberate gap on this path**: `workUrl1` (no matching column).

**Deliberately NOT wired** (audited but rejected — don't re-propose without new information). **OCR `name`
is no longer on this list** — it is now written to `AccountName` behind an empty-only guard, see
"AccountName is now populated from identity documents" under Work Links. The rest: the
top-level "(Individual) Author/Composer" vs the other 3 dead-end role choices (only this branch
ever completes registration, so there's no real variance to persist); both consent gates
(fraud-caution + data-consent — only one `Consent`/`ConsentDate` column pair exists for two
distinct consents); `SocietyId` (BigInt FK, semantically wrong for the "member of another society?"
yes/no answer); Spotify URL (no real matching column); OCR `fatherOrHusbandName` (it can
legitimately be a husband's name for married women voters, not a father's);
bank OCR's `city`/`state`, EPIC number, driving-licence number, passport number (no matching column
exists at all for any of these).

**Address-proof OCR's extracted `address`** (from Driving Licence/Voter ID/Electricity Bill - the 3
address-proof types with an `address` field, see `OCR_FIELD_LABELS`) is now persisted too, unlike
every other extracted field: `runOcrAndPersist()` takes a 4th param, `addressSlot` (the original
`docType` `saveDocument()` was called with, before any `ocrDocType` override — i.e.
`PERMANENT_ADDRESS_PROOF`/`CURRENT_ADDRESS_PROOF`), and writes to `AccountAddress` (permanent) or
`AccountAddress_PR` (current) accordingly. This mapping (base column = Permanent, `_PR` suffix =
Current) was user-confirmed, not derived from any column comment — the columns' real semantics
outside this app are otherwise unverified, same caveat as `Detail1`-`Detail12` below.

**Confirmed `Detail1`/`Detail2`/`Detail10` mapping** (user-provided, unlike the rest of
`Detail1`–`Detail12` which stay unmapped): `Detail1` gets a duplicate write of the GST number
(alongside `GSTNo`, in `saveConversationField()`) and `Detail2` gets a duplicate write of the OCR'd
PAN (alongside `PANNo`, in `runOcrAndPersist()`) — both additive, not replacing the named columns.
`Detail10` is set to the literal string `'choira'` by `registrationRepository.markCompleted()`, once,
the first time `ApplicationStatus` flips to 1 — a marker for other `Dreamsoft_UAT` consumers that
this registration came through the Choira onboarding flow. `Detail3`–`Detail9`, `Detail11`,
`Detail12` remain unmapped/unused.

**Auth model**: Typebot runs the existing `/auth/send-otp` + `/auth/verify-otp` first (no new
token mechanism), stores `token` + `registrationId` as variables, and sends
`Authorization: Bearer <token>` on every registration call — reusing `authenticate` unchanged.
Every new service function additionally calls `assertOwnRegistration(userId, registrationId)`
(in `registration.service.js`), which 403s if the path param doesn't match `req.user.id` — the id
alone is never sufficient to touch another user's registration.

**`OCR_ENABLED` (env, default `true`)**: a blanket kill-switch for OCR across every doc type, on top
of (independent from) the per-type `OCR_DOC_TYPES` list below — `saveDocument()` in
`registration.service.js` short-circuits `OCR_DOC_TYPES.includes(...)` with `env.OCR_ENABLED &&`, so
setting it `false` makes every upload behave like NOC (`DocStatus = 0`, no OCR attempted, always
advances immediately). Added because a genuinely OCR'd doc type still blocks the conversation on a
"couldn't read this document, please re-upload" loop when the OCR service itself is unreliable —
this flag unblocks chat-flow testing without needing to touch `OCR_DOC_TYPES` per type. Follows the
same string-default-transform pattern as `TYPEBOT_PREVIEW_MODE` in
`config/env.js` (`z.coerce.boolean()` would treat `"false"` as truthy).

**OCR**: implemented for `PAN`/`AADHAAR`/`BANK`/`DRIVING_LICENCE`/`VOTER_ID`/`ELECTRICITY`
— `NOC`/`COMPANY_DOC`/`PROFILE_PHOTO` never trigger OCR, they just save. `PROFILE_PHOTO` was briefly
wired to the `passport-photo` endpoint (face detection + photo-quality checks) but that endpoint
stopped working and the wiring was reverted — `OCR_DOC_TYPES` no longer includes it,
`DOC_TYPE_PATHS` in `httpOcrProvider.js` has no `PROFILE_PHOTO` entry, and
`buildOcrConfirmationMessages()` is back to a flat `extracted?.[key]` lookup (the dotted-path
`getPath()` helper it briefly needed was removed along with the `OCR_FIELD_LABELS.PROFILE_PHOTO`
entry that was its only consumer). `society-noc` was deliberately **not** wired: its consistency
check needs
`applicantName`/`societyName`/`flatNumber`, and neither `societyName` nor `flatNumber` exists
anywhere in this codebase (no `AppAccounts` column, no Typebot question) - also unclear whether the
flow's "NOC" upload step is even a housing-society NOC.

**`PASSPORT` OCR is live** (re-enabled after the provider-side issues were fixed — re-verified
against the running service, which reads the MRZ and rejects a document of the wrong type). It is
wired in all three places: `OCR_DOC_TYPES` (`registration.service.js`), `DOC_TYPE_PATHS`
(`httpOcrProvider.js`) and `OCR_FIELD_LABELS` (`registrationEngine.js`). Both entry points are
covered — the NRI path's `passport_indivisual` upload, and picking "Passport" as an address-proof
type (`addressProofTypeMap.js` resolves `'PASSPORT'` as the ocrDocType; `saveDocument()` gates on
`OCR_DOC_TYPES.includes(effectiveOcrType)`, so both now run OCR and show a confirmation card).

This one mattered more than the others: on the NRI paths the passport **is** the identity document
(`REQUIRED_DOC_GROUPS`), so while it was disabled it was the one required document with no check at
all, saved straight to `DocStatus = 0`.

**The passport module names its fields differently from every other document** — `dateOfBirth` not
`dob`, `sex` not `gender`, `surname` + `givenName` instead of one `name`.
`normalizeExtracted()` in `registration.service.js` maps them once, before persistence, so the
DOB/Gender/AccountName writes stay document-agnostic. **Without it those three writes silently do
nothing for a passport** — the keys they look for simply are not there. Covered by
`test/ocrLabels.test.js`. Passport-only keys (`passportNumber`, `dateOfExpiry`, `nationality`) pass
through untouched; `passportNumberValid` (the MRZ check digit, the only real checksum any of these
documents carry) is deliberately kept off the confirmation card as staff provenance.

**Still unverified against a real passport**: no member has uploaded one yet and the service has no
passport sample, so this was confirmed only as far as the endpoint being live and correctly
rejecting a non-passport. Watch the first real upload. `ELECTRICITY`'s `OCR_FIELD_LABELS`
field names are a best-effort guess (the collection only documented it as a one-liner: "Bill name +
address") - unmatched keys are silently omitted from the confirmation message (harmless), but worth
confirming against a real success response if a user reports a suspiciously empty confirmation.
`modules/registration/services/ocr/` follows the OTP provider pattern exactly:
`ocrProvider.interface.js` (contract), `ocrProvider.factory.js` (selects by `OCR_PROVIDER` env,
`http` default / `stub` for local dev without network), `httpOcrProvider.js` (calls the real
`https://ocr.choira.io` service), `stubOcrProvider.js` (always throws, kept for
`OCR_PROVIDER=stub`).

**On the "Document Verification API" Postman collection**: this service's transport contract has
flip-flopped **three times** during this project — JSON `{documentUrl}` → multipart `document` file
→ back to JSON `{documentUrl}`. **Currently confirmed live** (matches the latest collection the user
supplied, `document-verification.postman_collection (1)new.json`): the service accepts a JSON body
`{ documentUrl }` on `POST {OCR_API_BASE_URL}/api/documents/{pan|aadhaar|bank|driving-licence|voter-id}`
and returns a `{success, message, code, data}` envelope; a multipart upload is explicitly rejected
with `415 UPLOAD_NOT_SUPPORTED` ("Send the document link in the 'documentUrl' field of a JSON
body"). `httpOcrProvider.js` sends JSON directly (`documentUrl` passed straight through, no
download/re-upload step needed). Errors carry `details: { stage: 'ocr_call', ...body }` for
diagnosability (see `runOcrAndPersist()`'s catch in `registration.service.js`, which logs `stage`
and `details` before degrading to "unverified"). **Lesson, worth repeating**: don't trust a past
empirical finding here without re-probing live (`curl`) if OCR starts failing again — this has
flipped multiple times with no changelog. `/api/documents/bank` isn't in the collection's own
documented endpoint list, but **is live and working** (confirmed via probe - returns a real
`DOCUMENT_NUMBER_NOT_FOUND` with a bank-specific message about account number/IFSC, not a 404), so
`DOC_TYPE_PATHS.BANK: 'bank'` in `httpOcrProvider.js` stays as-is.

`saveDocument()` in `registration.service.js` calls `ocrProvider.extract()` before upserting the
doc row, so the final `App_Accounts_Doc.DocStatus` is written once: `0` = no OCR attempted,
`1` = OCR-verified, `2` = OCR failed (a failed extraction — 422, timeout, or the service being
unreachable — never fails the upload itself; the document still saves, just flagged unverified).
Env: `OCR_PROVIDER`, `OCR_API_BASE_URL` (default `https://ocr.choira.io`),
`OCR_REQUEST_TIMEOUT_MS`.

What gets persisted to `AppAccounts` from a successful OCR result, and what doesn't:
- **PAN**: the extracted number is written to `AppAccounts.PANNo` (`NVarChar(10)`) — added via
  `db push` for this feature. No other PAN-shaped column existed: the only `PanNo` field
  anywhere in the schema is on `AppAccountsTemp`, which is `@@ignore`'d by Prisma (no usable
  primary key) and isn't the table this app writes to.
- **Aadhaar**: extracted number/name/dob/gender/address are used only to compute `verified` —
  never written to `AppAccounts`. Same reasoning as the role/tax-residency/etc. fields above: no
  safe existing column, and this one wasn't worth a schema change. **Aadhaar as its own upload
  step is gone from the live flow** (replaced by the generalized address-proof flow below) — the
  `AADHAAR` doc type/OCR path is kept only for direct REST testability, chat can't reach it anymore.
- **Driving Licence / Voter ID**: same treatment as Aadhaar — extracted fields are used only to
  compute `verified` for the confirmation gate, nothing is written to `AppAccounts` (no matching
  columns exist for either).
- **Bank**: `bankName`/`accountNumber`/`ifsc`/`branch`/`micr` map onto the existing
  `BankName`/`BankAcNo`/`BankIFSCCode`/`BankBranchName`/`MicrCode` columns and get auto-filled on
  success (only fields OCR actually returned — never overwritten with `null`). The bank OCR
  response has no account-holder-name or SWIFT field, so `BankAccountName`/`BankSwift` are
  untouched by OCR.

The document upload response includes `verified` (boolean) and `extracted` (raw OCR data) when
OCR was attempted for that doc type; both are absent for NOC/COMPANY_DOC/PROFILE_PHOTO.

Schema note: `PANNo` and `GSTNo` are the only changes to `prisma/schema.prisma` since the initial
`db pull` import, both applied via `npx prisma db push` (not `migrate dev` — the `iprs_app` DB user
lacks the `CREATE DATABASE` permission `migrate dev`'s shadow database needs), so there is still no
`prisma/migrations/` folder; the live schema and `schema.prisma` are kept in sync directly.

## Conversation Router

`modules/conversation/services/conversation.router.js` decides engine by `user.ApplicationStatus === 1`
(AIEngine) vs everything else (RegistrationEngine). `AIEngine` is still a Week 1 **stub** — out of
scope, leave it. `RegistrationEngine` is a real, backend-driven relay to Typebot's Chat API.

**Architecture**: the frontend never talks to Typebot directly — only to this backend
(`POST /conversation/message`, `POST /conversation/upload`). Login/OTP happens on the frontend via
the existing `/auth/*` endpoints (unchanged); once authenticated, every conversation turn goes
through this backend, which drives Typebot's `startChat`/`continueChat` on the frontend's behalf.
This is the reverse of the earlier "Typebot calls us via HTTP Request blocks" model for the
conversational Q&A itself — **basic-details and complete are not driven by Typebot at all**: the
live published flow has no HTTP Request blocks (verified via the builder API), so
`registrationEngine.handle()` calls `registrationService.complete()` itself when the Typebot
session ends (`sessionEnded: true`). Because the flow never asks for first/last name, DOB, or
gender, and its `address` variable is unused, `complete()`'s basic-details gate only requires
`AccountEmail` (the one field the flow does collect, via `conversationFieldMap.js`) plus
one document from each of the three `REQUIRED_DOC_GROUPS` (identity / bank / address-proof —
see the `/complete` entry above; `PERMANENT_ADDRESS_PROOF` replaced `AADHAAR` here, since the live
flow no longer collects Aadhaar specifically) — see `registration.service.js`'s `complete()`.

- `modules/conversation/services/typebot/typebotClient.js` — `startChat`, `continueChat`,
  `generateUploadUrl`, `uploadToPresignedUrl`. Plain `fetch` + timeout, mirrors
  `modules/registration/services/ocr/httpOcrProvider.js`'s style exactly. Throws `appError`
  (`TYPEBOT_NOT_CONFIGURED`, 503) if `TYPEBOT_ID` is unset. `TYPEBOT_PREVIEW_MODE=true` makes
  `startChat` call Typebot's `.../typebots/{id}/preview/startChat` (internal id, no publish/paid
  plan needed — per Typebot's own docs, answers aren't saved and some of Typebot's own blocks like
  "Send email" are skipped) instead of `.../typebots/{publicId}/startChat`; flip to `false` and
  update `TYPEBOT_ID` to the real `publicId` once the bot is published. The app must still boot
  fine with `TYPEBOT_ID` unset either way. Current bot: `publicId = uday-updated-typebot-flow-42ihn4e`
  (published, `TYPEBOT_PREVIEW_MODE=false`) — replaced the earlier `udaytypebot-fjy7b2y` bot when the
  Studio flow was rebuilt. **All four role paths are now complete and integrated** — (Individual)
  Author/Composer, (NRI) Author/Composer, Owner/Publisher and (NRI) Owner/Publisher. (An earlier note
  here said only the first was live and the other three dead-ended; that was true of the previous
  bot.) The live flow has 149 groups, 234 edges and 131 questions, and `progressMap.js` covers all
  of them — see the `progress` note below.
- `modules/conversation/services/typebot/typebotSessionStore.js` — in-memory
  `Map<userId, { sessionId, input }>`, mirrors `modules/auth/services/tokenBlacklist.js` (swap for
  Redis behind the same interface in a later milestone).

### Upload file names must be sanitised before `generateUploadUrl`

Typebot drops the file name straight into the URL it returns, **without encoding it**, and then
rejects that same URL on the next answer because a URL with raw spaces fails its own validation. So
Typebot generates a URL it will not itself accept.

Verified live against the published flow, at the Trade License / Udyog Aadhaar / MSME step:

```
fileName "Copy of Choira PAN.jpeg"
   -> fileUrl .../blocks/<id>/Copy of Choira PAN.jpeg     (raw spaces)
   -> answer  "Invalid message. Please, try again."
fileName "pan.jpeg"                       -> accepted
```

Phone file pickers hand over the original name, which is why this showed up on mobile and not on
desktop (where the name already arrived underscored — account 248's stored URL is
`Copy_of_Choira_PAN.jpeg`). It is not specific to that block: all 28 file inputs have the same
empty options.

`handleUpload()` passes `file.originalname` through `safeFileName()` first. Sanitising at the source
rather than encoding the URL later matters because the same URL is stored in `DocumentCaption` and is
what `ocr.choira.io` is asked to fetch — one fix covers every consumer. `#` and `?` are handled for
the same reason as spaces, and are worse: they truncate a URL rather than merely invalidating it.

**Related, still open:** empty text is rejected by Typebot too (live tested), and
`const text = message ?? (...)` uses `??`, which does not catch `""` — the validator allows
`message: ""`. If a frontend ever sends a blank message alongside a file, the same "Invalid message"
appears. Not the cause of the mobile failure above; left alone deliberately.

### Typebot expires idle sessions — and the backend must recover

**Typebot drops a chat session after a period of inactivity.** Measured live: a session ran fine for
8 turns, went **20m51s** without a message, and the next `continueChat` returned
`404 Session not found.` A pause that long is ordinary here — the flow asks 26–34 questions plus
document uploads, and members go and find their PAN card.

Because the sessionId lives in the in-memory store, a dead id used to be resent on every subsequent
message, so the member was **wedged permanently**; the only cure was a server restart (which wipes
the store). `handle()`'s stale-session discard doesn't help: it only fires on an *empty* call, which
a frontend that always sends a message can never produce.

`typebotClient.isDeadSessionError(err)` recognises it. The two endpoints report it **differently** —
verified by calling both with a bogus sessionId:

| call | dead-session response |
|---|---|
| `continueChat` | `404` `{ code: 'NOT_FOUND', message: 'Session not found.' }` |
| `generateUploadUrl` | `400` `{ code: 'BAD_REQUEST', message: "Can't find session" }` |

so **matching on 404 alone misses uploads**. The predicate matches on the message, not just the
status, because a wrong `TYPEBOT_ID` returns the *same* `404 NOT_FOUND` with `Typebot not found` —
that is a misconfiguration and must keep failing loudly, never be retried as a stale session.

On a dead session both paths clear the store and `startChat` fresh, once:

- `handle()` restarts and prepends a notice. The member's message is **dropped, not replayed** — it
  answered a question that no longer exists, and Typebot would reject it as "Invalid message".
- `handleUpload()` cannot re-aim the file at a chat that lost the question, so it restarts and says
  the file didn't go through. It deliberately returns the fresh question rather than a null `input`,
  which a frontend would read as "conversation ended".

**What is actually lost is only the position in the flow.** Typebot has no "resume at block X", so a
restart begins at question 1 — but every answer already given is in our own database
(`saveConversationField`, `saveDocument`, `saveWorkLink`), so documents stay uploaded and fields stay
set. The notice says so explicitly.

The backend can only paper over this. **The real mitigation is a longer idle timeout on the Typebot
instance** — worth asking whoever operates `bot.choira.io`; no configurable setting for it was found
documented, so treat that as a question rather than a known knob.
- `modules/conversation/services/typebot/documentTypeMap.js` — maps a file-input block's
  `variableId` to one of our document types (`PAN`/`BANK`/`PROFILE_PHOTO`/`NOC`/
  `PERMANENT_ADDRESS_PROOF`/`CURRENT_ADDRESS_PROOF`). Update this whenever a file-input block's
  variable is added/renamed in the Typebot flow. `COMPANY_DOC` has no entry yet — that branch has
  no working file-input block in Studio (dead-end, future work).
- `modules/conversation/services/typebot/addressProofTypeMap.js` — the live flow replaced the old
  dedicated Aadhaar upload with a generalized "address proof" flow, asked twice (permanent, then
  current-only-if-different): the user picks a document type from a choice input (Passport /
  Electricity Bill / Driving Licence / Voter ID / Letter from Property Owner), then uploads a file
  into a *separate* variable (`permanent_address_proof` / `current_address_proof`) that doesn't
  itself encode which type it is. This map recognizes the two type-choice blocks by `variableId`
  and maps the answer text to an OCR doc type (`DRIVING_LICENCE`/`VOTER_ID`/`PASSPORT`/`ELECTRICITY`)
  or `null` (only "Letter from Property Owner" has no OCR endpoint anywhere).
  `registrationEngine.handle()` stashes the resolved type in
  `typebotSessionStore` as `addressProofOcrType` when the type-choice question is answered, so the
  paired file-upload (next turn) can read it back. `handleUpload()` passes it to
  `registrationService.saveDocument()`'s new optional `ocrDocType` parameter, which runs OCR under
  that type while still saving the DB row under the generic `PERMANENT_ADDRESS_PROOF`/
  `CURRENT_ADDRESS_PROOF` caption. The session field is naturally overwritten (never explicitly
  cleared) by the next `typebotSessionStore.set()` call regardless of path taken, so it can't leak
  into an unrelated later upload.

  **Bug found and fixed**: `OCR_TYPE_BY_ANSWER`'s key was `'electricity bill'`, but the live
  button's actual text (confirmed via the builder API) is `"Electricity/Light Bill"` — the
  lowercased answer never matched, so `resolveAddressProofOcrType()` silently returned `null` for
  every Electricity Bill selection, which made `saveDocument()` fall back to the generic
  `PERMANENT_ADDRESS_PROOF`/`CURRENT_ADDRESS_PROOF` type (not in `OCR_DOC_TYPES`), skipping OCR
  entirely with no error and no confirmation prompt — just a silent advance to the next question.
  Fixed by correcting the key to `'electricity/light bill'`. **Always re-verify a live button's
  exact text via the builder API before hardcoding it here** — this is the second time in this
  project a hardcoded guess at Typebot's exact wording has been wrong (see the OCR transport-contract
  flip-flops above for a similar "don't trust a past assumption, re-probe live" lesson).

  Directly verified `VOTER_ID` does **not** have this bug: calling `saveDocument()` with
  `ocrDocType: 'VOTER_ID'` against a real test account correctly ran OCR against the `voter-id`
  endpoint and returned a result with an `extracted` key (so `handleUpload()`'s confirmation gate
  *would* fire). If a user still reports a fully silent Voter ID upload after this fix, the bug is
  further upstream — most likely `session.addressProofOcrType` not surviving from the type-choice
  answer turn to the paired upload turn during the real conversation — not in `saveDocument()` or
  the OCR routing itself. Two `logger.warn()` calls were added specifically to catch this: one in
  `handle()` when `resolveAddressProofOcrType()` returns `null` for a type-choice answer, one in
  `handleUpload()` when an address-proof upload has no `ocrDocType` recorded in its session. Check
  these on the next live report before re-investigating from scratch.
- `modules/conversation/services/typebot/conversationFieldMap.js` — same pattern as
  `documentTypeMap.js` but for plain text/choice answers: maps a block's `variableId` to an
  `AppAccounts` column. Currently maps GST no, alias/stage name, and email — confirmed live and
  verified end-to-end via `sqlcmd` (alias/email; GST's `variableId` was filled in after its Studio
  block got a variable assigned, not yet re-verified against the DB). Persisted via
  `registrationService.saveConversationField()`, which whitelists the field name against a
  hardcoded `CONVERSATION_FIELDS` list rather than trusting the map blindly.
- `modules/conversation/engines/registrationEngine.js`:
  - `handle({ userId, token, message, attachedFileUrls })` — no existing session → `startChat`
    with `prefilledVariables: { token, registrationId: userId }`; existing session →
    `continueChat`. Before overwriting the session, it checks whether the *previous* turn's input
    (`existing.input`, i.e. the question `message` is answering) maps to a known field via
    `conversationFieldMap.js`, and persists it if so — a failure here is logged and swallowed, it
    never breaks the conversation relay itself. Response shape stays close to Typebot's own
    (`messages`/`input`/`progress`) — no invented transformation, since the frontend's exact
    expectations weren't specified.
  - `handleUpload({ userId, token, file })` — gets a presigned URL from Typebot for the *current*
    file-input step, uploads the buffer, and — this is the key simplification versus the original
    wiring guide — **saves the document itself** by calling the existing
    `registrationService.saveDocument()` directly (same OCR + `PANNo`/bank-column persistence
    built for the Studio-HTTP-block model, just invoked from here instead). Because of this,
    Typebot's Studio no longer needs its own HTTP Request blocks for documents at all.
  - `POST /conversation/upload` is `multipart/form-data` (via `multer`, memory storage, limited by
    `MAX_UPLOAD_SIZE_MB`) — the only multipart endpoint in this app; everything else is JSON.
  - **OCR-confirmation gate**: for OCR-eligible doc types (PAN/AADHAAR/BANK, and address-proof
    uploads routed to DRIVING_LICENCE/VOTER_ID via `addressProofTypeMap.js`), `handleUpload()` does
    *not* advance the conversation immediately after `saveDocument()`. If OCR extracted anything,
    it stores `{ ..., pendingDocConfirmation: { fileUrl } }` in `typebotSessionStore` and returns a
    message listing the extracted values (labeled per doc type — `OCR_FIELD_LABELS`, sourced from
    the real "Document Verification API" contract, not the raw OCR keys) plus a synthetic
    `choice input` (`"Yes, confirm"` / `"No, re-upload"` — not a real Typebot block, Studio needs no
    changes). `handle()` checks `pendingDocConfirmation` before anything else: an affirmative answer
    replays the original upload's `attachedFileUrls` through the normal relay path (exactly what
    would have happened pre-gate); anything else re-asks the same file-input step. If OCR found
    nothing at all (`extracted` present but `null` — e.g. an unreadable image), the user is told to
    re-upload a clearer image instead, no confirmation choice shown. This exists because OCR's own
    `isValid` flag doesn't catch every misread (a real Union Bank passbook once extracted as "The
    Federal Bank" with `isValid: true`) — a human check catches what automated verification misses.
  - **`progress`**: Typebot's Chat API never returns a `progress` field (confirmed live against
    `startChat`/`continueChat` — Studio's Theme "Enable progress bar" toggle only affects Typebot's
    own embed widget, not the API), so it's computed here from the published flow's graph.

    **`modules/conversation/services/typebot/progressMap.js` is a GENERATED file.** Do not hand-edit
    it — run **`npm run build:progress-map`** (`scripts/build-progress-map.mjs`), which fetches the
    live flow (startChat for the internal id, then the builder API with `TYPEBOT_API_TOKEN`), walks
    `groups`/`edges`, and rewrites the map. It is deterministic: two runs give a byte-identical file.

    Each value is **"questions already answered / questions on this path"**, computed per block as
    `(depth - 1) / (depth + remaining - 1)` where `remaining` is 1 + the worst case of the block's
    successor input blocks, and `depth` is the longest run of questions from the start.
    **Deliberately not one global step count**: the four role paths run 26–34 questions, and a shared
    total would leave the short paths permanently short of 100%. Nothing in the map reaches 100 —
    `handle()` forces 100 only when the session actually ends, and while the payment button is on
    screen the member hasn't finished. The generator asserts progress never decreases along any edge
    and fails rather than emitting a bad map.

    **This map went badly stale once**: it still described the *previous* bot (one role path, a
    `spotifyUrl` step no block used) while the live flow had grown to 131 questions across four
    paths, so `resolveProgress()` returned `null` nearly everywhere and the few surviving ids gave
    percentages measured against the old flow's length. A Studio republish invalidates **both** this
    map and `paymentGate.js`'s block ids — regenerate and re-check both together.

## Pre-payment Review

Before the payment button, the member is shown **everything on file** and asked to confirm it.

This exists because much of what is stored was **never typed by the member** — PAN number, date of
birth, bank name, account number, IFSC and branch all come from OCR reading their documents, and OCR
gets things wrong. The live account's `BankBranchName` holds `"ADDRESS AND TEL NO.: NAME AND ADDRESS
OF ACCOUNT HOLDER/S"` — a passbook form label the OCR service mistook for a branch. A wrong account
number sends royalties to the wrong place, and payment is the last moment to catch it.

### Two things here are unlike every other gate

1. **It keys off the block id, not a `variableId`.** The four payment blocks are single-item choice
   inputs with no variable attached, so there is nothing else to match on. If Studio re-publishes and
   these ids change, the gate goes silently unreachable — the same failure mode as the retired
   `spotifyUrl` id. Re-fetch them from the builder API and update `paymentGate.js`:
   `mqd5zfukd99nkczylu206jo1`, `o6vjstq2do6uuy67wfbzg451` (labelled "payment"),
   `tjbgzghma2th8et9srotmzt5`, `ufpca0wnuwznk2ks7qbv39py` (labelled "Pay") — one per role path.
2. **It intercepts Typebot's *reply*, not the member's answer.** Every other gate inspects the
   incoming message; this one inspects the outgoing `response.input`, because the trigger is
   "Typebot just offered the payment button". The hook sits at the end of `handle()`'s relay, which
   also covers uploads since `handleUpload()` ends with `return handle(...)`.

### The turn

1. Relay returns an input whose id is a payment block → build the review, stash
   `pendingPaymentReview: { input }`, and return Typebot's own messages **plus** the review, with the
   synthetic `PAYMENT_REVIEW_INPUT` (Yes / Something needs correcting) in place of the pay button.
2. **"Yes, everything is correct"** → the stashed payment input is returned unchanged.
   **"Something needs correcting"** → a message naming `SUPPORT_CONTACT` and the member's
   registration id, *and* the payment input. Typebot cannot be driven backwards, so offering an edit
   we can't perform would be a lie; nobody is left stranded on the review either.
3. If `buildReview()` throws, the payment button is shown as normal. A broken summary must never
   block payment.

### What it shows

`registrationReview.service.js` reads `App_Accounts`, `AppAccountsDocs`,
`App_Accounts_WorkRegistration` and `App_Accounts_Alias`, and returns sections of `{ label, value }`
lines. **Empty fields and empty sections are dropped**, so a member who skipped the GST question sees
no blank GST line. A line with `label: null` renders as a bullet — that's how documents, songs and
aliases are listed.

Sections: Your details · Membership · Address · Identity · Bank · Documents you uploaded · Your
songs · Also credited as.

**Bank account number and PAN are shown in full, deliberately.** Masking would hide precisely the
OCR-derived fields that are most likely to be wrong and most expensive to get wrong.

`Detail1`–`Detail12` are **excluded**: they are internal duplicates (`Detail1` = GST, `Detail2` =
PAN, `Detail10` = a source tag). Printing the same value twice under a meaningless name makes a
review harder to check, not easier.

The review is built from the **database**, not from Typebot's variables. If a value failed to
persist, the review shows it missing — which is exactly what the member needs to know at this point.

`SUPPORT_CONTACT` (`.env`, `.env.example`, `envSchema`) is optional; blank falls back to "Our team
will get in touch with you" rather than printing an empty contact line.


## Work Links (Spotify + YouTube)

The flow's "share a link to your work" step accepts **either a Spotify track or a YouTube video**.
All four role paths share one variable, `workUrl` = `vdcqjfwmljgel9ola6lpinafa` (unified in Studio;
`spotifyUrl` and `workUrl1` still exist in the variable list but no block uses them).

Everything past the paste is driven from the backend using **synthetic blocks** — objects shaped like
Typebot inputs that Typebot has never heard of (same pattern as the OCR-confirmation and email-OTP
steps). **Studio needs no changes.** The published flow has no loop and no confirmation step.

### The step, turn by turn

1. `workLinkResolver.service.js` detects the provider. Neither → re-ask, nothing saved.
2. Fetch and normalise to one shape (`songName`, `artists[]`, `filmOrAlbum`, `releaseYear`,
   `publisher`, `credits[]`).
3. A YouTube video Gemini flags as `isMusicVideo: false` → re-ask.
4. Show the song back (`WORK_LINK_CONFIRM_INPUT`). **Nothing is written before the member confirms**,
   so a wrong link leaves no trace.
5. "No" → re-ask. "Yes" → match `AccountName`/`AccountAlias` against `credits`.
6. No match → **ask which name they're credited under** (`WORK_LINK_ALIAS_INPUT`) rather than
   blocking: the usual cause is a stage name we don't have on file, not a false claim. Bounded by
   `MAX_ALIAS_ATTEMPTS`; after that the link is saved marked unverified, because **a member must
   never be stuck on this step**.
7. Saved → the existing "add another?" loop, up to `MAX_WORK_LINKS = 5`.

Session fields: `pendingWorkLinkConfirm`, `pendingWorkLinkAlias`, `pendingWorkLinkChoice`.
`bypassWorkLinkSave` stops the fall-through replay from saving the same link twice.

### GROUNDED DATA ONLY — the rule that shapes this whole feature

IPRS is a **rights society**: `Author_Composer`, `Author_Lyricist` and `Publisher` are legally
meaningful. Every column written is read from an API response or copied out of a video title.
**`Author_Composer`, `Author_Lyricist`, `LanguageNames`, `WorkCategory` and `DocLink` are left null
for staff.** An empty column beats an invented credit. Do not "improve" this by asking an AI what it
knows about a song.

| Column | Spotify | YouTube |
|---|---|---|
| `SongName` | `track.name` | Gemini-parsed from the title |
| `Film_AlbumName` | `album.name` | Gemini-parsed from the title |
| `Artist_Singers` | credited artists, joined | parsed artists, else the channel name |
| `ReleaseYear` | year of `album.release_date` | **null** — oEmbed has no date and Gemini must not guess |
| `Publisher` | `album.copyrights` text | null |
| `DigitalLink` | the URL | the URL, rebuilt as `watch?v=` (no playlist/tracking params) |
| `CreatedBy` | `chat:name-matched` / `chat:name-unverified` | same |

`CreatedBy` carries the match outcome so staff can find unverified claims **without a schema
change** — the column is a free audit field that was previously always null.

### YouTube: oEmbed, and why there is no API key

**There is no YouTube Data API key for this project and the Google OAuth credentials on file cannot
substitute for one** — verified: Google rejects `grant_type=client_credentials`
(`unsupported_grant_type`) and the client id is not a valid API key (`API_KEY_INVALID`). Those
credentials are for user-consent sign-in, a different thing entirely.

`youtube.service.js` uses the **keyless `youtube.com/oembed` endpoint** (~0.4s), which handles every
URL form members paste: `watch?v=`, `youtu.be`, `music.youtube.com`, `/shorts/`, and extra
`&list=`/`&index=` params. It returns title, channel name and thumbnail — **no publish date,
description, tags or category**, which is why `ReleaseYear` is null for every YouTube link. Filling
it needs a real API key.

### Gemini is a title parser, not a knowledge source

`gemini.service.js` gets **text, never the video**. Passing the YouTube URL as `fileData` makes
Gemini ingest the video: ~13s and up to 100k tokens. Passing just the oEmbed title + channel costs
**~2.8s and ~150 tokens** and produces the same split —
`"Kesariya - Brahmastra | Arijit Singh | Pritam | Amitabh B"` → song `Kesariya`, artists
`[Arijit Singh, Pritam, Amitabh B]`, film `Brahmastra`. The prompt forbids outside knowledge, so
everything it emits is copied out of the input.

**Optional by design**: with `GEMINI_API_KEY` blank it returns null and the card falls back to the
raw video title. The step must never break because Gemini is unavailable.

### Matching, and what a match is worth

`workMatch.service.js`. Names are compared as **tokens**, not as strings. Indian names make a plain
comparison wrong in both directions: a PAN card says `RAHUL KUMAR SHARMA` while the release credits
`Rahul Sharma`, and `ALLAH RAKHA RAHMAN` is credited `A.R. Rahman` — an exact test rejects the
member's own songs. But loosening it to "is this name somewhere in that string" let a bare **`Singh`**
match, which in India is most of the catalogue. (Both were observed live, which is why this exists.)

**The rule: the first and last tokens must correspond; everything between is ignored.** Tokens
correspond when they are equal, when one is the other's initial (`a` ~ `allah`), or when they differ
by one edit — the typo allowance applies **only to tokens of 4+ characters**, because at three
letters (`Raj`/`Ram`) an edit is a different person, not a slip.

| Credit ~ member name | Result |
|---|---|
| `Rahul Sharma` ~ `RAHUL KUMAR SHARMA` | match — middle name ignored |
| `A.R. Rahman` ~ `ALLAH RAKHA RAHMAN` | match — initials |
| `Arijit Singh` ~ `Arjit Singh` | match — one edit |
| `Shreya Ghoshal` ~ `Shreya P Ghoshal` | match — extra middle initial |
| `Pritam` ~ `Pritam Chakraborty` | match — one-token *credit* is a stage mononym |
| `Arijit Singh` ~ `Arijit` | match — one-token *member* name may equal the credit's **first** token |
| `Arijit Singh` ~ `Singh` | **no** — never the surname alone |
| `Arijit Singh` ~ `Arijit Kumar` | no — surnames differ |
| `Raj Kumar` ~ `Ram Kumar` | no — under 4 characters, exact only |

The single-token case is **asymmetric on purpose**: a one-token credit may match the member's first
or last token (stage mononyms are real), but a single token supplied by the *member* must equal the
credit's first token — otherwise typing `Singh` matches everyone. The credits come from the platform;
what the member types has to be more specific than that.

`normalizeName()` (`utils/name.js`) turns a full stop into a **space, not nothing**. Deleting it
collapsed `A.R.` into the single token `ar`, which never lined up with `Allah Rakha` — initials have
to survive as separate tokens for the first/last comparison to work.

**A YouTube video title is a sentence, not a name**, so it travels separately as `creditText` and is
matched with a word-boundary containment test, and only for names of **two or more tokens**. The
title used to sit in the `credits` array, which is precisely what forced the matcher into substring
mode and let `Singh` through.

### What a match is worth

**Not every match is evidence.** The alias step *shows the member the credits and then asks which of
them they are* — copying a name off that list is trivial. So the line that decides the marker is
**whether the name was on file before we showed them the answer**:

| Matched against | `CreatedBy` | Why |
|---|---|---|
| `AccountName` — from their identity document | `chat:name-matched` | Real evidence |
| `AccountAlias` — the stage name asked during registration | `chat:name-matched` | Declared before any credits were shown |
| An alias given at the work-link step | `chat:name-unverified` | A claim, not a check |
| Nothing | `chat:name-unverified` | — |

`matchCredits(resolved, trustedNames, claimedNames)` returns `trust`
(`trusted`/`claimed`/`none`) and tries trusted names first, so a member who *is* on file is never
downgraded for also having an alias. **A stored alias never graduates to trusted** — being in the
table doesn't make it evidence, on this song or the next one.


### AccountName is now populated from identity documents

`runOcrAndPersist()` writes OCR's `name` to `AccountName` — **only when the column is empty**, and
**only for `PAN`/`AADHAAR`** (`IDENTITY_OCR_DOC_TYPES`). Before this, *nothing in the codebase ever
wrote `AccountName`*: it was read in two places and written in none, so it was null on every
chat-created account and the credit match had nothing with evidence behind it to compare against.

This supersedes the earlier "Deliberately NOT wired" entry for OCR `name`. The reason it was skipped
— OCR-formatted text clobbering a real name already on the row — is exactly what the empty-only
guard prevents. Address proofs stay excluded: an electricity bill or a rent letter routinely carries
a landlord's or a parent's name, which is evidence of nothing. `fatherOrHusbandName` remains
unpersisted for the original reason (it can legitimately be a husband's name, not a father's).

### Aliases: `App_Accounts_Alias`

A member can be credited under several names — legal name, stage name, an abbreviation. When the
credits don't contain any name we hold, the work-link step asks for them, **accepting several at
once, comma-separated** (`registrationService.parseAliasList`, capped at 5 per turn, 200 chars each).
Every supplied name is stored whether or not it matched *that* song — the point is that the member's
next links match without asking again.

Stored in `App_Accounts_Alias` (`scripts/add-alias-table.sql`), **not** in `AccountAlias`: that
column holds one value and is already the target of the flow's own stage-name question *and* the
company path's `traderName` (see `conversationFieldMap.js`), so a list there would destroy real data.
`Detail3`–`Detail12` are unused by this app but their meaning in the wider IPRS system is unverified,
so they were not repurposed either.

`Source` (`flow` / `work-link` / `staff`) is what `getIdentityNames()` uses to split names into the
`trusted` and `claimed` groups above. Duplicates are rejected by a unique index on
`(AccountId, AliasName)`; `createAliases()` inserts one row at a time and swallows `P2002`, because
**Prisma's `createMany({ skipDuplicates })` is not supported on SQL Server**.

The table was created with raw SQL and its model **hand-added to `schema.prisma`, then
`prisma generate` only**. Do not run `prisma db push` — it does not know about the filtered unique
indexes on `App_Accounts` and may drop them.


### Spotify specifics

`spotify.service.js` fetches the track, then **one** `/v1/albums/{id}` call for `copyrights` (a
track's nested album is the simplified form and carries none). It no longer calls `/v1/artists/{id}`
per artist: this app's tier stopped returning `genres`/`followers`/`popularity`, so those N requests
bought only a thumbnail, while the artist *names* the match needs are already in the track response.

`POST /spotify/metadata` (`modules/spotify/`, behind `authenticate`) is the separate REST path —
`{ url, actualName, stageName }` in, match result out. It writes an `App_Accounts_WorkRegistration`
row **only when the claim matches**; it used to write one unconditionally, so a track whose credits
didn't include the caller still landed in the register while the response said `status: false`.

`SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` are optional in `envSchema` (a clear
`SPOTIFY_CREDENTIALS_MISSING` 500 if unset, same pattern as `TYPEBOT_ID`). `AccountName` for the
match is whatever created the `App_Accounts` row — nothing in this app's live code path writes it.

### Module layout

`modules/work/` owns everything provider-agnostic: `work.repository.js`, `workLink.service.js` (the
cap — `saveWorkLink()` counts first and returns `null` at 5, so restarting the chat can't exceed it),
`workLinkResolver.service.js`, `youtube.service.js`, `gemini.service.js`, `workMatch.service.js`.
`modules/spotify/` keeps the Spotify API client, the claim service, and the REST route.
`conversation/services/spotifyGate.js` **was deleted** — the resolver covers both providers, and
leaving two gates on one step was the bug waiting to happen.


## Email OTP Verification

`modules/auth/services/emailOtp.service.js` (`emailOtpService.sendEmailOtp`/`verifyEmailOtp`,
merged from the `email` branch, PR #3) — sends a 4-digit OTP via `nodemailer` (`utils/email.js`,
SMTP config in `envSchema`) to a given email, hashed with `bcrypt` and stored in
`EmailVerificationOtp` (`Email_Verification_Otp` table, added via `db push` — not in the original
DB dump). `verifyEmailOtp` enforces expiry (`EMAIL_OTP_EXPIRY_MINUTES`), a resend cooldown
(`EMAIL_OTP_RESEND_COOLDOWN_SECONDS`), and a max-attempts lockout (`EMAIL_OTP_MAX_ATTEMPTS`), each
with a clear, user-facing error message. Also exposed standalone as `POST /auth/send-email-otp` /
`POST /auth/verify-email-otp` (no `authenticate` — usable pre-login), but the conversation flow
below calls the service directly rather than looping back through HTTP.

**Wired into the conversation flow as a hard gate**, same shape as the Spotify gate —
`modules/conversation/services/emailOtpGate.js` recognizes the "Provide your email id" email-input
block by its `variableId` (`EMAIL_VARIABLE_ID` — same id already mapped to `AccountEmail` in
`conversationFieldMap.js`). Unlike Spotify's single pass/fail check, this is a send-then-verify
sub-conversation, tracked via a new `pendingEmailVerification: { email }` field in
`typebotSessionStore` (same shape/precedent as `pendingDocConfirmation`):

- A fresh answer to the email question (format-checked first) triggers `sendVerificationOtp()` and
  replaces the real input with a synthetic `EMAIL_OTP_INPUT` block (non-Typebot, Studio needs no
  changes — same pattern as `OCR_CONFIRM_CHOICE_INPUT`) asking for the OTP.
- `handle()` checks `pendingEmailVerification` before anything else on the next turn. The OTP field
  is a plain text input, so its two escapes are **keywords**, both listed in `emailOtpGate.js`
  alongside `isEmailStep`/`isValidEmail`:
  - `isResendKeyword()` (`resend`, `resend otp`, `resend the otp`, `send otp again`, `send again`,
    `new otp`) re-sends a fresh OTP **to the same address** (the service's own cooldown throws its
    own message if spammed).
  - `isChangeEmailKeyword()` (`change`, `change email`, `change my email`, `wrong email`,
    `edit email`, `different email`) hands back the **real Typebot email block** so the member can
    enter a different address, which then re-enters the email gate and is format-checked,
    duplicate-checked and sent an OTP exactly like the first one.

    **Why this exists**: without it a mistyped address was an unrecoverable dead end — no code ever
    arrives, all five OTP attempts fail, and `resend` mails the same wrong address again. The only
    escape was abandoning the conversation and redoing the whole registration, over one typo.

    **Capped at `MAX_EMAIL_CHANGES = 3` per conversation**, then the member is pointed at
    `SUPPORT_CONTACT` (the OTP field stays, so a late code can still be entered). The cap is not
    cosmetic: each change sends mail to an address the member names, and the 60-second resend
    cooldown does *not* apply across different addresses, so uncapped this would let one session
    flood arbitrary inboxes from the project's own SMTP account.

    The counter lives on the session as `emailChanges`. **`typebotSessionStore.set()` replaces the
    whole session object**, so it must be carried forward by every `set()` on the email path — the
    OTP send, the change branch, and the post-verification replay. Miss one and the cap silently
    resets to zero. It is in-memory, so a server restart clears it; that bounds one sitting, not a
    determined abuser, and a real defence would belong in the rate limiter keyed on the account.

  Anything else is treated as the OTP itself. A wrong OTP now returns
  `verifyEmailOtp()`'s message **with a remaining-attempts count** ("Invalid OTP. N attempts
  left.", `details: { attemptsRemaining }`) computed in `emailOtp.service.js`. Every
  wrong/expired/maxed-out response — not just the initial send — is wrapped by
  `describeOtpProblem()`, which appends **both** escapes ('Type "resend" for a new code, or
  "change" to use a different email address.'), so they stay discoverable through
  repeated wrong guesses and especially right after max-attempts lockout (where the record is
  invalidated server-side and further digit-entry alone would just repeat "OTP not found..." with
  no way out otherwise). The conversation never reaches Typebot's `continueChat` until verification
  succeeds. A correct OTP clears `pendingEmailVerification` and replays the turn as if the user had
  just answered the email question correctly, so the normal relay/persist path
  (`resolveConversationField` → `AccountEmail`) runs unchanged.

**Setup**: `Email_Verification_Otp` needed an explicit `npx prisma db push` (+ `prisma generate`) —
it wasn't created by the `email` branch merge alone. `SMTP_USER`/`SMTP_PASSWORD` are optional in
`envSchema` with no default; without them, `sendVerificationOtp()` fails with `'Failed to send
email'` and the real email question re-asks — fill them in `.env` for actual delivery.

## Conventions to preserve

- Keep the response envelope, error codes, and status codes consistent — do not introduce ad-hoc shapes.
- Controllers must stay thin; do not move business logic into them.
- Prefer calling another module's *service* over reaching into its repository (e.g.
  `registrationEngine.js` calls `registrationService.saveDocument()`, not
  `registrationRepository` directly). `auth.service.js` importing `userRepository` predates this
  and is the one exception — don't take it as license to reach into repositories generally.

## Testing notes

- DB-dependent tests auto-skip when SQL Server is unreachable. They run against a live
  instance (`npm run setup:db` as Administrator + import `scripts/mra_cleaned.sql` first).
- The auth round-trip asserts the response echoes the OTP, so it requires `OTP_PROVIDER=mock`
  (the default). It also exercises `/registration/status` and `/conversation/message` with a real JWT.
  With `OTP_PROVIDER=sms` set, that test and the registration-flow test skip themselves.

### What each suite covers

| File | Covers | Needs |
|---|---|---|
| `workMatch.test.js` | the naming rules: dropped middle names, initials (`A.R.` ~ `Allah Rakha`), one-letter typos, the bare-surname guard, trusted vs claimed | nothing |
| `progressMap.test.js` | the generated map's shape, and that `paymentGate`'s four block ids still exist in it | nothing |
| `emailOtpGate.test.js` | resend/change keywords, and the change escape driven through the engine: the dead end, the counter, the 3-change cap | DB |
| `workLink.test.js` | the gate's vocabulary, the 5-link cap, the `CreatedBy` audit marker, column clipping, and that the rights columns stay null | DB |
| `registrationReview.test.js` | review rendering, empty-field omission, `Detail1`–`Detail12` exclusion | DB |
| `uploadFileName.test.js` | file names sent to Typebot: spaces, URL-breaking characters, extension, length cap | neither |
| `typebotSession.test.js` | expired-session recovery: both dead-session shapes, the restart, that the answer isn't replayed, and that a wrong `TYPEBOT_ID` still fails loudly | neither |
| `ocrLabels.test.js` | every OCR-capable doc type has confirmation labels (the blank COMPANY_PAN card) | neither |

`emailOtpGate.test.js` monkey-patches the mail and Typebot singletons so nothing leaves the machine.
`node:test` runs each file in its own process, so that stays contained — **don't merge it into
another file.**

**Deliberately not covered:** `workLinkResolver` and the full conversation walk-through hit live
Spotify / YouTube / Gemini. Those were verified by hand, and they were flaky in batch runs (passing
on retry), so they are kept out of `npm test`. Provider coverage, if wanted later, needs recorded
fixtures rather than live calls.

**Still only verified by hand:** the real Typebot UI path. Every automated test drives
`/conversation/message` directly.