import { z } from 'zod';

// Schema for POST /api/v1/accounts/:id/transactions
// Zod v4 uses a single `error` string instead of separate `required_error` / `invalid_type_error`.
export const addTransactionSchema = z.object({
  type: z.enum(['credit', 'debit'], 'type must be either "credit" or "debit"'),

  // Amount must be a positive number — converted to Decimal in the controller
  amount: z
    .number('amount must be a number')
    .positive('amount must be greater than 0'),

  description: z
    .string('description must be a string')
    .trim()
    .min(1, 'description must not be empty'),

  reference_id: z
    .string('reference_id must be a string')
    .trim()
    .min(1, 'reference_id must not be empty'),
});

export type AddTransactionBody = z.infer<typeof addTransactionSchema>;

// Schema for GET /api/v1/accounts/:id/transactions (query parameters)
// All query params arrive as strings; we transform page and limit to numbers here.
export const listTransactionsQuerySchema = z.object({
  // type is optional — if omitted, both credit and debit records are returned
  type: z.enum(['credit', 'debit']).optional(),

  // Page number — defaults to 1, must be a positive integer
  page: z
    .string()
    .optional()
    .transform((value) => (value !== undefined ? parseInt(value, 10) : 1))
    .pipe(z.number().int().min(1, 'page must be at least 1')),

  // Page size — defaults to 10, capped at 100 to prevent huge queries
  limit: z
    .string()
    .optional()
    .transform((value) => (value !== undefined ? parseInt(value, 10) : 10))
    .pipe(z.number().int().min(1, 'limit must be at least 1').max(100, 'limit cannot exceed 100')),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
