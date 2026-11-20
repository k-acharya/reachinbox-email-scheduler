import { connectDatabase, prisma } from './config/database';
import { redis } from './config/redis';
import { createEmailWorker } from './queue/email.worker';
import { reconcileQueueOnStartup } from './services/recovery.service';
import { logger } from './utils/logger';

async function bootstrapWorker() {
  await connectDatabase();
  await redis.ping();
  await reconcileQueueOnStartup();

  const worker = createEmailWorker();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, gracefully shutting down worker...`);
    await worker.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrapWorker().catch((err) => {
  logger.error('Failed to start BullMQ worker process', err);
  process.exit(1);
});