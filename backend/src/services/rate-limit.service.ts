import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Atomic Lua script for UTC hourly rate limiting per sender.
 * KEYS[1]: rate limit counter key e.g. "ratelimit:hourly:<senderId>:2026-11-20T01"
 * ARGV[1]: max hourly limit (integer)
 * ARGV[2]: key TTL in seconds (e.g. 7200)
 * Returns: { allowed (1 or 0), currentCount }
 */
const HOURLY_RATE_LIMIT_LUA = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local limit = tonumber(ARGV[1])
if current >= limit then
  return {0, current}
end
local nextVal = redis.call("INCR", KEYS[1])
if nextVal == 1 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
end
return {1, nextVal}
`;

/**
 * Atomic Lua script to reserve a per-sender minimum delay slot across parallel workers.
 * KEYS[1]: "ratelimit:min_delay:<senderId>"
 * ARGV[1]: current timestamp in ms
 * ARGV[2]: minDelayMs
 * Returns: waitMs (how many ms this worker must wait before sending)
 */
const MIN_DELAY_SLOT_LUA = `
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
local nextAvailable = tonumber(redis.call("GET", KEYS[1]) or "0")
local scheduledSlot = now
if nextAvailable > now then
  scheduledSlot = nextAvailable
end
redis.call("SET", KEYS[1], tostring(scheduledSlot + minDelay), "PX", math.max(minDelay * 10, 60000))
return scheduledSlot - now
`;

export function getUtcHourWindow(date = new Date()): string {
  return date.toISOString().slice(0, 13); // e.g. "2026-11-20T01"
}

export function getNextUtcHourTimestamp(now = new Date()): number {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next.getTime();
}

export interface HourlyCapacityResult {
  allowed: boolean;
  currentCount: number;
  hourWindow: string;
  nextEligibleTimestamp: number;
}

export async function tryReserveHourlyCapacity(
  senderId: string,
  hourlyLimit: number,
  now = new Date()
): Promise<HourlyCapacityResult> {
  const hourWindow = getUtcHourWindow(now);
  const key = `ratelimit:hourly:${senderId}:${hourWindow}`;

  const result = (await redis.eval(
    HOURLY_RATE_LIMIT_LUA,
    1,
    key,
    String(hourlyLimit),
    '7200'
  )) as [number, number];

  const allowed = Number(result[0]) === 1;
  const currentCount = Number(result[1]);
  const nextEligibleTimestamp = getNextUtcHourTimestamp(now);

  return {
    allowed,
    currentCount,
    hourWindow,
    nextEligibleTimestamp,
  };
}

export async function releaseHourlyCapacity(senderId: string, hourWindow: string): Promise<void> {
  const key = `ratelimit:hourly:${senderId}:${hourWindow}`;
  const val = await redis.decr(key);
  if (val < 0) {
    await redis.set(key, '0', 'EX', 7200);
  }
}

export async function reserveMinDelaySlot(
  senderId: string,
  minDelayMs: number
): Promise<number> {
  if (minDelayMs <= 0) return 0;
  const key = `ratelimit:min_delay:${senderId}`;
  const waitMs = (await redis.eval(
    MIN_DELAY_SLOT_LUA,
    1,
    key,
    String(Date.now()),
    String(minDelayMs)
  )) as number;
  return Math.max(0, Number(waitMs));
}

export async function recordRateLimitEventOnce(params: {
  senderId: string;
  userId: string;
  hourWindow: string;
  limit: number;
}): Promise<boolean> {
  try {
    await prisma.rateLimitEvent.create({
      data: {
        senderId: params.senderId,
        userId: params.userId,
        hourWindow: params.hourWindow,
        limit: params.limit,
        notificationStatus: 'pending',
      },
    });
    return true; // Newly created for this sender + UTC hour window
  } catch (err: unknown) {
    // P2002 = Prisma unique constraint violation on (senderId, hourWindow)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      logger.debug(
        `Duplicate rate limit alert suppressed for sender ${params.senderId} in window ${params.hourWindow}`
      );
      return false;
    }
    throw err;
  }
}