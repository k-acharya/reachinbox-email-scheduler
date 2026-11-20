import crypto from 'crypto';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { buildDeterministicJobId, enqueueEmailJob, removeEmailJob } from '../../queue/email.queue';
import { indexEmailDocument } from '../../services/elasticsearch.service';
import { ScheduleEmailsInput } from './email.schema';

export async function scheduleEmailBatch(userId: string, input: ScheduleEmailsInput) {
  const sender = await prisma.sender.findFirst({
    where: {
      id: input.senderId,
      userId,
      isActive: true,
    },
  });

  if (!sender) {
    throw new AppError('Selected sender not found or inactive', 404);
  }

  const uniqueRecipients = Array.from(
    new Set(input.recipients.map((r) => r.trim().toLowerCase()))
  );

  const baseStartTime = Math.max(Date.now(), new Date(input.startTime).getTime());

  const existingBatch = await prisma.email.findMany({
    where: {
      userId,
      idempotencyKey: {
        startsWith: `${input.idempotencyKey}:`,
      },
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  if (existingBatch.length > 0) {
    return {
      duplicate: true,
      count: existingBatch.length,
      emails: existingBatch,
    };
  }

  const createdEmails = [];

  for (let i = 0; i < uniqueRecipients.length; i++) {
    const recipient = uniqueRecipients[i];
    const scheduledAt = new Date(baseStartTime + i * input.delayMs);
    const emailId = crypto.randomUUID();
    const jobId = buildDeterministicJobId(emailId);
    const perEmailIdempotencyKey = `${input.idempotencyKey}:${i}:${recipient}`;

    const record = await prisma.email.create({
      data: {
        id: emailId,
        userId,
        senderId: sender.id,
        recipient,
        subject: input.subject,
        body: input.body,
        scheduledAt,
        status: 'scheduled',
        bullmqJobId: jobId,
        idempotencyKey: perEmailIdempotencyKey,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    await enqueueEmailJob(
      {
        emailId: record.id,
        userId,
        senderId: sender.id,
        hourlyLimit: input.hourlyLimit,
        minDelayMs: input.delayMs,
      },
      scheduledAt
    );

    await indexEmailDocument(record);
    createdEmails.push(record);
  }

  return {
    duplicate: false,
    count: createdEmails.length,
    emails: createdEmails,
  };
}

export async function getScheduledEmails(userId: string) {
  return prisma.email.findMany({
    where: {
      userId,
      status: { in: ['scheduled', 'processing'] },
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });
}

export async function getSentEmails(userId: string) {
  return prisma.email.findMany({
    where: {
      userId,
      status: { in: ['sent', 'failed'] },
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ sentAt: 'desc' }, { updatedAt: 'desc' }],
  });
}

export async function getEmailById(userId: string, emailId: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, userId },
    include: {
      sender: { select: { id: true, name: true, email: true } },
    },
  });

  if (!email) {
    throw new AppError('Email record not found', 404);
  }

  return email;
}

export async function cancelScheduledEmail(userId: string, emailId: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, userId },
  });

  if (!email) {
    throw new AppError('Email record not found', 404);
  }

  if (email.status !== 'scheduled') {
    throw new AppError(`Cannot cancel email in '${email.status}' state`, 400);
  }

  await removeEmailJob(email.id);

  const updated = await prisma.email.update({
    where: { id: email.id },
    data: {
      status: 'failed',
      lastError: 'Cancelled by user before delivery',
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
    },
  });

  await indexEmailDocument(updated);
  return updated;
}