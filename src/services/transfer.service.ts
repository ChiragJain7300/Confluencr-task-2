import { TransactionType, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../prisma/prisma.config.js';
import {
  lockAccountForUpdate,
  updateAccountBalance,
} from '../repositories/account.repository.js';
import {
  createTransactionRecord,
  TransactionRow,
} from '../repositories/transaction.repository.js';
import {
  AccountNotFoundError,
  InsufficientBalanceError,
  DuplicateTransactionError,
} from '../types/errors.js';

export interface TransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: Decimal;
  description: string;
  referenceId: string;
}

export interface TransferResult {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: Decimal;
  sourceTransaction: TransactionRow;
  destinationTransaction: TransactionRow;
}

/**
 * Transfers funds from a source account to a destination account atomically.
 *
 * Deadlock Prevention Strategy:
 * When two concurrent requests transfer money between the same two accounts in
 * opposite directions (Account A -> B and Account B -> A simultaneously), a classic
 * database deadlock occurs if locks are acquired in arbitrary order.
 * To guarantee deadlock-freedom, we sort the two account IDs lexicographically and
 * always acquire the row-level locks in that deterministic order.
 */
export const transferFunds = async (input: TransferInput): Promise<TransferResult> => {
  return prisma.$transaction(async (transactionClient) => {
    // Step 1: Sort account IDs to determine strict lock acquisition order
    const [firstIdToLock, secondIdToLock] = [
      input.sourceAccountId,
      input.destinationAccountId,
    ].sort();

    // Step 2: Acquire row-level locks (SELECT ... FOR UPDATE) in deterministic order
    const firstLocked = await lockAccountForUpdate(
      transactionClient as typeof prisma,
      firstIdToLock
    );
    const secondLocked = await lockAccountForUpdate(
      transactionClient as typeof prisma,
      secondIdToLock
    );

    // Map the locked rows back to source and destination
    const sourceLocked =
      firstIdToLock === input.sourceAccountId ? firstLocked : secondLocked;
    const destinationLocked =
      firstIdToLock === input.destinationAccountId ? firstLocked : secondLocked;

    // Step 3: Validate that both accounts exist
    if (!sourceLocked) {
      throw new AccountNotFoundError(input.sourceAccountId);
    }
    if (!destinationLocked) {
      throw new AccountNotFoundError(input.destinationAccountId);
    }

    // Step 4: Validate source account has sufficient balance
    const sourceBalance = new Decimal(sourceLocked.balance);
    if (sourceBalance.lessThan(input.amount)) {
      throw new InsufficientBalanceError(
        sourceBalance.toFixed(4),
        input.amount.toFixed(4)
      );
    }

    // Step 5: Record debit transaction on source account and credit on destination account
    let sourceTransaction: TransactionRow;
    let destinationTransaction: TransactionRow;

    try {
      sourceTransaction = await createTransactionRecord(
        transactionClient as typeof prisma,
        {
          accountId: input.sourceAccountId,
          type: TransactionType.debit,
          amount: input.amount,
          description: input.description,
          referenceId: input.referenceId,
        }
      );

      destinationTransaction = await createTransactionRecord(
        transactionClient as typeof prisma,
        {
          accountId: input.destinationAccountId,
          type: TransactionType.credit,
          amount: input.amount,
          description: input.description,
          referenceId: input.referenceId,
        }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DuplicateTransactionError(
          input.referenceId,
          `either ${input.sourceAccountId} or ${input.destinationAccountId}`
        );
      }
      throw error;
    }

    // Step 6: Atomically adjust both account balances
    // Debit source (-amount)
    await updateAccountBalance(
      transactionClient as typeof prisma,
      input.sourceAccountId,
      input.amount.negated()
    );

    // Credit destination (+amount)
    await updateAccountBalance(
      transactionClient as typeof prisma,
      input.destinationAccountId,
      input.amount
    );

    return {
      sourceAccountId: input.sourceAccountId,
      destinationAccountId: input.destinationAccountId,
      amount: input.amount,
      sourceTransaction,
      destinationTransaction,
    };
  });
};

