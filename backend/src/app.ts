import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { env } from './config/env';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { checkElasticsearchHealth } from './config/elasticsearch';
import { errorMiddleware } from './middleware/error.middleware';
import { requireAuth } from './middleware/auth.middleware';
import authRoutes from './routes/auth.routes';
import senderRoutes from './routes/sender.routes';
import emailRoutes from './routes/email.routes';
import searchRoutes from './routes/search.routes';
import slackRoutes from './routes/slack.routes';
import { setupBullBoard } from './queue/bullboard';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(morgan('dev'));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  const redisStore = new RedisStore({
    client: {
      get: (key: string) => redis.get(key),
      set: (key: string, val: string, opts?: { EX?: number }) =>
        opts?.EX ? redis.set(key, val, 'EX', opts.EX) : redis.set(key, val),
      del: (keys: string | string[]) =>
        Array.isArray(keys) ? redis.del(...keys) : redis.del(keys),
      expire: (key: string, ttl: number) => redis.expire(key, ttl),
    },
    prefix: 'reachinbox:sess:',
  });

  app.use(
    session({
      name: 'reachinbox.sid',
      store: redisStore,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.get('/api/health', async (_req, res) => {
    let dbOk = false;
    let redisOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    try {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }
    const esOk = await checkElasticsearchHealth();

    const healthy = dbOk && redisOk;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        postgres: dbOk ? 'connected' : 'disconnected',
        redis: redisOk ? 'connected' : 'disconnected',
        elasticsearch: esOk ? 'connected' : 'disconnected',
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/senders', senderRoutes);
  app.use('/api/emails', searchRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);

  // Authenticated Bull Board queue dashboard
  app.use('/admin/queues', requireAuth, setupBullBoard());

  app.use(errorMiddleware);

  return app;
}