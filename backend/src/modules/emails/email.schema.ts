import { z } from 'zod';
import { env } from '../../config/env';

export const scheduleEmailsSchema = z.object({
  senderId: z.string().uuid('Valid senderId is required'),
  subject: z.string().min(1, 'Subject is required').max(300),
  body: z.string().min(1, 'Email body is required').max(50000),
  recipients: z
    .array(z.string().email('All recipients must be valid email addresses'))
    .min(1, 'At least one valid recipient is required')
    .max(5000, 'Maximum 5000 recipients per batch'),
  startTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: 'startTime must be a valid ISO datetime string',
  }),
  delayMs: z.coerce
    .number()
    .int()
    .min(0)
    .max(3600000)
    .optional()
    .default(env.MIN_DELAY_MS),
  hourlyLimit: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .default(env.MAX_EMAILS_PER_HOUR_PER_SENDER),
  idempotencyKey: z.string().min(8, 'idempotencyKey is required').max(128),
});

export type ScheduleEmailsInput = z.infer<typeof scheduleEmailsSchema>;