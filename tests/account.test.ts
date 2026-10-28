import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('Account Endpoints', () => {
  it('POST /api/v1/accounts — creates a new account with an initial balance of 0', async () => {
    const response = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Charlie' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.name).toBe('Charlie');
    // Balance must be 0 and cannot be set by client
    expect(Number(response.body.data.balance)).toBe(0);
    expect(response.body.data).toHaveProperty('created_at');
  });

  it('POST /api/v1/accounts — fails validation when name is missing or empty', async () => {
    const emptyNameRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: '   ' });

    expect(emptyNameRes.status).toBe(400);
    expect(emptyNameRes.body.success).toBe(false);
    expect(emptyNameRes.body.error.code).toBe('VALIDATION_ERROR');

    const missingNameRes = await request(app)
      .post('/api/v1/accounts')
      .send({});

    expect(missingNameRes.status).toBe(400);
    expect(missingNameRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/accounts/:id — retrieves account balance', async () => {
    const createRes = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'Diana' });

    const accountId = createRes.body.data.id;

    const getRes = await request(app).get(`/api/v1/accounts/${accountId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.account_id).toBe(accountId);
    expect(getRes.body.data.name).toBe('Diana');
    expect(Number(getRes.body.data.balance)).toBe(0);
  });

  it('GET /api/v1/accounts/:id — returns 404 for a non-existent account ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const response = await request(app).get(`/api/v1/accounts/${nonExistentId}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});

