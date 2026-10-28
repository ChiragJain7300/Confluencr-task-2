import { prisma } from '../../prisma/prisma.config.js';
import { TransactionType } from '@prisma/client';
import { Decimal } from 'decimal.js';

// The shape of transaction data we return from the database
export interface TransactionRow {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: Decimal;
  description: string;
  referenceId: string;
  createdAt: Date;
}

// Input required to record a new ledger entry
export interface CreateTransactionInput {
  accountId: string;
  type: TransactionType;
  amount: Decimal;
  description: string;
  referenceId: string;
}

// Options for querying transaction history with filtering and pagination
export interface ListTransactionsOptions {
  accountId: string;
  type?: TransactionType;   // optional — if absent, both credit and debit are returned
  page: number;
  limit: number;
}

// The paginated result shape returned from the list query
export interface PaginatedTransactions {
  transactions: TransactionRow[];
  totalRecords: number;
}

/**
 * Inserts a new transaction record into the database.
 *
 * Must be called inside a prisma.$transaction() block so that the insert
 * and the corresponding balance update are committed or rolled back together.
 *
 * The unique constraint on (account_id, reference_id) is enforced at the
 * database level — a duplicate will throw a Prisma P2002 error, which the
 * service layer catches and converts to a DuplicateTransactionError.
 */
export const createTransactionRecord = async (
  transactionClient: typeof prisma,
  input: CreateTransactionInput
): Promise<TransactionRow> => {
  return transactionClient.transaction.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      referenceId: input.referenceId,
    },
  });
};

/**
 * Returns a paginated, latest-first list of transactions for an account.
 * Optionally filtered by transaction type (credit or debit).
 *
 * We run the count and the data query in parallel for efficiency.
 */
export const listTransactions = async (
  options: ListTransactionsOptions
): Promise<PaginatedTransactions> => {
  // Build the filter once so both queries use the exact same WHERE clause
  const whereClause = {
    accountId: options.accountId,
    // Only add the type filter if a specific type was requested
    ...(options.type ? { type: options.type } : {}),
  };

  const skip = (options.page - 1) * options.limit;

  // Run count and data fetch in parallel to avoid two sequential DB round trips
  const [totalRecords, transactions] = await Promise.all([
    prisma.transaction.count({ where: whereClause }),
    prisma.transaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }, // latest first, as required by the spec
      skip,
      take: options.limit,
    }),
  ]);

  return { totalRecords, transactions };
};
