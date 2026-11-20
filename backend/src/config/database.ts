import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Connected to PostgreSQL via Prisma');
}