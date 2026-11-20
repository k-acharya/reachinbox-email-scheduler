import { Client } from '@elastic/elasticsearch';
import { env } from './env';
import { logger } from '../utils/logger';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
});

export const EMAILS_INDEX = 'emails';

export async function checkElasticsearchHealth(): Promise<boolean> {
  try {
    await esClient.ping();
    return true;
  } catch (error) {
    logger.warn('Elasticsearch ping failed', error);
    return false;
  }
}