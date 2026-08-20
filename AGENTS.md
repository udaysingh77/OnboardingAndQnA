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
│  ├─ user/         repository only - service/controller/routes/validators removed, unused
│  │                (auth.service.js imports user.repository.js directly at login)
│  ├─ registration/  controllers/services/repositories/validators
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
  across N routes). Upserts an `App_Accounts_Doc` row keyed by `(AccountId, DocumentCaption)`
  (manual find-then-update-or-create — no unique constraint exists to use Prisma's native
  `upsert`). `DocumentCaption` holds the type string, `DocumentName` holds the URL.
  **`DocumentLookupId` is intentionally left `null`** — `Doc_LookUp` has zero seed rows in the
  current DB/dump, so there's nothing valid to reference; wire it up once that lookup table is
  populated.
- `POST /registration/:registrationId/complete` — requires `AccountEmail` set + the
  3 *required* documents uploaded (`PAN`, `AADHAAR`, `BANK` — see `REQUIRED_DOC_TYPES` in
  `registration.service.js`; `NOC`/`COMPANY_DOC`/`PROFILE_PHOTO` are conditional/optional in the
  Typebot flow and don't gate completion), else 400 `REGISTRATION_INCOMPLETE` with a
  `details.missing` list. Otherwise reuses the existing `markCompleted`/`toPublic`
  (`ApplicationStatus = 1`) already used by `GET /status`.

**Fields intentionally not persisted**: the actual Typebot flow also asks about role
(lyricist/composer), membership in another society, tax residency, and a Spotify link. None of
these map to a documented `AppAccounts` column — the generic `Detail1`…`Detail12` free-text columns
are shared production data (`Dreamsoft_UAT`) whose usage elsewhere is unverified, so nothing guesses
a mapping for these. These answers live only in Typebot's own result store, not in this DB, until a
real column/mapping is confirmed.

**GST number, stage name/alias, and email** *are* persisted (via `conversationFieldMap.js` +
`registrationService.saveConversationField()`, see "Conversation Router" below) — `GSTNo` (new
column, added the same way `PANNo` was) and the existing `AccountAlias`/`AccountEmail` columns.

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

**OCR**: implemented for `PAN`/`AADHAAR`/`BANK`/`DRIVING_LICENCE`/`VOTER_ID`/`PASSPORT`/`ELECTRICITY`/`PROFILE_PHOTO`
(`PROFILE_PHOTO` via the `passport-photo` endpoint - face detection + photo-quality checks) —
`NOC`/`COMPANY_DOC` never trigger OCR, they just save. `PROFILE_PHOTO`'s response shape differs from
every other doc type (nested `document.status`/`extractedData.faceCount`, no top-level `isValid`) -
`runOcrAndPersist()` special-cases it (`extracted.document?.status === 'VALID'`) and
`OCR_FIELD_LABELS.PROFILE_PHOTO` in `registrationEngine.js` uses dotted-path keys, resolved by a
small `getPath()` helper `buildOcrConfirmationMessages()` now uses instead of a flat `extracted?.[key]`
lookup. `society-noc` was deliberately **not** wired: its consistency check needs
`applicantName`/`societyName`/`flatNumber`, and neither `societyName` nor `flatNumber` exists
anywhere in this codebase (no `AppAccounts` column, no Typebot question) - also unclear whether the
flow's "NOC" upload step is even a housing-society NOC. `PASSPORT`/`ELECTRICITY`'s
`OCR_FIELD_LABELS` field names are a best-effort guess (the collection only documented them as
one-liners: "MRZ and printed fields" / "Bill name + address") - unmatched keys are silently omitted
from the confirmation message (harmless), but worth confirming against a real success response if a
user reports a suspiciously empty confirmation for these two.
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
`PAN`/`BANK`/`PERMANENT_ADDRESS_PROOF` (`REQUIRED_DOC_TYPES` — `PERMANENT_ADDRESS_PROOF` replaced
`AADHAAR` here, since the live flow no longer collects Aadhaar specifically) — see
`registration.service.js`'s `complete()`.

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
  Studio flow was rebuilt. Only the **"(Individual) Author / Composer"** role path is complete in
  this flow — the other 3 role choices ((NRI) Author/Composer, Owner/Publisher, (NRI)
  Owner/Publisher) dead-end into informational text with zero further edges (no file-input block,
  no continuation) and are explicitly future work; `progressMap.js` only covers the one live path.
- `modules/conversation/services/typebot/typebotSessionStore.js` — in-memory
  `Map<userId, { sessionId, input }>`, mirrors `modules/auth/services/tokenBlacklist.js` (swap for
  Redis behind the same interface in a later milestone).
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
    own embed widget, not the API), so it's self-computed by
    `modules/conversation/services/typebot/progressMap.js`. The published flow is a branching graph
    (individual vs company/publisher, GST yes/no, alias yes/no, "member of another society"
    yes/no), not linear, so `progressMap.js` hardcodes `stepsUntilDone` per input-block id — traced
    from the flow's actual `groups`/`edges` (fetched via the builder API,
    `bot.builder.choira.io/api/v1/typebots/{id}/publishedTypebot`) as 1 + the worst-case (max) of
    each block's successor blocks' `stepsUntilDone`, so the resulting percent is guaranteed
    non-decreasing regardless of which branch a user takes. Update this map if Studio changes the
    flow's questions or branches.

## Spotify Credit Verification

`POST /spotify/metadata` (`modules/spotify/`, behind `authenticate`) — given `{ url, actualName,
stageName }`, fetches the track's metadata from the real Spotify Web API (client-credentials OAuth,
token cached in-memory) and checks whether `actualName` or `stageName` matches one of the track's
credited artists (diacritics/punctuation/case-insensitive match via `normalizeName()`). Every call
also writes an `App_Accounts_WorkRegistration` row (song/album/artists/release-year) regardless of
match outcome — this is an existing table from the original DB dump, not a new one.
`SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` are optional in `envSchema` (feature no-ops with a clear
`SPOTIFY_CREDENTIALS_MISSING` 500 if unset, same graceful-missing-config pattern as `TYPEBOT_ID`).

**Wired into the conversation flow as a hard gate** — `modules/conversation/services/spotifyGate.js`
recognizes the "Enter your spotify link" url-input block by its `variableId`
(`SPOTIFY_URL_VARIABLE_ID`, same hardcoded-until-Studio-changes precedent as
`conversationFieldMap.js`/`documentTypeMap.js`). `registrationEngine.js`'s `handle()` intercepts an
answer to that step *before* relaying anything to Typebot: it calls `verifySpotifyClaim()`, which
checks the claimed track's artist credits against the account's `AccountName` *or* `AccountAlias`
(`registrationService.getIdentityNames()`). If neither matches (or the URL/Spotify call fails for
any reason - treated the same as a non-match, never crashes the turn), the answer is **never sent to
Typebot's `continueChat`** - the session stays exactly where it was, and a rejection message asking
for another link is returned directly. Only a genuine match lets the turn fall through to the normal
relay path, advancing the conversation as usual. `actualName` for this check is `AccountName` —
not the Aadhaar-OCR name (still intentionally unpersisted, see above). Nothing in this app's live
code path writes `AccountName` (the `basic-details` endpoint that used to derive it from
`firstName`+`lastName` was removed as chat-flow-orphaned — see "Typebot Registration Flow" above);
it's populated by whatever created the `App_Accounts` row before the chat flow starts.

`SPOTIFY_VERIFICATION_BYPASS` (default `false`) — dev-only escape hatch for `verifySpotifyClaim()`:
when `true`, skips the real Spotify API call/match check entirely and always returns verified (logs
a `logger.warn` each time so a bypass is never silently active). Same purpose as `OTP_PROVIDER=mock`/
`OCR_PROVIDER=stub` — lets the rest of the conversation flow be tested without owning a real Spotify
track credited to the exact test account name. **Never leave `true` in a shared/prod `.env`.**

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
- `handle()` checks `pendingEmailVerification` before anything else on the next turn: typing
  `resend`/`resend otp` re-sends a fresh OTP (the service's own cooldown throws its own message if
  spammed); anything else is treated as the OTP itself. A wrong/expired/maxed-out OTP returns
  `verifyEmailOtp()`'s own error message and re-shows `EMAIL_OTP_INPUT` — the conversation never
  reaches Typebot's `continueChat` until verification succeeds. A correct OTP clears
  `pendingEmailVerification` and replays the turn as if the user had just answered the email
  question correctly, so the normal relay/persist path (`resolveConversationField` → `AccountEmail`)
  runs unchanged.

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

- DB-dependent test (auth round-trip) auto-skips when SQL Server is unreachable. It runs against a live
  instance (`npm run setup:db` as Administrator + import `scripts/mra_cleaned.sql` first).
- The auth round-trip asserts the response echoes the OTP, so it requires `OTP_PROVIDER=mock`
  (the default). It also exercises `/registration/status` and `/conversation/message` with a real JWT.