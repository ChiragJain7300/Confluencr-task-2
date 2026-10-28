import { Request, Response, NextFunction } from 'express';
import { Decimal } from 'decimal.js';
import { transferFunds } from '../services/transfer.service.js';
import { TransferBody } from '../schemas/transfer.schema.js';

/**
 * POST /api/v1/transfers
 *
 * Transfers money from a source account to a destination account atomically.
 * Ensures deadlock prevention and full transaction consistency.
 */
export const transferHandler = async (
  req: Request<{}, {}, TransferBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await transferFunds({
      sourceAccountId: req.body.source_account_id,
      destinationAccountId: req.body.destination_account_id,
      amount: new Decimal(req.body.amount),
      description: req.body.description,
      referenceId: req.body.reference_id,
    });

    res.status(200).json({
      success: true,
      data: {
        source_account_id: result.sourceAccountId,
        destination_account_id: result.destinationAccountId,
        amount: result.amount,
        source_transaction_id: result.sourceTransaction.id,
        destination_transaction_id: result.destinationTransaction.id,
        status: 'completed',
      },
    });
  } catch (error) {
    next(error);
  }
};

