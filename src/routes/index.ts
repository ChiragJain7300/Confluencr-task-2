import { Router } from 'express';
import { validateRequest } from '../middlewares/validate.js';
import { createAccountSchema } from '../schemas/account.schema.js';
import {
  addTransactionSchema,
  listTransactionsQuerySchema,
} from '../schemas/transaction.schema.js';
import { transferSchema } from '../schemas/transfer.schema.js';
import { createAccountHandler, getAccountHandler } from '../controllers/account.controller.js';
import {
  addTransactionHandler,
  listTransactionsHandler,
} from '../controllers/transaction.controller.js';
import { transferHandler } from '../controllers/transfer.controller.js';

const router = Router();

// POST /api/v1/accounts — create a new account
router.post(
  '/accounts',
  validateRequest({ body: createAccountSchema }),
  createAccountHandler
);

// GET /api/v1/accounts/:id — get account balance and details
router.get('/accounts/:id', getAccountHandler);

// POST /api/v1/accounts/:id/transactions — add a credit or debit transaction
router.post(
  '/accounts/:id/transactions',
  validateRequest({ body: addTransactionSchema }),
  addTransactionHandler
);

// GET /api/v1/accounts/:id/transactions — get paginated transaction history
router.get(
  '/accounts/:id/transactions',
  validateRequest({ query: listTransactionsQuerySchema }),
  listTransactionsHandler
);

// POST /api/v1/transfers — transfer funds between two accounts (Bonus)
router.post(
  '/transfers',
  validateRequest({ body: transferSchema }),
  transferHandler
);

export default router;
