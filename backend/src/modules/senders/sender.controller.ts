import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { createSender, deleteSender, listSenders, updateSender } from './sender.service';

export async function handleCreateSender(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sender = await createSender(req.user!.id, req.body);
    res.status(201).json({ success: true, sender });
  } catch (err) {
    next(err);
  }
}

export async function handleListSenders(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const senders = await listSenders(req.user!.id);
    res.json({ success: true, senders });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateSender(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sender = await updateSender(req.user!.id, String(req.params.id), req.body);
    res.json({ success: true, sender });
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteSender(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await deleteSender(req.user!.id, String(req.params.id));
    res.json({ success: true, message: 'Sender deleted' });
  } catch (err) {
    next(err);
  }
}