import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/error.middleware';
import { buildGoogleAuthUrl, handleGoogleOAuthCallback } from './auth.service';
import { prisma } from '../../config/database';

const OAUTH_STATE_PREFIX = 'reachinbox:oauth_state:';

export async function initiateGoogleLogin(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { url, state } = buildGoogleAuthUrl();
    await redis.set(`${OAUTH_STATE_PREFIX}${state}`, '1', 'EX', 600);
    res.redirect(url);
  } catch (err) {
    next(err);
  }
}

export async function googleAuthCallback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code) {
      throw new AppError('Missing Google authorization code', 400);
    }

    if (!state) {
      throw new AppError('Missing OAuth state parameter', 403);
    }

    const deleted = await redis.del(`${OAUTH_STATE_PREFIX}${state}`);
    if (deleted !== 1) {
      throw new AppError('Invalid or expired OAuth state parameter', 403);
    }

    const user = await handleGoogleOAuthCallback(code);
    req.session.userId = user.id;

    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      res.redirect(env.FRONTEND_URL);
    });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.session.userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        googleId: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

export function logoutUser(req: Request, res: Response, next: NextFunction): void {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('reachinbox.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
}