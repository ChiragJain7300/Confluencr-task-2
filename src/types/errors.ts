export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class AccountNotFoundError extends NotFoundError {
  constructor(accountId: string) {
    super(`Account with ID '${accountId}' was not found`, 'ACCOUNT_NOT_FOUND');
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(currentBalance: string, requestedAmount: string) {
    super(
      `Insufficient balance. Current balance is ${currentBalance}, but attempted to debit ${requestedAmount}`,
      422,
      'INSUFFICIENT_BALANCE',
      { currentBalance, requestedAmount }
    );
  }
}

export class DuplicateTransactionError extends AppError {
  constructor(referenceId: string, accountId: string) {
    super(
      `Transaction with reference_id '${referenceId}' already exists for account '${accountId}'`,
      409,
      'DUPLICATE_TRANSACTION',
      { referenceId, accountId }
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, details);
  }
}

