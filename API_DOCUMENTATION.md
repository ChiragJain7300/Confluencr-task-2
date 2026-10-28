# API Documentation — Transaction Ledger API

Base URL: `http://localhost:3000/api/v1`

All responses follow a consistent JSON envelope format:
- **Success**: `{ "success": true, "data": ... }`
- **Error**: `{ "success": false, "error": { "code": string, "message": string, "details": any } }`

---

## Table of Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/health` | Service health check |
| `POST` | `/api/v1/accounts` | Create a new account |
| `GET` | `/api/v1/accounts/:id` | Get account balance and details |
| `POST` | `/api/v1/accounts/:id/transactions` | Add a credit or debit transaction |
| `GET` | `/api/v1/accounts/:id/transactions` | Query paginated transaction history |
| `POST` | `/api/v1/transfers` | Transfer funds between accounts (Bonus) |

---

## 1. Create Account

Creates a new account. Initial balance is strictly set to `0` by the server.

- **URL**: `/api/v1/accounts`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`

### Request Body
```json
{
  "name": "Alice Smith"
}
```

### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "e6a7138b-d748-4cb2-8356-d743a6b85fa1",
    "name": "Alice Smith",
    "balance": "0",
    "created_at": "2026-10-28T15:30:00.000Z"
  }
}
```

### Errors
- `400 Bad Request` (`VALIDATION_ERROR`): Name is missing or empty.

---

## 2. Get Account Balance

Fetches the current balance and metadata for an account.

- **URL**: `/api/v1/accounts/:id`
- **Method**: `GET`

### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "account_id": "e6a7138b-d748-4cb2-8356-d743a6b85fa1",
    "name": "Alice Smith",
    "balance": "150.0000",
    "created_at": "2026-10-28T15:30:00.000Z"
  }
}
```

### Errors
- `404 Not Found` (`ACCOUNT_NOT_FOUND`): No account exists with that ID.

---

## 3. Add Transaction

Applies an atomic credit or debit to an account.

- **URL**: `/api/v1/accounts/:id/transactions`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`

### Request Body
```json
{
  "type": "credit",
  "amount": 100.50,
  "description": "Salary deposit",
  "reference_id": "salary-2026-10"
}
```

| Field | Type | Description |
|:------|:-----|:------------|
| `type` | `"credit"` \| `"debit"` | Transaction type |
| `amount` | `number` | Must be positive ($> 0$) |
| `description` | `string` | Non-empty description |
| `reference_id` | `string` | Unique per account |

### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "7b095ef6-9281-4ba2-b2f1-6da48d42ef41",
    "account_id": "e6a7138b-d748-4cb2-8356-d743a6b85fa1",
    "type": "credit",
    "amount": "100.5000",
    "description": "Salary deposit",
    "reference_id": "salary-2026-10",
    "created_at": "2026-10-28T15:32:00.000Z"
  }
}
```

### Errors
- `404 Not Found` (`ACCOUNT_NOT_FOUND`): Account does not exist.
- `409 Conflict` (`DUPLICATE_TRANSACTION`): `reference_id` already used for this account.
- `422 Unprocessable Entity` (`INSUFFICIENT_BALANCE`): Debit amount exceeds available balance.
- `400 Bad Request` (`VALIDATION_ERROR`): Invalid payload (e.g., negative amount, invalid type).

---

## 4. Get Transaction History

Fetches transactions for an account with sorting and pagination. Transactions are returned latest-first (`created_at DESC`).

- **URL**: `/api/v1/accounts/:id/transactions`
- **Method**: `GET`
- **Query Parameters**:
  - `type` *(optional)*: Filter by `"credit"` or `"debit"`.
  - `page` *(optional, default: 1)*: Page number ($\ge 1$).
  - `limit` *(optional, default: 10)*: Page size (1 to 100).

### Example
`GET /api/v1/accounts/:id/transactions?type=credit&page=1&limit=5`

### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "7b095ef6-9281-4ba2-b2f1-6da48d42ef41",
        "account_id": "e6a7138b-d748-4cb2-8356-d743a6b85fa1",
        "type": "credit",
        "amount": "100.5000",
        "description": "Salary deposit",
        "reference_id": "salary-2026-10",
        "created_at": "2026-10-28T15:32:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 5,
      "totalRecords": 1,
      "totalPages": 1
    }
  }
}
```

### Errors
- `404 Not Found` (`ACCOUNT_NOT_FOUND`): Account does not exist.
- `400 Bad Request` (`VALIDATION_ERROR`): Invalid query parameters.

---

## 5. Transfer Funds (Bonus)

Atomically transfers funds between two distinct accounts. Employs deadlock-safe row locking.

- **URL**: `/api/v1/transfers`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`

### Request Body
```json
{
  "source_account_id": "e6a7138b-d748-4cb2-8356-d743a6b85fa1",
  "destination_account_id": "18cfd923-45a7-47b2-a42e-1e9bf4392a10",
  "amount": 30.00,
  "description": "Payment for dinner",
  "reference_id": "transfer-dinner-01"
}
```

### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "source_account_id": "e6a7138b-d748-4cb2-8356-d743a6b85fa1",
    "destination_account_id": "18cfd923-45a7-47b2-a42e-1e9bf4392a10",
    "amount": "30",
    "source_transaction_id": "31ac16e9-b59a-4c28-bd64-f6735e5d16e3",
    "destination_transaction_id": "09dc15ee-3cae-4f36-9b57-d3163fb4e98f",
    "status": "completed"
  }
}
```

### Errors
- `400 Bad Request` (`VALIDATION_ERROR`): Source and destination accounts are the same, or amount $\le 0$.
- `404 Not Found` (`ACCOUNT_NOT_FOUND`): Either source or destination account does not exist.
- `422 Unprocessable Entity` (`INSUFFICIENT_BALANCE`): Source account has insufficient balance.
- `409 Conflict` (`DUPLICATE_TRANSACTION`): Reference ID already used.

---

## Quick cURL Examples

```bash
# 1. Create account
curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'

# 2. Get balance
curl http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>

# 3. Add credit
curl -X POST http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"credit","amount":100,"description":"Seed","reference_id":"ref-1"}'

# 4. Add debit
curl -X POST http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"debit","amount":40,"description":"Coffee","reference_id":"ref-2"}'

# 5. List history
curl "http://localhost:3000/api/v1/accounts/<ACCOUNT_ID>/transactions?page=1&limit=10"

# 6. Transfer
curl -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -d '{"source_account_id":"<ID_A>","destination_account_id":"<ID_B>","amount":25,"description":"Split bill","reference_id":"tr-1"}'
```

