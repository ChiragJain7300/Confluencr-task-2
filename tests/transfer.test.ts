import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Money Transfer Endpoints (Bonus)', () => {
  let accountAId: string;
  let accountBId: string;

  beforeEach(async () => {
    // Create Account A and Account B
    const resA = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Alice Transfer' });
    accountAId = resA.body.data.id;

    const resB = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Bob Transfer' });
    accountBId = resB.body.data.id;

    // Fund Account A with 100 and Account B with 50
    await request(app)
      .post(`/api/v1/accounts/${accountAId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        description: 'Seed A',
        reference_id: `transfer-seed-a-${Date.now()}`,
      });

    await request(app)
      .post(`/api/v1/accounts/${accountBId}/transactions`)
      .send({
        type: 'credit',
        amount: 50,
        description: 'Seed B',
        reference_id: `transfer-seed-b-${Date.now()}`,
      });
  });

  it('transfers 30 from Account A to Account B atomically', async () => {
    const transferRes = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountBId,
        amount: 30,
        description: 'Dinner payment',
        reference_id: `transfer-success-${Date.now()}`,
      });

    expect(transferRes.status).toBe(200);
    expect(transferRes.body.success).toBe(true);
    expect(transferRes.body.data.status).toBe('completed');

    // Account A balance: 100 - 30 = 70
    const resA = await request(app).get(`/api/v1/accounts/${accountAId}`);
    expect(Number(resA.body.data.balance)).toBe(70);

    // Account B balance: 50 + 30 = 80
    const resB = await request(app).get(`/api/v1/accounts/${accountBId}`);
    expect(Number(resB.body.data.balance)).toBe(80);
  });

  it('rejects transfer when source account has insufficient balance (returns 422)', async () => {
    // Account A has 100, attempt to transfer 150
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountBId,
        amount: 150,
        description: 'Overdraft transfer',
        reference_id: `transfer-overdraft-${Date.now()}`,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');

    // Both balances remain untouched
    const resA = await request(app).get(`/api/v1/accounts/${accountAId}`);
    expect(Number(resA.body.data.balance)).toBe(100);

    const resB = await request(app).get(`/api/v1/accounts/${accountBId}`);
    expect(Number(resB.body.data.balance)).toBe(50);
  });

  it('rejects self-transfers (source === destination)', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountAId,
        amount: 10,
        description: 'Self-transfer attempt',
        reference_id: `transfer-self-${Date.now()}`,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects transfer if destination account does not exist (returns 404)', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: nonExistentId,
        amount: 10,
        description: 'Ghost transfer',
        reference_id: `transfer-ghost-${Date.now()}`,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');

    // Source balance remains 100
    const resA = await request(app).get(`/api/v1/accounts/${accountAId}`);
    expect(Number(resA.body.data.balance)).toBe(100);
  });

  it('executes concurrent bidirectional transfers without deadlock', async () => {
    // Account A transfers 5 to B, while Account B simultaneously transfers 5 to A
    const transfer1 = request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountBId,
        amount: 5,
        description: 'A to B',
        reference_id: `bidir-ab-${Date.now()}`,
      });

    const transfer2 = request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: accountBId,
        destination_account_id: accountAId,
        amount: 5,
        description: 'B to A',
        reference_id: `bidir-ba-${Date.now()}`,
      });

    const [res1, res2] = await Promise.all([transfer1, transfer2]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Net balance change is 0: A still has 100, B still has 50
    const resA = await request(app).get(`/api/v1/accounts/${accountAId}`);
    expect(Number(resA.body.data.balance)).toBe(100);

    const resB = await request(app).get(`/api/v1/accounts/${accountBId}`);
    expect(Number(resB.body.data.balance)).toBe(50);
  });
});
