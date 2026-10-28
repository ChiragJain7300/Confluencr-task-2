# Agent Instructions — Confluencr Ledger API

This file defines the rules and expectations for any AI agent working on this codebase.
Read this file fully before writing any code.

---

## Project Overview

A transaction ledger REST API built with:
- **Runtime**: Node.js + TypeScript (ESM)
- **Framework**: Express 5
- **ORM**: Prisma 7 (with `@prisma/adapter-pg` driver adapter)
- **Database**: PostgreSQL
- **Validation**: Zod
- **Testing**: Vitest + Supertest

---

## Non-Negotiable Rules

### 1. Code Must Be Human-Readable
- Every file, function, and non-obvious line **must have a clear comment** explaining *why*, not just *what*.
- Variable and function names must be self-documenting. No abbreviations like `acc`, `txn`, `req2`.
- Keep functions short and focused. One function = one responsibility.
- No clever one-liners that sacrifice readability.

### 2. No Unnecessary Code
- Do not write code that is not directly required by the current phase.
- No placeholder functions, TODO stubs, or "we'll use this later" code.
- No unused imports, variables, or types.
- No dead code or commented-out blocks left behind.

### 3. Commit After Every Completed Phase
- After each phase is **fully working and verified**, run:
  ```bash
  git add .
  git commit -m "phase X: <short description of what was built>"
  ```
- Never commit a phase that has TypeScript errors, failing tests, or a broken server.
- Never combine multiple phases into a single commit.

### 4. TypeScript Strictness
- `strict: true` is enabled. Never use `any` or `@ts-ignore`.
- All function parameters and return types must be explicitly typed.
- Use `unknown` instead of `any` when the type is genuinely unknown, then narrow it properly.

### 5. No Overengineering
- Do not add abstraction layers that are not needed by the current requirements.
- Do not install new packages without a clear justification.
- Do not add caching, rate limiting, auth, or other features not in the task specification.

---

## Project Structure

```
src/
├── config/
│   ├── index.ts         # Reads env variables (PORT, NODE_ENV)
│   └── prisma.ts        # Re-exports the prisma client from prisma/prisma.config.ts
├── types/
│   └── errors.ts        # Domain error classes (AppError, NotFoundError, etc.)
├── middlewares/
│   ├── validate.ts      # Generic Zod request validator middleware
│   └── errorHandler.ts  # Global Express error handler
├── schemas/             # Zod schemas for request body / query / params validation
├── repositories/        # All direct Prisma database calls live here
├── services/            # Business logic and domain rules (no DB calls here)
├── controllers/         # HTTP layer: parse request, call service, send response
├── routes/              # Express routers that wire controllers to paths
├── app.ts               # Creates and configures the Express app
└── server.ts            # Connects to DB and starts the HTTP server

prisma/
├── schema.prisma        # Data model definition (no url — Prisma 7 adapter model)
├── prisma.config.ts     # PrismaClient instance using @prisma/adapter-pg
└── migrations/          # Auto-generated SQL migration files
```

---

## Layer Responsibilities

| Layer | Responsibility | What it must NOT do |
|-------|---------------|---------------------|
| `routes/` | Map HTTP method + path to a controller function | Contain logic or DB calls |
| `controllers/` | Parse req, call service, send JSON response | Contain business rules or DB calls |
| `services/` | Enforce business rules (balance checks, atomicity) | Import from `controllers/` or touch `req`/`res` |
| `repositories/` | Execute Prisma queries | Contain business logic or HTTP concerns |
| `schemas/` | Define and export Zod validation schemas | Contain logic |
| `middlewares/` | Cross-cutting concerns (validation, error handling) | Be business-domain-specific |

---

## Error Handling Contract

- All domain errors must extend `AppError` from `src/types/errors.ts`.
- Never `throw` a raw `Error` for known domain failures.
- The global error handler in `src/middlewares/errorHandler.ts` converts all errors to this JSON shape:

```json
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "A clear human-readable explanation.",
    "details": null
  }
}
```

- HTTP status codes to use:
  - `400` — Invalid request payload (validation error)
  - `404` — Account or resource not found
  - `409` — Duplicate `reference_id` for the same account
  - `422` — Insufficient balance for a debit
  - `500` — Unexpected internal error

---

## Database Rules

- **Never** perform a raw `UPDATE accounts SET balance = X` without a concurrency guard.
- All operations that touch both a transaction record and the account balance **must** run inside a `prisma.$transaction(...)` block.
- Use `$queryRaw` with `SELECT ... FOR UPDATE` to lock the account row before reading its balance inside a transaction block (prevents race conditions on concurrent debits).
- Database constraints are the last line of defence:
  - `CHECK (balance >= 0)` on `accounts`
  - `CHECK (amount > 0)` on `transactions`
  - `UNIQUE (account_id, reference_id)` on `transactions`

---

## Phases

| Phase | Description | Commit message |
|-------|-------------|----------------|
| 1 | Project scaffold, Prisma schema, DB setup, middlewares | `phase 1: project scaffold and database setup` |
| 2 | Account & Transaction repositories, services, concurrency logic | `phase 2: core ledger engine with concurrency control` |
| 3 | All REST endpoints, Zod validation, route wiring | `phase 3: api endpoints and request validation` |
| 4 | Bonus: money transfer endpoint (atomic, deadlock-safe) | `phase 4: money transfer api` |
| 5 | Vitest integration tests (happy path + edge cases) | `phase 5: integration tests` |
| 6 | README, API docs, assumptions document | `phase 6: documentation and deliverables` |

Only move to the next phase after the current phase's server starts cleanly and all relevant tests pass.
