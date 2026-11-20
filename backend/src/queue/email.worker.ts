import { Worker, Job, DelayedError } from 'bullmq';
import { bullmqConnection } from './queue.connection';
import { EMAIL_QUEUE_NAME, EmailJobData } from './email.queue';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { sendViaSenderSmtp } from '../services/smtp.service';
import {
  recordRateLimitEventOnce,
  releaseHourlyCapacity,
  reserveMinDelaySlot,
  tryReserveHourlyCapacity,
} from '../services/rate-limit.service';
import { notifySlackRateLimit } from '../services/slack.service';
import { indexEmailDocument } from '../services/elasticsearch.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPermanentSmtpError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'responseCode' in err) {
    const code = Number((err as { responseCode?: number }).responseCode);
    // 5xx SMTP responses (e.g., 550 mailbox unavailable, 535 auth failed) are permanent
    if (code >= 500 && code < 600) {
      return true;
    }
  }
  return false;
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, userId, senderId, hourlyLimit, minDelayMs } = job.data;

  // 1. Fetch email record from PostgreSQL (source of truth)
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true },
  });

  if (!email) {
    logger.warn(`Email ${emailId} not found in DB; skipping job ${job.id}`);
    return;
  }

  // 2. Idempotency / duplicate-send guard
  if (email.status === 'sent') {
    logger.info(`Email ${emailId} already marked sent; skipping duplicate delivery`);
    return;
  }

  if (email.status === 'failed' && email.lastError?.includes('Cancelled')) {
    logger.info(`Email ${emailId} was cancelled; skipping`);
    return;
  }

  // 3. Verify sender exists and is active
  if (!email.sender || !email.sender.isActive) {
    const failedRecord = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'failed',
        lastError: 'Sender account is missing or inactive',
      },
    });
    await indexEmailDocument(failedRecord);
    return;
  }

  // 4. Atomic UTC hourly rate limit check & capacity reservation
  const effectiveHourlyLimit = hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const capacity = await tryReserveHourlyCapacity(senderId, effectiveHourlyLimit);

  if (!capacity.allowed) {
    // Preserve ordering with a small deterministic jitter based on job creation
    const jitterMs = Math.floor(Math.random() * 1500);
    const nextRunTimestamp = capacity.nextEligibleTimestamp + jitterMs;
    const nextRunDate = new Date(nextRunTimestamp);

    logger.warn(
      `Hourly limit (${effectiveHourlyLimit}/hr) reached for sender ${email.sender.email} in window ${capacity.hourWindow}. Rescheduling email ${emailId} to ${nextRunDate.toISOString()}`
    );

    await prisma.email.update({
      where: { id: emailId },
      data: {
        scheduledAt: nextRunDate,
        status: 'scheduled',
      },
    });

    // Deduplicated Slack notification (at most once per sender per UTC hour)
    const shouldNotify = await recordRateLimitEventOnce({
      senderId,
      userId,
      hourWindow: capacity.hourWindow,
      limit: effectiveHourlyLimit,
    });

    if (shouldNotify) {
      await notifySlackRateLimit({
        userId,
        senderId,
        senderEmail: email.sender.email,
        hourWindow: capacity.hourWindow,
        limit: effectiveHourlyLimit,
        nextEligibleAt: nextRunDate,
      });
    }

    // Move job back to BullMQ delayed state without failing or dropping it
    await job.moveToDelayed(nextRunTimestamp, job.token);
    throw new DelayedError();
  }

  // 5. Enforce per-sender minimum delay across concurrent workers via Redis Lua
  const effectiveMinDelay = minDelayMs ?? env.MIN_DELAY_MS;
  const waitMs = await reserveMinDelaySlot(senderId, effectiveMinDelay);
  if (waitMs > 0) {
    logger.debug(`Throttling sender ${email.sender.email} for ${waitMs}ms to respect MIN_DELAY_MS`);
    await sleep(waitMs);
  }

  // 6. Mark email as 'processing' and increment attempts BEFORE SMTP transmission
  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
    },
  });

  // 7. Transmit email via Ethereal SMTP
  try {
    const result = await sendViaSenderSmtp(email.sender, {
      to: email.recipient,
      subject: email.subject,
      text: email.body,
    });

    const sentRecord = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        previewUrl: result.previewUrl,
        lastError: null,
      },
    });

    logger.info(
      `Email ${emailId} sent to ${email.recipient} via ${email.sender.email}` +
        (result.previewUrl ? ` | Preview: ${result.previewUrl}` : '')
    );

    // 8. Index into Elasticsearch (non-blocking for SMTP success)
    await indexEmailDocument(sentRecord);
  } catch (err: unknown) {
    // Release the reserved hourly slot since delivery did not succeed
    await releaseHourlyCapacity(senderId, capacity.hourWindow);

    const errorMessage = err instanceof Error ? err.message : 'Unknown SMTP delivery error';
    const permanent = isPermanentSmtpError(err);
    const maxAttempts = job.opts.attempts ?? 3;
    const isFinalAttempt = permanent || job.attemptsMade + 1 >= maxAttempts;

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: isFinalAttempt ? 'failed' : 'scheduled',
        lastError: errorMessage,
      },
    });

    await indexEmailDocument(updated);

    if (permanent) {
      logger.error(`Permanent SMTP failure for email ${emailId}: ${errorMessage}`);
      return; // Do not retry 5xx permanent errors
    }

    logger.warn(`Temporary SMTP error for email ${emailId}, will retry: ${errorMessage}`);
    throw err; // Triggers BullMQ exponential backoff retry
  }
}

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: bullmqConnection,
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    logger.debug(`BullMQ job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    if (err instanceof DelayedError) return;
    logger.error(`BullMQ job ${job?.id} failed`, err);
  });

  worker.on('error', (err) => {
    logger.error('BullMQ worker error', err);
  });

  logger.info(
    `BullMQ Email Worker started (concurrency=${env.WORKER_CONCURRENCY}, minDelayMs=${env.MIN_DELAY_MS}, hourlyLimit=${env.MAX_EMAILS_PER_HOUR_PER_SENDER})`
  );

  return worker;
}