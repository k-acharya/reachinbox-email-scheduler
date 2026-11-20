import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    googleId: string;
    name: string;
    email: string;
    avatar: string | null;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      throw new AppError('Unauthorized: Please log in with Google', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        googleId: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    if (!user) {
      req.session.destroy(() => {});
      throw new AppError('Unauthorized: User session invalid', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}