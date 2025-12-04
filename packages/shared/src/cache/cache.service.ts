// Redis Cache Service for caching and pub/sub

import { createClient, RedisClientType } from 'redis';
import { CACHE_TTL } from '../constants/index.js';

/**
 * Cache configuration
 */
export interface CacheConfig {
  url: string;
  password?: string;
  database?: number;
}

/**
 * Pub/Sub message handler type
 */
export type MessageHandler = (message: unknown, channel: string) => void;

/**
 * Cache namespaces for key organization
 */
export const CacheNamespaces = {
  AGENT_CONFIG: 'config:agent',
  MODEL_PRICING: 'config:model_pricing',
  SESSION: 'session:user',
  RATE_LIMIT: 'rate_limit',
  FEATURE_LOCK: 'feature:lock',
  WS_CONNECTIONS: 'ws:connections',
  FEATURE_CACHE: 'feature',
  REQUIREMENT_CACHE: 'requirement',
} as const;

/**
 * Pub/Sub channels
 */
export const PubSubChannels = {
  CONFIG_RELOAD: 'config:reload',
  FEATURE_UPDATE: 'feature:update',
  EXECUTION_PROGRESS: 'execution:progress',
  SYSTEM_EVENTS: 'system:events',
} as const;

/**
 * Redis Cache Service
 */
export class CacheService {
  private client: RedisClientType | null = null;
  private pubSubClient: RedisClientType | null = null;
  private subscriptions: Map<string, MessageHandler[]> = new Map();
  private config: CacheConfig;
  private connected = false;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Initialize cache service from environment variables
   */
  static fromEnv(): CacheService {
    const config: CacheConfig = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      database: process.env.REDIS_DATABASE ? parseInt(process.env.REDIS_DATABASE, 10) : undefined,
    };
    return new CacheService(config);
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.client = createClient({
      url: this.config.url,
      password: this.config.password,
      database: this.config.database,
    });

    this.pubSubClient = this.client.duplicate();

    this.client.on('error', (err: Error) => console.error('Redis Client Error:', err));
    this.pubSubClient.on('error', (err: Error) => console.error('Redis PubSub Error:', err));

    await this.client.connect();
    await this.pubSubClient.connect();

    this.connected = true;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // Unsubscribe from all channels
    for (const channel of this.subscriptions.keys()) {
      await this.pubSubClient?.unsubscribe(channel);
    }
    this.subscriptions.clear();

    await this.client?.disconnect();
    await this.pubSubClient?.disconnect();

    this.client = null;
    this.pubSubClient = null;
    this.connected = false;
  }

  /**
   * Get the Redis client
   */
  private getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  // ============================================================================
  // Basic Cache Operations
  // ============================================================================

  /**
   * Get value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const client = this.getClient();
    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    const client = this.getClient();
    const result = await client.del(key);
    return result > 0;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    const result = await client.exists(key);
    return result === 1;
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    const client = this.getClient();
    const values = await client.mGet(keys);
    return values.map((v: string | null) => (v ? (JSON.parse(v) as T) : null));
  }

  /**
   * Set multiple keys at once
   */
  async mset(entries: Array<{ key: string; value: unknown }>): Promise<void> {
    const client = this.getClient();
    const args: Record<string, string> = {};
    for (const { key, value } of entries) {
      args[key] = JSON.stringify(value);
    }
    await client.mSet(args);
  }

  /**
   * Get value or set if not exists
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) {
      return existing;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Set key with expiration
   */
  async setEx(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = this.getClient();
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  }

  /**
   * Get key TTL
   */
  async ttl(key: string): Promise<number> {
    const client = this.getClient();
    return client.ttl(key);
  }

  /**
   * Set key expiration
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const client = this.getClient();
    return client.expire(key, ttlSeconds);
  }

  /**
   * Increment a value
   */
  async incr(key: string): Promise<number> {
    const client = this.getClient();
    return client.incr(key);
  }

  /**
   * Increment by a value
   */
  async incrBy(key: string, increment: number): Promise<number> {
    const client = this.getClient();
    return client.incrBy(key, increment);
  }

  // ============================================================================
  // Distributed Locking
  // ============================================================================

  /**
   * Acquire a distributed lock
   */
  async acquireLock(lockKey: string, value: string, ttlSeconds: number = 300): Promise<boolean> {
    const client = this.getClient();
    const result = await client.set(lockKey, value, {
      NX: true,
      EX: ttlSeconds,
    });
    return result === 'OK';
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(lockKey: string, value: string): Promise<boolean> {
    const client = this.getClient();
    // Use Lua script to ensure atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await client.eval(script, {
      keys: [lockKey],
      arguments: [value],
    });
    return result === 1;
  }

  /**
   * Extend lock TTL
   */
  async extendLock(lockKey: string, value: string, ttlSeconds: number): Promise<boolean> {
    const client = this.getClient();
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await client.eval(script, {
      keys: [lockKey],
      arguments: [value, ttlSeconds.toString()],
    });
    return result === 1;
  }

  // ============================================================================
  // Pub/Sub
  // ============================================================================

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: unknown): Promise<number> {
    const client = this.getClient();
    return client.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    if (!this.pubSubClient) {
      throw new Error('Redis not connected. Call connect() first.');
    }

    // Track handlers
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);

      // Actually subscribe to Redis
      await this.pubSubClient.subscribe(channel, (message: string) => {
        const handlers = this.subscriptions.get(channel) || [];
        const parsed = JSON.parse(message);
        for (const h of handlers) {
          try {
            h(parsed, channel);
          } catch (err) {
            console.error(`Error in handler for channel ${channel}:`, err);
          }
        }
      });
    }

    this.subscriptions.get(channel)!.push(handler);
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    if (!this.pubSubClient) {
      return;
    }

    if (handler) {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
        if (handlers.length === 0) {
          this.subscriptions.delete(channel);
          await this.pubSubClient.unsubscribe(channel);
        }
      }
    } else {
      this.subscriptions.delete(channel);
      await this.pubSubClient.unsubscribe(channel);
    }
  }

  // ============================================================================
  // Namespace Helpers
  // ============================================================================

  /**
   * Get agent config cache key
   */
  agentConfigKey(agentId: string): string {
    return `${CacheNamespaces.AGENT_CONFIG}:${agentId}`;
  }

  /**
   * Get session cache key
   */
  sessionKey(userId: string): string {
    return `${CacheNamespaces.SESSION}:${userId}`;
  }

  /**
   * Get rate limit cache key
   */
  rateLimitKey(userId: string, resource: string): string {
    return `${CacheNamespaces.RATE_LIMIT}:${userId}:${resource}`;
  }

  /**
   * Get feature lock key
   */
  featureLockKey(featureId: string): string {
    return `${CacheNamespaces.FEATURE_LOCK}:${featureId}`;
  }

  /**
   * Get feature cache key
   */
  featureCacheKey(featureId: string): string {
    return `${CacheNamespaces.FEATURE_CACHE}:${featureId}`;
  }

  /**
   * Get requirement cache key
   */
  requirementCacheKey(requirementId: string): string {
    return `${CacheNamespaces.REQUIREMENT_CACHE}:${requirementId}`;
  }

  // ============================================================================
  // Agent Config Caching
  // ============================================================================

  /**
   * Cache agent configuration
   */
  async cacheAgentConfig(agentId: string, config: unknown): Promise<void> {
    await this.set(this.agentConfigKey(agentId), config, CACHE_TTL.CONFIG);
  }

  /**
   * Get cached agent configuration
   */
  async getAgentConfig<T = unknown>(agentId: string): Promise<T | null> {
    return this.get<T>(this.agentConfigKey(agentId));
  }

  /**
   * Invalidate agent configuration and notify subscribers
   */
  async invalidateAgentConfig(agentId: string): Promise<void> {
    await this.delete(this.agentConfigKey(agentId));
    await this.publish(PubSubChannels.CONFIG_RELOAD, {
      agentId,
      action: 'reload',
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  /**
   * Check and increment rate limit
   * Returns: { allowed: boolean, remaining: number, resetIn: number }
   */
  async checkRateLimit(
    userId: string,
    resource: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const key = this.rateLimitKey(userId, resource);
    const client = this.getClient();

    // Use Lua script for atomic operation
    const script = `
      local current = redis.call("incr", KEYS[1])
      if current == 1 then
        redis.call("expire", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("ttl", KEYS[1])
      return {current, ttl}
    `;

    const result = (await client.eval(script, {
      keys: [key],
      arguments: [windowSeconds.toString()],
    })) as [number, number];

    const current = result[0];
    const ttl = result[1];

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetIn: ttl,
    };
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check if Redis connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<Record<string, string>> {
    const client = this.getClient();
    const info = await client.info();
    const result: Record<string, string> = {};

    for (const line of info.split('\n')) {
      if (line.includes(':')) {
        const [key, ...rest] = line.split(':');
        if (key) {
          result[key.trim()] = rest.join(':').trim();
        }
      }
    }

    return result;
  }
}

/**
 * Create a cache service instance
 */
export function createCacheService(config?: CacheConfig): CacheService {
  if (config) {
    return new CacheService(config);
  }
  return CacheService.fromEnv();
}
