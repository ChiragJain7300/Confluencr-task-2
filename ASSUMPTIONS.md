# Architectural Decisions & Assumptions

This document outlines the core domain assumptions, data integrity guarantees, and engineering decisions implemented in the Transaction Ledger API.

---

## 1. Concurrency Control & Race Condition Prevention

### Problem
In financial systems, concurrent debit operations against the same account pose a high risk of double-spending or overdrafts. For example, if an account has a balance of $100 and two concurrent requests attempt to debit $70 and $60 at the exact same millisecond:
- Without locking: Both requests read balance = $100. Both conclude $100 \ge \$70$ and $100 \ge \$60$. Both deduct, resulting in a balance of -$30.

### Solution
- **Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)**:
  Inside a database transaction (`prisma.$transaction`), we immediately acquire an exclusive lock on the account row before checking balance or writing records:
  ```sql
  SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE;
  ```
- **Atomicity**: The lock acquisition, balance check, transaction ledger insertion, and balance increment/decrement are wrapped in a single database transaction. If any condition fails, the entire transaction rolls back, releasing the lock.
- **Verification**: Verified under high concurrency in `tests/concurrency.test.ts`, where 5 parallel debits of $30 hit a $100 account; exactly 3 succeed, 2 fail, and the balance stays at $10.

---

## 2. Deadlock-Free Money Transfers

### Problem
When transferring funds between two accounts (Account A $\to$ Account B), locks must be acquired on both account rows. If User 1 initiates $A \to B$ while User 2 simultaneously initiates $B \to A$:
- Thread 1 locks A, waits for B.
- Thread 2 locks B, waits for A.
- **Result**: Classic circular database deadlock.

### Solution
- **Deterministic Lock Ordering**:
  Account IDs are sorted lexicographically prior to lock acquisition:
  ```ts
  const [firstIdToLock, secondIdToLock] = [sourceAccountId, destinationAccountId].sort();
  await lockAccountForUpdate(tx, firstIdToLock);
  await lockAccountForUpdate(tx, secondIdToLock);
  ```
  Both concurrent transactions will attempt to lock `min(A, B)` first. The winner proceeds to lock `max(A, B)`; the other waits. This eliminates cyclical dependencies and prevents deadlocks entirely.

---

## 3. Monetary Precision & Arithmetic

### Problem
Standard IEEE 754 floating-point numbers (`float`, `double` in JavaScript/PostgreSQL) suffer from representation errors (e.g. `0.1 + 0.2 = 0.30000000000000004`).

### Solution
- **Database Level**: Balances and transaction amounts are stored as `DECIMAL(18, 4)` in PostgreSQL. This allows up to 14 integer digits and 4 decimal places, supporting exact fractional cents/paise.
- **Application Level**: All calculations use `decimal.js` arbitrary-precision arithmetic. Numbers are never converted to native floating-point numbers during operations.

---

## 4. Idempotency & Per-Account Reference IDs

### Requirement
The problem specification states:
> *"For the same account, reference_id must be unique... The same reference_id may be used for different accounts."*

### Implementation
- Enforced at the database level using a composite unique constraint:
  ```sql
  CREATE UNIQUE INDEX "transactions_account_id_reference_id_key" 
  ON "transactions"("account_id", "reference_id");
  ```
- If a client retries a transaction with an identical `reference_id` for that account, the database rejects the insert with a unique constraint violation (`P2002`).
- The application catches this error, rolls back the transaction, and returns HTTP `409 Conflict` with the machine-readable code `DUPLICATE_TRANSACTION`.

---

## 5. Ledger Immutability & Balance Derivation

- **Append-Only Principle**: The ledger never executes `UPDATE` or `DELETE` on records in the `transactions` table.
- **Dual-Representation Invariant**:
  - The `accounts.balance` column holds the cached running balance for instant $O(1)$ reads.
  - The sum of all `transactions` for an account always strictly matches `accounts.balance`.
  - In a production extension, an asynchronous reconciliation worker could periodically verify $\text{balance} = \sum(\text{credits}) - \sum(\text{debits})$.

---

## 6. Defense-in-Depth Database Constraints

While application business logic checks non-negativity and positive amounts, database check constraints are configured as an immutable last line of defense:
- `chk_accounts_balance_non_negative`: `CHECK (balance >= 0)`
- `chk_transactions_amount_positive`: `CHECK (amount > 0)`

Even if application-level validation were somehow bypassed, PostgreSQL will enforce these invariants.

---

## 7. Zero Initial Balance Invariant

The specification requires:
> *"Initial balance must always be 0... The client should not be allowed to set the initial balance."*

- The `createAccountSchema` Zod validation schema strictly accepts only `{ "name": string }`. Any other fields are stripped.
- The `createAccountInDatabase` repository function does not accept a balance argument; the database schema defaults `balance` to `0.0000`.

