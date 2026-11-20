import { Email, EmailStatus } from '@prisma/client';
import { esClient, EMAILS_INDEX } from '../config/elasticsearch';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export async function ensureEmailsIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            emailId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
      logger.info(`Created Elasticsearch index "${EMAILS_INDEX}"`);
    }
  } catch (err) {
    logger.warn('Could not verify/create Elasticsearch index on startup', err);
  }
}

export async function indexEmailDocument(email: Email): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      refresh: true,
      document: {
        emailId: email.id,
        userId: email.userId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
      },
    });
  } catch (err) {
    // Never fail email scheduling or SMTP delivery if Elasticsearch is unavailable
    logger.warn(`Elasticsearch indexing failed for email ${email.id} (will reconcile later)`, err);
  }
}

export async function reconcileElasticsearchIndex(): Promise<void> {
  try {
    await ensureEmailsIndex();
    const recentEmails = await prisma.email.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    for (const email of recentEmails) {
      await indexEmailDocument(email);
    }
    logger.info(`Elasticsearch reconciliation synced ${recentEmails.length} email records`);
  } catch (err) {
    logger.warn('Elasticsearch reconciliation skipped due to connection error', err);
  }
}

export async function searchUserEmails(params: {
  userId: string;
  query?: string;
  status?: EmailStatus;
}) {
  const mustClauses: Record<string, unknown>[] = [{ term: { userId: params.userId } }];

  if (params.status) {
    mustClauses.push({ term: { status: params.status } });
  }

  if (params.query && params.query.trim().length > 0) {
    mustClauses.push({
      multi_match: {
        query: params.query.trim(),
        fields: ['recipient^3', 'subject^2', 'body'],
        fuzziness: 'AUTO',
      },
    });
  }

  try {
    const result = await esClient.search({
      index: EMAILS_INDEX,
      size: 100,
      sort: [{ scheduledAt: { order: 'desc' } }],
      query: {
        bool: {
          must: mustClauses,
        },
      },
    });

    const ids = result.hits.hits
      .map((hit) => hit._id)
      .filter((id): id is string => typeof id === 'string');

    if (ids.length === 0) return [];

    // Hydrate full records from PostgreSQL (source of truth) preserving ES rank order
    const dbEmails = await prisma.email.findMany({
      where: {
        id: { in: ids },
        userId: params.userId,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    const map = new Map(dbEmails.map((e) => [e.id, e]));
    return ids.map((id) => map.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  } catch (err) {
    logger.warn('Elasticsearch search failed, falling back to PostgreSQL query', err);
    return prisma.email.findMany({
      where: {
        userId: params.userId,
        ...(params.status && { status: params.status }),
        ...(params.query && {
          OR: [
            { recipient: { contains: params.query, mode: 'insensitive' } },
            { subject: { contains: params.query, mode: 'insensitive' } },
            { body: { contains: params.query, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });
  }
}