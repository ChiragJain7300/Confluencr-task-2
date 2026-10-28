import { TransactionType, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../prisma/prisma.config.js';
import {
  lockAccountForUpdate,
  updateAccountBalance,
} from '../repositories/account.repository.js';
import {
  createTransactionRecord,
  listTransactions,
  TransactionRow,
  PaginatedTransactions,
} from '../repositories/transaction.repository.js';
import {
  AccountNotFoundError,
  InsufficientBalanceError,
  DuplicateTransactionError,
} from '../types/errors.js';
import { findAccountById } from '../repositories/account.repository.js';

// Input for adding a single transaction (credit or debit)
export interface AddTransactionInput {
  accountId: string;
  type: TransactionType;
  amount: Decimal;
  description: string;
  referenceId: string;
}

// Options for retrieving paginated transaction history
export interface GetTransactionHistoryOptions {
  accountId: string;
  type?: TransactionType;
  page: number;
  limit: number;
}

// The full paginated response returned to the controller
export interface TransactionHistoryResult {
  transactions: TransactionRow[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

/**
 * Adds a credit or debit transaction to an account.
 *
 * This is the heart of the ledger engine. The entire operation runs inside a
 * single Prisma interactive transaction so it is fully atomic — if any step
 * fails, the database rolls back to exactly where it was before.
 *
 * Steps inside the transaction:
 * 1. Acquire a row-level lock on the account (SELECT ... FOR UPDATE)
 *    This blocks any other concurrent request that tries to modify the same
 *    account until our transaction commits or rolls back.
 * 2. Validate that the account exists.
 * 3. For debits: validate that the account has sufficient balance.
 * 4. Insert the transaction record.
 * 5. Update the account balance.
 */
export const addTransaction = async (input: AddTransactionInput): Promise<TransactionRow> => {
  // Wrap everything in an interactive transaction so steps 1–5 are atomic
  return prisma.$transaction(async (transactionClient) => {
    // Step 1: Lock the account row so no other concurrent request can read or
    // modify it until this transaction finishes. This prevents race conditions
    // where two simultaneous debits both see a sufficient balance and both succeed.
    const lockedAccount = await lockAccountForUpdate(
      transactionClient as typeof prisma,
      input.accountId
    );

    // Step 2: The account must exist
    if (!lockedAccount) {
      throw new AccountNotFoundError(input.accountId);
    }

    // Step 3: Debit-specific rule — reject if balance would go negative
    if (input.type === TransactionType.debit) {
      const currentBalance = new Decimal(lockedAccount.balance);
      if (currentBalance.lessThan(input.amount)) {
        throw new InsufficientBalanceError(
          currentBalance.toFixed(4),
          input.amount.toFixed(4)
        );
      }
    }

    // Step 4: Insert the immutable ledger record.
    // If this account already has a transaction with the same reference_id,
    // the DB unique constraint fires a P2002 error — caught below.
    let newTransaction: TransactionRow;
    try {
      newTransaction = await createTransactionRecord(
        transactionClient as typeof prisma,
        {
          accountId: input.accountId,
          type: input.type,
          amount: input.amount,
          description: input.description,
          referenceId: input.referenceId,
        }
      );
    } catch (error) {
      // P2002 = unique constraint violation — the reference_id already exists
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DuplicateTransactionError(input.referenceId, input.accountId);
      }
      throw error; // re-throw anything unexpected
    }

    // Step 5: Adjust the account balance.
    // Credits are positive deltas; debits are negative.
    const balanceDelta =
      input.type === TransactionType.credit
        ? input.amount
        : input.amount.negated();

    await updateAccountBalance(
      transactionClient as typeof prisma,
      input.accountId,
      balanceDelta
    );

    return newTransaction;
  });
};

/**
 * Returns paginated transaction history for an account.
 * Validates that the account exists before querying transactions.
 */
export const getTransactionHistory = async (
  options: GetTransactionHistoryOptions
): Promise<TransactionHistoryResult> => {
  // Verify the account exists before running the history query
  const account = await findAccountById(options.accountId);
  if (!account) {
    throw new AccountNotFoundError(options.accountId);
  }

  const { transactions, totalRecords } = await listTransactions({
    accountId: options.accountId,
    type: options.type,
    page: options.page,
    limit: options.limit,
  });

  const totalPages = Math.ceil(totalRecords / options.limit);

  return {
    transactions,
    pagination: {
      currentPage: options.page,
      pageSize: options.limit,
      totalRecords,
      totalPages,
    },
  };
};
