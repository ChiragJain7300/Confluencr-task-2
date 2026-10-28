import {
  createAccountInDatabase,
  findAccountById,
  AccountRow,
} from '../repositories/account.repository.js';
import { AccountNotFoundError } from '../types/errors.js';

/**
 * Creates a new account with the given name.
 * The initial balance is always 0 — this is enforced by the repository
 * (not passed as a parameter), so clients can never set it.
 */
export const createAccount = async (name: string): Promise<AccountRow> => {
  return createAccountInDatabase(name);
};

/**
 * Returns the account details (including current balance) for the given ID.
 * Throws AccountNotFoundError if no account with that ID exists.
 */
export const getAccount = async (accountId: string): Promise<AccountRow> => {
  const account = await findAccountById(accountId);

  if (!account) {
    throw new AccountNotFoundError(accountId);
  }

  return account;
};
