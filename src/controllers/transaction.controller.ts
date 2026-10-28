import { Request, Response, NextFunction } from 'express';
import { TransactionType } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { addTransaction, getTransactionHistory } from '../services/transaction.service.js';
import { AddTransactionBody, ListTransactionsQuery } from '../schemas/transaction.schema.js';

/**
 * POST /api/v1/accounts/:id/transactions
 *
 * Adds a credit or debit transaction to the specified account.
 * The request body is already validated by validateRequest before this handler runs.
 */
export const addTransactionHandler = async (
  req: Request<{ id: string }, {}, AddTransactionBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const transaction = await addTransaction({
      accountId: req.params.id,
      type: req.body.type as TransactionType,
      // Convert the numeric amount to Decimal to preserve monetary precision
      amount: new Decimal(req.body.amount),
      description: req.body.description,
      referenceId: req.body.reference_id,
    });

    res.status(201).json({
      success: true,
      data: {
        id: transaction.id,
        account_id: transaction.accountId,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        reference_id: transaction.referenceId,
        created_at: transaction.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/accounts/:id/transactions
 *
 * Returns paginated transaction history for an account.
 * Query params (type, page, limit) are validated and transformed by the Zod schema
 * before this handler is reached, so they already have the correct types.
 *
 * We use a plain Request here to avoid the Express generic type constraint conflict
 * between ParsedQs (Express default) and our narrowed ListTransactionsQuery type.
 * The cast to ListTransactionsQuery is safe because the validateRequest middleware
 * already ran the Zod schema and replaced req.query with the parsed result.
 */
export const listTransactionsHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Safe cast — Zod has already parsed and transformed req.query at this point
    const query = req.query as unknown as ListTransactionsQuery;

    const result = await getTransactionHistory({
      accountId: req.params.id,
      type: query.type as TransactionType | undefined,
      page: query.page,
      limit: query.limit,
    });

    res.status(200).json({
      success: true,
      data: {
        transactions: result.transactions.map((transaction) => ({
          id: transaction.id,
          account_id: transaction.accountId,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          reference_id: transaction.referenceId,
          created_at: transaction.createdAt,
        })),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};
