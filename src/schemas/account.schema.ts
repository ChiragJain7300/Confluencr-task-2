import { z } from 'zod';

// Schema for POST /api/v1/accounts
// Only `name` is accepted — balance is always set to 0 by the server.
// Zod v4 uses a single `error` string instead of `required_error` / `invalid_type_error`.
export const createAccountSchema = z.object({
  name: z
    .string('name must be a string')
    .trim()
    .min(1, 'name must not be empty'),
});

export type CreateAccountBody = z.infer<typeof createAccountSchema>;
