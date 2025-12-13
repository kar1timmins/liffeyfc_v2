import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ContactModule } from './contact/contact.module';
import { Web3Module } from './web3/web3.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { PaymentsModule } from './payments/payments.module';
import { throttlerConfig } from './config/throttler.config';
import { GcpStorageService } from './common/gcp-storage.service';
import * as entities from './entities';

/**
 * Parse DATABASE_URL if present (format: postgres://user:password@host:port/database)
 * Used when DATABASE_URL is set; otherwise falls back to individual DB_* env vars.
 */
function parseDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  try {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      username: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
    };
  } catch (err) {
    console.error('Invalid DATABASE_URL format:', err.message);
    return null;
  }
}

/**
 * Validate database configuration
 * Ensures that either DATABASE_URL or individual POSTGRES_* env vars are set
 */
function validateDatabaseConfig() {
  const dbFromUrl = parseDatabaseUrl();
  const hasDbUrl = process.env.DATABASE_URL;
  const hasIndividualVars = process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DB;

  if (!hasDbUrl && !hasIndividualVars) {
    console.error(`
    ❌ Database configuration missing!
    
    Please set either:
    1. DATABASE_URL=postgres://user:password@host:port/database
    OR
    2. Individual variables:
       - POSTGRES_HOST (default: localhost)
       - POSTGRES_PORT (default: 5432)
       - POSTGRES_USER (required)
       - POSTGRES_PASSWORD (required)
       - POSTGRES_DB (required)
    
    See .env.example for more details.
    `);
    process.exit(1);
  }

  const host = dbFromUrl?.host || process.env.POSTGRES_HOST || 'localhost';
  const port = dbFromUrl?.port || Number(process.env.POSTGRES_PORT || 5432);
  const user = dbFromUrl?.username || process.env.POSTGRES_USER;
  const pass = dbFromUrl?.password || process.env.POSTGRES_PASSWORD;
  const db = dbFromUrl?.database || process.env.POSTGRES_DB;

  if (!user || !pass || !db) {
    console.error(`
    ❌ Database credentials incomplete!
    
    Current configuration:
    - Host: ${host}
    - Port: ${port}
    - User: ${user ? '✓ set' : '✗ MISSING'}
    - Password: ${pass ? '✓ set' : '✗ MISSING'}
    - Database: ${db ? '✓ set' : '✗ MISSING'}
    
    Please check your .env file.
    `);
    process.exit(1);
  }

  return { host, port, username: user, password: pass, database: db };
}

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot(),
    // Rate limiting configuration
    ThrottlerModule.forRoot(throttlerConfig),
    // Schedule module for cron jobs
    ScheduleModule.forRoot(),
    // Database configuration with validation
    TypeOrmModule.forRoot((() => {
      const dbConfig = validateDatabaseConfig();
      return {
        type: 'postgres',
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        entities: Object.values(entities),
        // Prefer explicit TYPEORM_SYNCHRONIZE env var; otherwise enable synchronize for non-production
        synchronize: process.env.TYPEORM_SYNCHRONIZE ? process.env.TYPEORM_SYNCHRONIZE === 'true' : process.env.NODE_ENV !== 'production',
        logging: false,
      };
    })()),
    ContactModule,
    Web3Module,
    UsersModule,
    AuthModule,
    CompaniesModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    GcpStorageService,
    // Enable throttler guard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [GcpStorageService],
})
export class AppModule {}
