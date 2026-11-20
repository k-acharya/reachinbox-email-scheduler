import { Response, NextFunction } from 'express';
import { EmailStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { searchUserEmails } from '../../services/elasticsearch.service';

const VALID_STATUSES: EmailStatus[] = ['scheduled', 'processing', 'sent', 'failed'];

export async function handleSearchEmails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      rawStatus && VALID_STATUSES.includes(rawStatus as EmailStatus)
        ? (rawStatus as EmailStatus)
        : undefined;

    const emails = await searchUserEmails({
      userId: req.user!.id,
      query: q,
      status,
    });

    res.json({
      success: true,
      count: emails.length,
      emails,
    });
  } catch (err) {
    next(err);
  }
}