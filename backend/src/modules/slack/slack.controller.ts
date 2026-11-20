import { Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import {
  buildSlackAuthUrl,
  disconnectSlack,
  exchangeSlackCodeAndSave,
  getSlackConnectionStatus,
} from '../../services/slack.service';

export function handleSlackConnect(req: AuthenticatedRequest, res: Response): void {
  const { url, state } = buildSlackAuthUrl();
  req.session.slackOauthState = state;
  req.session.save(() => {
    res.redirect(url);
  });
}

export async function handleSlackCallback(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code) {
      throw new AppError('Missing Slack authorization code', 400);
    }

    if (!state || state !== req.session.slackOauthState) {
      throw new AppError('Invalid Slack OAuth state parameter', 403);
    }

    delete req.session.slackOauthState;
    await exchangeSlackCodeAndSave(req.user!.id, code);

    req.session.save(() => {
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
    });
  } catch (err) {
    next(err);
  }
}

export async function handleSlackStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await getSlackConnectionStatus(req.user!.id);
    res.json({ success: true, slack: status });
  } catch (err) {
    next(err);
  }
}

export async function handleSlackDisconnect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await disconnectSlack(req.user!.id);
    res.json({ success: true, message: 'Slack workspace disconnected' });
  } catch (err) {
    next(err);
  }
}