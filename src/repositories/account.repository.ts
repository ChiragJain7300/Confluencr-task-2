import { prisma } from '../../prisma/prisma.config.js';
import { Decimal } from 'decimal.js';

// The shape of account data we return from the database
export interface AccountRow {
  id: string;
  name: string;
  balance: Decimal;
  createdAt: Date;
}

// The shape of a locked account row returned by SELECT ... FOR UPDATE
// We only need id and balance for the concurrency check
interface LockedAccountRow {
  id: string;
  balance: Decimal;
}

/**
 * Inserts a new account into the database.
 * Balance is NOT accepted as a parameter — it is always 0 at creation.
 * This constraint is enforced here, not just in the service layer.
 */
export const createAccountInDatabase = async (name: string): Promise<AccountRow> => {
  return prisma.account.create({
    data: { name },
  });
};

/**
 * Finds a single account by its ID.
 * Returns null if no account exists with that ID.
 */
export const findAccountById = async (accountId: string): Promise<AccountRow | null> => {
  return prisma.account.findUnique({
    where: { id: accountId },
  });
};

/**
 * Locks the account row for update and returns it.
 *
 * This uses a raw SQL SELECT ... FOR UPDATE inside an active Prisma transaction
 * to acquire a pessimistic row-level lock. This prevents two concurrent requests
 * from reading the same balance at the same time, which would cause double-spends
 * or overdrafts under load.
 *
 * Must be called inside a prisma.$transaction() interactive transaction block.
 * The `transactionClient` parameter is the transaction-scoped Prisma client
 * passed down from the service layer.
 */
export const lockAccountForUpdate = async (
  transactionClient: typeof prisma,
  accountId: string
): Promise<LockedAccountRow | null> => {
  // Raw SQL is required here because Prisma's ORM API does not expose FOR UPDATE
  const rows = await transactionClient.$queryRaw<LockedAccountRow[]>`
    SELECT id, balance
    FROM accounts
    WHERE id = ${accountId}
    FOR UPDATE
  `;

  // $queryRaw always returns an array; return the first row or null if not found
  return rows[0] ?? null;
};

/**
 * Updates an account's balance by a signed delta amount.
 *
 * - For credits: pass a positive delta (e.g. +50)
 * - For debits:  pass a negative delta (e.g. -30)
 *
 * Must be called inside a prisma.$transaction() block, after the row has been
 * locked with lockAccountForUpdate() to prevent race conditions.
 */
export const updateAccountBalance = async (
  transactionClient: typeof prisma,
  accountId: string,
  balanceDelta: Decimal
): Promise<void> => {
  await transactionClient.account.update({
    where: { id: accountId },
    data: {
      balance: { increment: balanceDelta },
    },
  });
};
