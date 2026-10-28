import { Request, Response, NextFunction } from 'express';
import { createAccount, getAccount } from '../services/account.service.js';
import { CreateAccountBody } from '../schemas/account.schema.js';

/**
 * POST /api/v1/accounts
 *
 * Creates a new account. The request body is already validated by the
 * validateRequest middleware before this handler is reached.
 */
export const createAccountHandler = async (
  req: Request<{}, {}, CreateAccountBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const account = await createAccount(req.body.name);

    res.status(201).json({
      success: true,
      data: {
        id: account.id,
        name: account.name,
        balance: account.balance,
        created_at: account.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/accounts/:id
 *
 * Returns the current balance and details for a single account.
 * Returns 404 if the account does not exist.
 */
export const getAccountHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const account = await getAccount(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        account_id: account.id,
        name: account.name,
        balance: account.balance,
        created_at: account.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

