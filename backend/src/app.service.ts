import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@Injectable()
export class AppService {
  private redisClient: Redis | null = null;

  constructor(@InjectDataSource() private dataSource: DataSource) {
    // Initialize Redis client if REDIS_URL is set
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redisClient = new Redis(redisUrl);
    }
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    // Check database connection
    try {
      await this.dataSource.query('SELECT 1');
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.databaseError = error.message;
      health.status = 'error';
    }

    // Check Redis connection
    if (this.redisClient) {
      try {
        await this.redisClient.ping();
        health.redis = 'connected';
      } catch (error) {
        health.redis = 'disconnected';
        health.redisError = error.message;
        health.status = 'degraded';
      }
    } else {
      health.redis = 'not_configured';
    }

    return health;
  }
}
