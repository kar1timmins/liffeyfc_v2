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

  async checkMigrations() {
    try {
      const migrations = await this.dataSource.query(
        'SELECT * FROM migrations ORDER BY timestamp DESC',
      );
      return {
        success: true,
        count: migrations.length,
        migrations,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        hint: 'Migrations table may not exist yet',
      };
    }
  }

  async getTables() {
    try {
      const tables = await this.dataSource.query(`
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const tableDetails = await Promise.all(
        tables.map(async (table: any) => {
          const rowCount = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM "${table.table_name}"`,
          );
          return {
            name: table.table_name,
            columns: parseInt(table.column_count),
            rows: parseInt(rowCount[0].count),
          };
        }),
      );

      return {
        success: true,
        count: tables.length,
        tables: tableDetails,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async runMigrations() {
    try {
      const pendingMigrations = await this.dataSource.showMigrations();
      
      if (!pendingMigrations) {
        return {
          success: true,
          message: 'No pending migrations',
          alreadyRan: true,
        };
      }

      await this.dataSource.runMigrations();
      
      const ranMigrations = await this.dataSource.query(
        'SELECT * FROM migrations ORDER BY timestamp DESC',
      );

      return {
        success: true,
        message: 'Migrations completed successfully',
        count: ranMigrations.length,
        migrations: ranMigrations,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }
}
