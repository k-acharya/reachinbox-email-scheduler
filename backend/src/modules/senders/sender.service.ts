import { prisma } from '../../config/database';
import { encryptSecret } from '../../utils/encryption';
import { AppError } from '../../middleware/error.middleware';
import { CreateSenderInput, UpdateSenderInput } from './sender.schema';

const safeSenderSelect = {
  id: true,
  userId: true,
  name: true,
  email: true,
  smtpHost: true,
  smtpPort: true,
  smtpUsername: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createSender(userId: string, input: CreateSenderInput) {
  const existing = await prisma.sender.findUnique({
    where: {
      userId_email: {
        userId,
        email: input.email.toLowerCase(),
      },
    },
  });

  if (existing) {
    throw new AppError('A sender with this email address already exists for your account', 409);
  }

  return prisma.sender.create({
    data: {
      userId,
      name: input.name,
      email: input.email.toLowerCase(),
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpUsername: input.smtpUsername,
      encryptedSmtpPassword: encryptSecret(input.smtpPassword),
      isActive: input.isActive,
    },
    select: safeSenderSelect,
  });
}

export async function listSenders(userId: string) {
  return prisma.sender.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: safeSenderSelect,
  });
}

export async function updateSender(userId: string, senderId: string, input: UpdateSenderInput) {
  const existing = await prisma.sender.findFirst({
    where: { id: senderId, userId },
  });

  if (!existing) {
    throw new AppError('Sender not found', 404);
  }

  return prisma.sender.update({
    where: { id: senderId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email.toLowerCase() }),
      ...(input.smtpHost !== undefined && { smtpHost: input.smtpHost }),
      ...(input.smtpPort !== undefined && { smtpPort: input.smtpPort }),
      ...(input.smtpUsername !== undefined && { smtpUsername: input.smtpUsername }),
      ...(input.smtpPassword !== undefined && {
        encryptedSmtpPassword: encryptSecret(input.smtpPassword),
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: safeSenderSelect,
  });
}

export async function deleteSender(userId: string, senderId: string) {
  const existing = await prisma.sender.findFirst({
    where: { id: senderId, userId },
  });

  if (!existing) {
    throw new AppError('Sender not found', 404);
  }

  await prisma.sender.delete({
    where: { id: senderId },
  });
}