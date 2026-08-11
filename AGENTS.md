# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

IPRS Platform Backend — Week 1 (Platform Foundation) for an AI-powered onboarding & Q&A chatbot platform.

**Scope:** Platform foundation only. AI chatbot, OCR, RAG/knowledge base, vector DB, tool calling, WhatsApp, staff dashboard, payments, file upload, and escalation are **later milestones** — do not implement them here.

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
│  ├─ auth/         services/otp/{interface,factory,mock} + tokenBlacklist.js
│  ├─ user/         controllers/services/repositories/validators
│  ├─ registration/  "
│  ├─ conversation/ services/conversation.router.js + engines/{aiEngine,registrationEngine}.js
│  └─ health/
├─ app.js           middleware + route assembly
└─ server.js        bootstrap + graceful shutdown
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

**Error classes** in `src/shared/errors.js` (`AppError` base + subclasses):
- `BadRequestError` (400, `BAD_REQUEST`)
- `UnauthorizedError` (401, `UNAUTHORIZED`)
- `ForbiddenError` (403, `FORBIDDEN`)
- `NotFoundError` (404, `NOT_FOUND`)
- `ConflictError` (409, `CONFLICT`)
- `ValidationError` (422, `VALIDATION_ERROR`)

Central handler maps:
- **Zod errors** → 422 `VALIDATION_ERROR` (with `details`)
- **Prisma** `P2002` → 409, `P2025` → 404, other integrity → 400
- **JWT** verify failures → 401
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
  there is no `prisma/migrations/` folder. Only run `prisma:migrate` after adding brand-new tables.
- Use the shared singleton from `shared/prisma.js` in repositories.

## Pluggable Providers (design extension points)

- **OTP**: `modules/auth/services/otp/otpProvider.interface.js` defines the contract;
  `mockOtpProvider.js` (default, echoes OTP in dev) and `otpProvider.factory.js` selects by
  `OTP_PROVIDER`. For future third-party SMS: add `SmsOtpProvider`, flip env. Do not touch controllers/services.
- **Token blacklist**: `modules/auth/services/tokenBlacklist.js` in-memory now; swap for Redis behind the same interface in a later milestone.

## Conversation Router (foundation only)

`modules/conversation/services/conversation.router.js` decides engine by `user.ApplicationStatus === 1`
(AIEngine) vs everything else (RegistrationEngine). Both engines are **stubs** returning dummy
replies — leave the AI/registration logic for later milestones.

## Conventions to preserve

- Keep the response envelope, error codes, and status codes consistent — do not introduce ad-hoc shapes.
- Controllers must stay thin; do not move business logic into them.
- No cross-module direct calls; use services/repositories per module.

## Testing notes

- DB-dependent test (auth round-trip) auto-skips when SQL Server is unreachable. It runs against a live
  instance (`npm run setup:db` as Administrator + import `scripts/mra_cleaned.sql` first).
- The auth round-trip asserts the response echoes the OTP, so it requires `OTP_PROVIDER=mock`
  (the default). It also exercises `/registration/status` and `/conversation/message` with a real JWT.