import { z } from 'zod';

export const createSenderSchema = z.object({
  name: z.string().min(1, 'Sender name is required').max(100),
  email: z.string().email('Valid sender email is required'),
  smtpHost: z.string().min(1, 'SMTP host is required').default('smtp.ethereal.email'),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpUsername: z.string().min(1, 'SMTP username is required'),
  smtpPassword: z.string().min(1, 'SMTP password is required'),
  isActive: z.boolean().optional().default(true),
});

export const updateSenderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUsername: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export type CreateSenderInput = z.infer<typeof createSenderSchema>;
export type UpdateSenderInput = z.infer<typeof updateSenderSchema>;