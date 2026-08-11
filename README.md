# IPRS Platform Backend — Week 1 (Platform Foundation)

Backend foundation for an AI-powered onboarding & Q&A chatbot platform.

> **Scope:** Platform foundation only. AI chatbot, OCR, RAG, knowledge base, WhatsApp
> conversation, and staff dashboard are implemented in later milestones.

## Tech Stack
- **Node.js 20+** (ES Modules), **Express 4**
- **Prisma ORM** + **MySQL 8**
- **JWT** authentication, **Zod** validation
- **Helmet**, **CORS**, **express-rate-limit**
- **Pino / pino-http** logging
- **bcryptjs**, **http-status-codes**, **dotenv**
- Tests via `node:test`

## Architecture

```
Route → Controller → Service → Repository → Prisma → MySQL
```

- Controllers: thin — parse validated input, call the service, format the response.
- Repositories: data access only (no validation / business logic).
- Services: all business logic.

```
src/
├─ config/          env loader (Zod-validated)
├─ shared/          prisma, response, errors, errorHandler, validate, asyncHandler
├─ utils/           logger (Pino), token (JWT)
├─ middlewares/     auth (JWT), rateLimiter
├─ modules/
│  ├─ auth/         send-otp / verify-otp / logout  (pluggable OTP provider)
│  ├─ user/         create / get / update / exists
│  ├─ registration/ status GET/PUT
│  ├─ conversation/ message router foundation (engine stubs)
│  └─ health/       GET /health
├─ app.js           express assembly
└─ server.js        bootstrap + graceful shutdown
```

## Prerequisites
- Node.js 20+
- MySQL Server 8.x running as the `MySQL80` Windows service (or equivalent)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
copy .env.example .env        # then edit values as needed

# 3. Create the database + app user and write DATABASE_URL into .env
npm run setup:db

# 4. Run migrations and generate the client
npm run prisma:migrate
npm run prisma:generate

# 5. Start the server
npm run dev                   # development (auto-reload)
npm start                      # production

# 6. Run smoke tests (requires running MySQL + migrated DB)
npm test
```

## Environment Variables
See `.env.example`. Key ones:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Secret used to sign access tokens |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `CORS_ORIGIN` | `*` or comma-separated origins |
| `OTP_PROVIDER` | `mock` now; swap to `sms` (third-party) later |
| `OTP_MOCK_VALUE` | Fixed OTP echoed by the mock provider (dev only) |
| `REGISTRATION_TOTAL_STEPS` | Number of onboarding steps before `completed` |

## API Reference

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service + DB health |

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/send-otp` | no | Send an OTP (mock returns it in the response) |
| POST | `/auth/verify-otp` | no | Verify OTP, upsert user, issue JWT |
| POST | `/auth/logout` | yes | Blacklist the current token |

### Users
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/users` | no | Create a user |
| GET | `/users/exists?phone=` | no | Check whether a phone exists |
| GET | `/users/:id` | yes | Get a user |
| PUT | `/users/:id` | yes | Update a user |

### Registration
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/registration/status` | yes | Get onboarding progress |
| PUT | `/registration/status` | yes | Advance `currentStep` / mark complete |

### Conversation (foundation only)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/conversation/message` | yes | Routes to registration or AI engine (stubs) |

## OTP Provider Abstraction
Week 1 ships a `MockOtpProvider`. In a later milestone a third-party SMS provider
implements the same interface (`otpProvider.interface.js`) and is selected via the
`OTP_PROVIDER` env var — no controller/service changes required.

## Error Handling
- Custom `AppError` hierarchy + central `errorHandler.js`.
- Zod → `422 VALIDATION_ERROR`; Prisma `P2002` → `409`; `P2025` → `404`; JWT → `401`.
- Operational errors expose message/details; unknown errors return a sanitized `500`.
- Consistent error shape: `{ success:false, error:{ code, message, details? } }`.
- Uncaught exceptions / unhandled rejections fail fast and shut down gracefully.

## Later Milestones (not built here)
AI chatbot, OpenAI/LLM, OCR, knowledge base, vector DB, tool calling, WhatsApp,
staff dashboard, payments, file upload, escalation.