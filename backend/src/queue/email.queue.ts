import { Queue } from 'bullmq';
import { bullmqConnection } from './queue.connection';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export interface EmailJobData {
  emailId: string;
  userId: string;
  senderId: string;
  hourlyLimit: number;
  minDelayMs: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: false,
  },
});

export function buildDeterministicJobId(emailId: string): string {
  return `email-${emailId}`;
}

export async function enqueueEmailJob(
  data: EmailJobData,
  scheduledAt: Date
): Promise<string> {
  const jobId = buildDeterministicJobId(data.emailId);
  const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());

  const existing = await emailQueue.getJob(jobId);
  if (existing) {
    logger.debug(`Job ${jobId} already exists in BullMQ, skipping duplicate enqueue`);
    return jobId;
  }

  await emailQueue.add('send-scheduled-email', data, {
    jobId,
    delay: delayMs,
  });

  return jobId;
}

export async function removeEmailJob(emailId: string): Promise<boolean> {
  const jobId = buildDeterministicJobId(emailId);
  const job = await emailQueue.getJob(jobId);
  if (!job) return false;
  const state = await job.getState();
  if (state === 'active') {
    return false;
  }
  await job.remove();
  return true;
}