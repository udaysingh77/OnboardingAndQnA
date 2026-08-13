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
npm run setup:db         # enable SQL Server TCP/SQL auth, create Dreamsoft_UAT + iprs_app login, write DATABASE_URL to .env
```

- Always run `npm test` (and `node --check` on any file you touch) before finishing.
- No linter/formatter/typecheck is configured — don't hunt for ESLint/Prettier. `node --check` + `npm test` are the only verification.
- `setup:db` is a Windows-only PowerShell script (`scripts/setup-db.ps1`) that must be run **as Administrator**.
  It assumes a local SQL Server named instance `SQLEXPRESS01` and rewrites `DATABASE_URL` in `.env`.
  After it runs, import the schema from the production dump: `sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/mra_cleaned.sql`.

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
│  ├─ user/         controllers/services/repositories/validators
│  ├─ registration/  "
│  ├─ conversation/ services/{conversation.router,typebot/*} + engines/{aiEngine,registrationEngine}.js
│  └─ health/
├─ app.js           middleware + route assembly
└─ server.js        DB connectivity check (fail-fast) + bootstrap + graceful shutdown
prisma/             schema.prisma (no migrations/ folder - schema comes from the SQL dump)
scripts/            setup-db.ps1
test/               smoke.test.js
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

## Environment / Config

- `config/env.js` reads `.env` and validates via Zod (fails fast) — **add env keys to `.env`, `.env.example`, and the `envSchema`**.
- Key vars: `PORT`, `DATABASE_URL`, `JWT_SECRET` (≥16 chars), `JWT_EXPIRES_IN`, `JWT_ISSUER`, `CORS_ORIGIN`,
  `OTP_PROVIDER` (mock|sms), `OTP_TTL_SECONDS`, `OTP_MOCK_VALUE` (dev-only fixed OTP),
  `MSG91_AUT_KEY`, `MSG91_TEMP_ID`, `MSG91_OTP_LENGTH`, `MSG91_OTP_EXPIRY`, plus global/auth rate-limit values.
- OCR: `OCR_PROVIDER` (http|stub), `OCR_API_BASE_URL`, `OCR_REQUEST_TIMEOUT_MS`.
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
`registrationEngine.handleUpload()` for uploads that arrive through `/conversation/upload` — the
routes below still exist and work standalone (e.g. for `basic-details`/`complete`, still called
by Typebot's own Studio HTTP blocks), they're just no longer the only caller for documents:

- `POST /registration/start` — returns `{ registrationId }`. **`registrationId` is just the
  stringified `App_Accounts.AccountId`** (already the JWT `sub`) — there is no separate
  registration-session concept. Idempotent; sets `RegistrationDate` if still null.
- `PATCH /registration/:registrationId/basic-details` — maps to `FirstName`, `LastName`,
  `AccountName` (derived), `AccountEmail`, `DOB`, `Gender`, `AccountAddress`. Body is `.strict()`
  Zod — a `mobile` field (or any unrecognized field) is rejected with 422, since `AccountMobile`
  is the OTP-verified identity and must not be overwritten here.
- `POST /registration/:registrationId/documents/:documentType` — body `{ documentUrl }` (S3 URL
  from Typebot's own upload). `documentType` is a Zod enum: `PAN`, `AADHAAR`, `BANK`, `NOC`,
  `COMPANY_DOC`, `PROFILE_PHOTO` (a single generalized route, not one per type — reuses
  `saveDocument`/`upsertDocument` unchanged for every type, to avoid duplicating the same logic
  across N routes). Upserts an `App_Accounts_Doc` row keyed by `(AccountId, DocumentCaption)`
  (manual find-then-update-or-create — no unique constraint exists to use Prisma's native
  `upsert`). `DocumentCaption` holds the type string, `DocumentName` holds the URL.
  **`DocumentLookupId` is intentionally left `null`** — `Doc_LookUp` has zero seed rows in the
  current DB/dump, so there's nothing valid to reference; wire it up once that lookup table is
  populated.
- `POST /registration/:registrationId/complete` — requires basic-details fields populated + the
  3 *required* documents uploaded (`PAN`, `AADHAAR`, `BANK` — see `REQUIRED_DOC_TYPES` in
  `registration.service.js`; `NOC`/`COMPANY_DOC`/`PROFILE_PHOTO` are conditional/optional in the
  Typebot flow and don't gate completion), else 400 `REGISTRATION_INCOMPLETE` with a
  `details.missing` list. Otherwise reuses the existing `markCompleted`/`toPublic`
  (`ApplicationStatus = 1`) already used by `GET/PUT /status`.

**Fields intentionally not persisted**: the actual Typebot flow also asks about role
(lyricist/composer), membership in another society, tax residency, and a Spotify link. None of
these map to a documented `AppAccounts` column — the only unused-looking slots are the generic
`Detail1`…`Detail12` free-text columns, but that's shared production data (`Dreamsoft_UAT`) whose
usage elsewhere is unverified, so nothing guesses a mapping. These answers live only in Typebot's
own result store, not in this DB, until a real column/mapping is confirmed.

**GST number, stage name/alias, and email** *are* persisted (via `conversationFieldMap.js` +
`registrationService.saveConversationField()`, see "Conversation Router" below) — `GSTNo` (new
column, added the same way `PANNo` was) and the existing `AccountAlias`/`AccountEmail` columns.

**Auth model**: Typebot runs the existing `/auth/send-otp` + `/auth/verify-otp` first (no new
token mechanism), stores `token` + `registrationId` as variables, and sends
`Authorization: Bearer <token>` on every registration call — reusing `authenticate` unchanged.
Every new service function additionally calls `assertOwnRegistration(userId, registrationId)`
(in `registration.service.js`), which 403s if the path param doesn't match `req.user.id` — the id
alone is never sufficient to touch another user's registration.

**OCR**: implemented for `PAN`/`AADHAAR`/`BANK` only — `NOC`/`COMPANY_DOC`/`PROFILE_PHOTO` never
trigger OCR, they just save. `modules/registration/services/ocr/` follows the OTP provider pattern
exactly: `ocrProvider.interface.js` (contract), `ocrProvider.factory.js` (selects by `OCR_PROVIDER`
env, `http` default / `stub` for local dev without network), `httpOcrProvider.js` (calls the real
`https://ocr.choira.io` service — see `Document Verification API.postman_collection.json` for the
full contract), `stubOcrProvider.js` (always throws, kept for `OCR_PROVIDER=stub`).

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
  safe existing column, and this one wasn't worth a schema change.
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
conversational Q&A itself — but Typebot's own Studio-configured HTTP Request blocks for
**basic-details** and **complete** (see the Typebot wiring guide) are unaffected and still fire
from Typebot's own server when those flow groups execute, regardless of how messages reach it.

- `modules/conversation/services/typebot/typebotClient.js` — `startChat`, `continueChat`,
  `generateUploadUrl`, `uploadToPresignedUrl`. Plain `fetch` + timeout, mirrors
  `modules/registration/services/ocr/httpOcrProvider.js`'s style exactly. Throws `appError`
  (`TYPEBOT_NOT_CONFIGURED`, 503) if `TYPEBOT_ID` is unset. `TYPEBOT_PREVIEW_MODE=true` makes
  `startChat` call Typebot's `.../typebots/{id}/preview/startChat` (internal id, no publish/paid
  plan needed — per Typebot's own docs, answers aren't saved and some of Typebot's own blocks like
  "Send email" are skipped) instead of `.../typebots/{publicId}/startChat`; flip to `false` and
  update `TYPEBOT_ID` to the real `publicId` once the bot is published. The app must still boot
  fine with `TYPEBOT_ID` unset either way.
- `modules/conversation/services/typebot/typebotSessionStore.js` — in-memory
  `Map<userId, { sessionId, input }>`, mirrors `modules/auth/services/tokenBlacklist.js` (swap for
  Redis behind the same interface in a later milestone).
- `modules/conversation/services/typebot/documentTypeMap.js` — maps a file-input block's
  `variableId` to one of our document types (`PAN`/`AADHAAR`/`BANK`/...). Update this whenever a
  file-input block's variable is added/renamed in the Typebot flow.
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

## Conventions to preserve

- Keep the response envelope, error codes, and status codes consistent — do not introduce ad-hoc shapes.
- Controllers must stay thin; do not move business logic into them.
- Prefer calling another module's *service* over reaching into its repository (e.g.
  `registrationEngine.js` calls `registrationService.saveDocument()`, not
  `registrationRepository` directly). `auth.service.js` importing `userRepository` predates this
  and is the one exception — don't take it as license to reach into repositories generally.

## Testing notes

- DB-dependent test (auth round-trip) auto-skips when SQL Server is unreachable. It runs against a live
  instance (`npm run setup:db` as Administrator + import `scripts/mra_cleaned.sql` first).
- The auth round-trip asserts the response echoes the OTP, so it requires `OTP_PROVIDER=mock`
  (the default). It also exercises `/registration/status` and `/conversation/message` with a real JWT.