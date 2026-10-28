import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Concurrency & Race Condition Control', () => {
  it('prevents overdraft under concurrent debit requests via row-level locking', async () => {
    // 1. Create a test account
    const accRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Concurrency Test User' });
    const accountId = accRes.body.data.id;

    // 2. Fund the account with exactly 100
    await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        description: 'Initial funding',
        reference_id: `concurr-seed-${Date.now()}`,
      });

    // 3. Fire 5 simultaneous debits of 30 each.
    // Total attempted debit: 5 * 30 = 150 (exceeds balance 100).
    // With row-level locking (SELECT ... FOR UPDATE), exactly 3 debits must
    // succeed (100 - 90 = 10 remaining), and the remaining 2 must be rejected with 422.
    const debitPromises = Array.from({ length: 5 }, (_, index) =>
      request(app)
        .post(`/api/v1/accounts/${accountId}/transactions`)
        .send({
          type: 'debit',
          amount: 30,
          description: `Concurrent debit #${index + 1}`,
          reference_id: `concurr-debit-${index + 1}-${Date.now()}`,
        })
    );

    const results = await Promise.all(debitPromises);

    const successfulDebits = results.filter((res) => res.status === 201);
    const rejectedDebits = results.filter((res) => res.status === 422);

    expect(successfulDebits).toHaveLength(3);
    expect(rejectedDebits).toHaveLength(2);

    // 4. Verify final balance is exactly 10 — never negative!
    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}`);
    expect(Number(balanceRes.body.data.balance)).toBe(10);
  });
});
