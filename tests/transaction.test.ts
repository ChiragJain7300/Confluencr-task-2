import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Transaction Endpoints', () => {
  let accountId: string;

  beforeEach(async () => {
    // Create a fresh test account before each test
    const res = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Transaction Test User' });
    accountId = res.body.data.id;
  });

  it('credits an account and correctly increases its balance', async () => {
    const creditRes = await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        description: 'First deposit',
        reference_id: `ref-credit-${Date.now()}`,
      });

    expect(creditRes.status).toBe(201);
    expect(creditRes.body.success).toBe(true);
    expect(creditRes.body.data.type).toBe('credit');
    expect(Number(creditRes.body.data.amount)).toBe(100);

    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}`);
    expect(Number(balanceRes.body.data.balance)).toBe(100);
  });

  it('debits an account and correctly decreases its balance', async () => {
    // Deposit 100 first
    await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        description: 'Initial deposit',
        reference_id: `ref-seed-${Date.now()}`,
      });

    // Debit 35
    const debitRes = await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'debit',
        amount: 35,
        description: 'Groceries',
        reference_id: `ref-debit-${Date.now()}`,
      });

    expect(debitRes.status).toBe(201);
    expect(debitRes.body.success).toBe(true);
    expect(Number(debitRes.body.data.amount)).toBe(35);

    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}`);
    expect(Number(balanceRes.body.data.balance)).toBe(65);
  });

  it('rejects a debit when the account has insufficient balance (returns 422)', async () => {
    // Current balance is 0, attempt to debit 50
    const res = await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'debit',
        amount: 50,
        description: 'Overdraft attempt',
        reference_id: `ref-overdraft-${Date.now()}`,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

    // Balance remains unchanged at 0
    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}`);
    expect(Number(balanceRes.body.data.balance)).toBe(0);
  });

  it('rejects duplicate reference_id for the same account with 409 Conflict', async () => {
    const referenceId = `ref-duplicate-${Date.now()}`;

    // First transaction with this reference_id
    const firstRes = await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 50,
        description: 'First attempt',
        reference_id: referenceId,
      });
    expect(firstRes.status).toBe(201);

    // Second transaction with the EXACT same reference_id for the same account
    const secondRes = await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 50,
        description: 'Retry attempt',
        reference_id: referenceId,
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.error.code).toBe('DUPLICATE_TRANSACTION');

    // Balance must NOT have doubled
    const balanceRes = await request(app).get(`/api/v1/accounts/${accountId}`);
    expect(Number(balanceRes.body.data.balance)).toBe(50);
  });

  it('allows the same reference_id to be used across DIFFERENT accounts', async () => {
    const secondAccountRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Second User' });
    const secondAccountId = secondAccountRes.body.data.id;

    const sharedReferenceId = `shared-ref-${Date.now()}`;

    // Account 1 uses shared reference_id
    const res1 = await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 75,
        description: 'Account 1 deposit',
        reference_id: sharedReferenceId,
      });
    expect(res1.status).toBe(201);

    // Account 2 uses the same reference_id — must succeed!
    const res2 = await request(app)
      .post(`/api/v1/accounts/${secondAccountId}/transactions`)
      .send({
        type: 'credit',
        amount: 75,
        description: 'Account 2 deposit',
        reference_id: sharedReferenceId,
      });
    expect(res2.status).toBe(201);
  });

  it('paginates and sorts transactions latest-first', async () => {
    // Add 3 sequential transactions
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post(`/api/v1/accounts/${accountId}/transactions`)
        .send({
          type: 'credit',
          amount: i * 10,
          description: `Tx ${i}`,
          reference_id: `ref-seq-${i}-${Date.now()}`,
        });
    }

    const historyRes = await request(app)
      .get(`/api/v1/accounts/${accountId}/transactions?page=1&limit=2`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.transactions).toHaveLength(2);
    expect(historyRes.body.data.pagination).toEqual({
      currentPage: 1,
      pageSize: 2,
      totalRecords: 3,
      totalPages: 2,
    });

    // Latest first: first item should be Tx 3 ($30)
    expect(Number(historyRes.body.data.transactions[0].amount)).toBe(30);
    expect(Number(historyRes.body.data.transactions[1].amount)).toBe(20);
  });

  it('filters transaction history by type', async () => {
    await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        description: 'Deposit',
        reference_id: `ref-f-credit-${Date.now()}`,
      });

    await request(app)
      .post(`/api/v1/accounts/${accountId}/transactions`)
      .send({
        type: 'debit',
        amount: 20,
        description: 'Snack',
        reference_id: `ref-f-debit-${Date.now()}`,
      });

    // Query only credits
    const creditsOnlyRes = await request(app)
      .get(`/api/v1/accounts/${accountId}/transactions?type=credit`);
    expect(creditsOnlyRes.status).toBe(200);
    expect(creditsOnlyRes.body.data.transactions).toHaveLength(1);
    expect(creditsOnlyRes.body.data.transactions[0].type).toBe('credit');

    // Query only debits
    const debitsOnlyRes = await request(app)
      .get(`/api/v1/accounts/${accountId}/transactions?type=debit`);
    expect(debitsOnlyRes.status).toBe(200);
    expect(debitsOnlyRes.body.data.transactions).toHaveLength(1);
    expect(debitsOnlyRes.body.data.transactions[0].type).toBe('debit');
  });
});
