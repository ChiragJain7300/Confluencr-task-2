# Transaction Ledger API

A high-reliability, ACID-compliant transaction ledger REST API built with **Node.js**, **Express 5**, **TypeScript**, **Prisma 7**, and **PostgreSQL**.

Designed with financial-grade precision, pessimistic row-level locking for concurrency safety, immutable ledger entries, and deadlock-free fund transfers.

---

## Features

- **Account Management**: Create accounts (server-enforced $0 balance) and query current balances.
- **Credit & Debit Ledger**: Append-only immutable transaction entries with atomic balance updates.
- **Concurrency & Overdraft Protection**: Uses pessimistic row-level locking (`SELECT ... FOR UPDATE`) inside interactive database transactions to eliminate race conditions under parallel debit requests.
- **Idempotency & Deduplication**: Per-account idempotency enforced by composite unique constraint `(account_id, reference_id)`.
- **Transaction History**: Paginated, latest-first history retrieval with optional transaction type filtering (`credit` / `debit`).
- **Atomic Money Transfer (Bonus)**: Deadlock-safe two-account transfer using deterministic lock ordering.
- **Monetary Precision**: Arbitrary-precision numeric handling via `DECIMAL(18, 4)` in SQL and `decimal.js` in Node.js (no floating-point rounding errors).
- **Validation & Error Handling**: Runtime payload validation via Zod with standardized JSON error envelopes.

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Runtime** | Node.js (ESM, TypeScript strict mode) |
| **Framework** | Express 5 |
| **Database** | PostgreSQL 16 |
| **ORM / Driver** | Prisma 7 + `@prisma/adapter-pg` driver adapter |
| **Validation** | Zod |
| **Arithmetic** | Decimal.js |
| **Testing** | Vitest + Supertest |

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma              # Data models and indexes
│   ├── prisma.config.ts           # Prisma 7 PostgreSQL driver adapter configuration
│   └── migrations/                # Database migrations (including CHECK constraints)
├── src/
│   ├── config/                    # Environment variables and configuration
│   ├── controllers/               # Request/response handling layer
│   ├── middlewares/               # Request validation and centralized error handler
│   ├── repositories/              # Direct database access and row-level locking
│   ├── routes/                    # Express routing definitions
│   ├── schemas/                   # Zod request validation schemas
│   ├── services/                  # Business logic and transaction orchestration
│   ├── types/                     # Domain error classes and interfaces
│   ├── app.ts                     # Express app configuration
│   └── server.ts                  # Server entrypoint and graceful shutdown
├── tests/
│   ├── account.test.ts            # Account creation and balance tests
│   ├── transaction.test.ts        # Credit, debit, duplicate rejection, history tests
│   ├── concurrency.test.ts        # Parallel debit race-condition verification
│   └── transfer.test.ts           # Atomic transfer and deadlock-freedom tests
├── docker-compose.yml             # Local PostgreSQL container definition
├── AGENTS.md                      # AI pair-programming guidelines
├── ASSUMPTIONS.md                 # Architectural decisions and domain assumptions
└── API_DOCUMENTATION.md           # Full endpoint reference with curl examples
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: Local PostgreSQL server OR Docker

### 1. Installation

```bash
git clone <repo-url>
cd Confluencr-task
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure your `DATABASE_URL` in `.env`:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ledger_db?schema=public"
```

### 3. Start Database (Optional if using Docker)

If you don't have a local PostgreSQL instance running:

```bash
docker-compose up -d
```

### 4. Run Migrations

Apply the database schema and constraints:

```bash
npm run prisma:migrate
```

*(Or to deploy without prompt: `npm run prisma:deploy`)*

---

## Running the Application

### Development Mode (with hot-reload)

```bash
npm run dev
```

### Production Build & Run

```bash
npm run build
npm start
```

The server will start at `http://localhost:3000`. Test the health check:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

---

## Running Automated Tests

Run the full integration and concurrency test suite with **Vitest**:

```bash
npm test
```

### What the test suite covers:
1. **`account.test.ts`**:
   - Creating account with initial balance `0`.
   - Rejection of invalid account payloads.
   - Balance query and `404` for non-existent accounts.
2. **`transaction.test.ts`**:
   - Credit operations and correct balance increments.
   - Debit operations and correct balance decrements.
   - Overdraft prevention (`422 Insufficient Balance`).
   - Duplicate `reference_id` rejection for the same account (`409 Conflict`).
   - Re-use of the same `reference_id` across *different* accounts.
   - Latest-first sorting, pagination metadata, and type filtering.
3. **`concurrency.test.ts`**:
   - Firing 5 simultaneous debit requests against an account with limited funds.
   - Verifying row-level locks prevent race conditions; exactly 3 succeed, 2 fail, and balance remains positive.
4. **`transfer.test.ts`**:
   - 2-way atomic money transfer.
   - Rollback verification on insufficient funds or missing accounts.
   - Self-transfer rejection.
   - Deadlock-free concurrent bidirectional transfers ($A \to B$ and $B \to A$).

---

## API Overview

Detailed documentation and examples are available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/v1/accounts` | Create account (`{ "name": "Alice" }`) |
| `GET` | `/api/v1/accounts/:id` | Get account balance |
| `POST` | `/api/v1/accounts/:id/transactions` | Add credit or debit |
| `GET` | `/api/v1/accounts/:id/transactions` | Query transaction history (supports `?type=`, `?page=`, `?limit=`) |
| `POST` | `/api/v1/transfers` | Transfer funds between accounts |

---

## Deliverables

1. **Source Code**: Fully implemented in `src/`.
2. **README**: This file (`README.md`).
3. **API Documentation**: Detailed spec in [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).
4. **Assumptions**: Complete architectural breakdown in [`ASSUMPTIONS.md`](./ASSUMPTIONS.md).

