import { z } from 'zod';

// Schema for POST /api/v1/transfers
export const transferSchema = z
  .object({
    source_account_id: z
      .string('source_account_id must be a string')
      .trim()
      .min(1, 'source_account_id is required'),

    destination_account_id: z
      .string('destination_account_id must be a string')
      .trim()
      .min(1, 'destination_account_id is required'),

    amount: z
      .number('amount must be a number')
      .positive('amount must be greater than 0'),

    description: z
      .string('description must be a string')
      .trim()
      .min(1, 'description is required'),

    reference_id: z
      .string('reference_id must be a string')
      .trim()
      .min(1, 'reference_id is required'),
  })
  .refine((data) => data.source_account_id !== data.destination_account_id, {
    message: 'source_account_id and destination_account_id cannot be the same',
    path: ['destination_account_id'],
  });

export type TransferBody = z.infer<typeof transferSchema>;

