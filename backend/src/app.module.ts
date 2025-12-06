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
import { throttlerConfig } from './config/throttler.config';
import { GcpStorageService } from './common/gcp-storage.service';

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

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot(),
    // Rate limiting configuration
    ThrottlerModule.forRoot(throttlerConfig),
    // Schedule module for cron jobs
    ScheduleModule.forRoot(),
    // Use DATABASE_URL if present; otherwise fall back to individual DB_* env vars
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.host || process.env.POSTGRES_HOST || 'localhost';
      })(),
      port: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.port || Number(process.env.POSTGRES_PORT || 5432);
      })(),
      username: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.username || process.env.POSTGRES_USER;
      })(),
      password: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.password || process.env.POSTGRES_PASSWORD;
      })(),
      database: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.database || process.env.POSTGRES_DB;
      })(),
      entities: [__dirname + '/**/*.entity.{ts,js}'],
      // Prefer explicit TYPEORM_SYNCHRONIZE env var; otherwise enable synchronize for non-production
      synchronize: process.env.TYPEORM_SYNCHRONIZE ? process.env.TYPEORM_SYNCHRONIZE === 'true' : process.env.NODE_ENV !== 'production',
      logging: false,
    }),
    ContactModule,
    Web3Module,
    UsersModule,
    AuthModule,
    CompaniesModule,
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
