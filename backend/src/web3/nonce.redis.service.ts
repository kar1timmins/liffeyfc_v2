import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisNonceService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisNonceService.name);

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.client = new Redis(url);
    }
  }

  private key(address: string) {
    return `nonce:${address.toLowerCase()}`;
  }

  async onModuleInit() {
    if (!this.client) return;
    try {
      await this.client.ping();
      this.logger.log('Connected to Redis for nonce storage');
    } catch (err) {
      this.logger.warn(
        'Failed to connect to Redis for nonce storage',
        String(err),
      );
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch (err) {
      // ignore
    }
  }

  async create(address: string, message: string, ttlMs = 5 * 60 * 1000) {
    if (!this.client) return;
    const k = this.key(address);
    await this.client.set(k, message, 'PX', ttlMs);
  }

  async get(address: string) {
    if (!this.client) return null;
    const k = this.key(address);
    const v = await this.client.get(k);
    if (!v) return null;
    return { message: v, expiresAt: null } as any;
  }

  // Atomically get-and-delete the nonce to prevent replay across instances
  async consume(address: string) {
    if (!this.client) return null;
    const k = this.key(address);
    const lua = `local v = redis.call('GET', KEYS[1]) if v then redis.call('DEL', KEYS[1]) return v end return nil`;
    const res = await this.client.eval(lua, 1, k);
    if (!res) return null;
    return { message: String(res) } as any;
  }

  // Backwards-compat: preserve 'use' which deletes the key
  async use(address: string) {
    if (!this.client) return;
    const k = this.key(address);
    await this.client.del(k);
  }
}
