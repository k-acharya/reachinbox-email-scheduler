import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { decryptSecret, encryptSecret } from '../utils/encryption';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export function buildSlackAuthUrl(): { url: string; state: string } {
  const state = crypto.randomBytes(24).toString('hex');
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'chat:write',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });

  return {
    url: `https://slack.com/oauth/v2/authorize?${params.toString()}`,
    state,
  };
}

export async function exchangeSlackCodeAndSave(userId: string, code: string) {
  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const data = response.data;
  if (!data.ok || !data.access_token) {
    throw new AppError(`Slack OAuth failed: ${data.error || 'Unknown Slack error'}`, 400);
  }

  const workspaceId: string = data.team?.id || 'unknown-workspace';
  const teamName: string = data.team?.name || 'Slack Workspace';
  const slackUserId: string | null = data.authed_user?.id || null;

  return prisma.slackIntegration.upsert({
    where: { userId },
    update: {
      workspaceId,
      teamName,
      slackUserId,
      encryptedAccessToken: encryptSecret(data.access_token),
      isConnected: true,
      connectedAt: new Date(),
    },
    create: {
      userId,
      workspaceId,
      teamName,
      slackUserId,
      encryptedAccessToken: encryptSecret(data.access_token),
      isConnected: true,
    },
  });
}

export async function getSlackConnectionStatus(userId: string) {
  const integration = await prisma.slackIntegration.findUnique({
    where: { userId },
    select: {
      id: true,
      workspaceId: true,
      teamName: true,
      isConnected: true,
      connectedAt: true,
    },
  });

  if (!integration || !integration.isConnected) {
    return { isConnected: false };
  }

  return integration;
}

export async function disconnectSlack(userId: string) {
  const existing = await prisma.slackIntegration.findUnique({
    where: { userId },
  });

  if (!existing) {
    return;
  }

  await prisma.slackIntegration.update({
    where: { userId },
    data: {
      isConnected: false,
    },
  });
}

export async function notifySlackRateLimit(params: {
  userId: string;
  senderId: string;
  senderEmail: string;
  hourWindow: string;
  limit: number;
  nextEligibleAt: Date;
}): Promise<void> {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: params.userId },
    });

    if (!integration || !integration.isConnected) {
      logger.info(
        `Slack not connected for user ${params.userId}; rate-limit event recorded without Slack message`
      );
      await prisma.rateLimitEvent.updateMany({
        where: { senderId: params.senderId, hourWindow: params.hourWindow },
        data: { notificationStatus: 'skipped_disconnected' },
      });
      return;
    }

    const token = decryptSecret(integration.encryptedAccessToken);
    const channelTarget = integration.slackUserId || '#general';

    const messageText =
      `⚠️ *ReachInbox Hourly Sending Limit Reached*\n` +
      `• *Sender:* ${params.senderEmail}\n` +
      `• *UTC Hour Window:* ${params.hourWindow}:00 UTC\n` +
      `• *Configured Limit:* ${params.limit} emails/hour\n` +
      `• *Action Taken:* Remaining emails have been automatically rescheduled to *${params.nextEligibleAt.toISOString()}*.`;

    const slackRes = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: channelTarget,
        text: messageText,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!slackRes.data?.ok) {
      throw new Error(slackRes.data?.error || 'Slack chat.postMessage returned ok=false');
    }

    await prisma.rateLimitEvent.updateMany({
      where: { senderId: params.senderId, hourWindow: params.hourWindow },
      data: { notificationStatus: 'sent' },
    });

    logger.info(`Slack rate-limit alert delivered to ${integration.teamName} (${channelTarget})`);
  } catch (err) {
    logger.error('Failed to deliver Slack rate-limit notification', err);
    await prisma.rateLimitEvent.updateMany({
      where: { senderId: params.senderId, hourWindow: params.hourWindow },
      data: { notificationStatus: 'failed' },
    });
  }
}