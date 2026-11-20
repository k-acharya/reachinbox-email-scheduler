import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import {
  cancelScheduledEmail,
  getEmailById,
  getScheduledEmails,
  getSentEmails,
  scheduleEmailBatch,
} from './email.service';

export async function handleScheduleEmails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await scheduleEmailBatch(req.user!.id, req.body);
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleGetScheduledEmails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emails = await getScheduledEmails(req.user!.id);
    res.json({ success: true, emails });
  } catch (err) {
    next(err);
  }
}

export async function handleGetSentEmails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const emails = await getSentEmails(req.user!.id);
    res.json({ success: true, emails });
  } catch (err) {
    next(err);
  }
}

export async function handleGetEmailById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = await getEmailById(req.user!.id, String(req.params.id));
    res.json({ success: true, email });
  } catch (err) {
    next(err);
  }
}

export async function handleCancelEmail(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = await cancelScheduledEmail(req.user!.id, String(req.params.id));
    res.json({ success: true, email });
  } catch (err) {
    next(err);
  }
}