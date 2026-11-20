import { prisma } from '../config/database';
import {
  buildDeterministicJobId,
  emailQueue,
  enqueueEmailJob,
} from '../queue/email.queue';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface ReconciliationSummary {
  checkedScheduled: number;
  recreatedJobs: number;
  alreadyQueued: number;
  ambiguousProcessingResolved: number;
}

export async function reconcileQueueOnStartup(): Promise<ReconciliationSummary> {
  logger.info('Starting startup queue reconciliation against PostgreSQL...');

  // 1. Handle ambiguous in-flight ('processing') emails safely without blind duplicate SMTP sends
  const stuckProcessing = await prisma.email.findMany({
    where: { status: 'processing' },
  });

  let ambiguousProcessingResolved = 0;
  for (const email of stuckProcessing) {
    const jobId = buildDeterministicJobId(email.id);
    const job = await emailQueue.getJob(jobId);
    const state = job ? await job.getState() : null;

    // If BullMQ no longer has an active/waiting lock on this job, the worker crashed mid-delivery
    if (!job || state === 'failed' || state === 'unknown') {
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'failed',
          lastError:
            'Worker process restarted while SMTP delivery was in-flight; halted to prevent duplicate send',
        },
      });
      ambiguousProcessingResolved++;
    }
  }

  // 2. Reconcile all 'scheduled' emails in PostgreSQL and recreate only missing BullMQ jobs
  const pendingEmails = await prisma.email.findMany({
    where: { status: 'scheduled' },
    orderBy: { scheduledAt: 'asc' },
  });

  let recreatedJobs = 0;
  let alreadyQueued = 0;

  for (const email of pendingEmails) {
    const jobId = buildDeterministicJobId(email.id);
    const existingJob = await emailQueue.getJob(jobId);

    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'delayed' || state === 'waiting' || state === 'active' || state === 'prioritized') {
        alreadyQueued++;
        continue;
      }
      // Clean up stale completed/failed shell if DB still says scheduled
      await existingJob.remove();
    }

    await enqueueEmailJob(
      {
        emailId: email.id,
        userId: email.userId,
        senderId: email.senderId,
        hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        minDelayMs: env.MIN_DELAY_MS,
      },
      email.scheduledAt
    );

    if (email.bullmqJobId !== jobId) {
      await prisma.email.update({
        where: { id: email.id },
        data: { bullmqJobId: jobId },
      });
    }

    recreatedJobs++;
  }

  const summary: ReconciliationSummary = {
    checkedScheduled: pendingEmails.length,
    recreatedJobs,
    alreadyQueued,
    ambiguousProcessingResolved,
  };

  logger.info('Startup queue reconciliation complete', summary);
  return summary;
}