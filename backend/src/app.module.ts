import { Module } from '@nestjs/common';
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
import { InvestorsModule } from './investors/investors.module';
import { StaffModule } from './staff/staff.module';
import { throttlerConfig } from './config/throttler.config';

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
    // Rate limiting configuration
    ThrottlerModule.forRoot(throttlerConfig),
    // Schedule module for cron jobs
    ScheduleModule.forRoot(),
    // Use DATABASE_URL if present; otherwise fall back to individual DB_* env vars
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.host || process.env.DB_HOST || 'localhost';
      })(),
      port: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.port || Number(process.env.DB_PORT || 5432);
      })(),
      username: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.username || process.env.DB_USERNAME;
      })(),
      password: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.password || process.env.DB_PASSWORD;
      })(),
      database: (() => {
        const dbFromUrl = parseDatabaseUrl();
        return dbFromUrl?.database || process.env.DB_DATABASE;
      })(),
      entities: [__dirname + '/**/*.entity.{ts,js}'],
      // Prefer explicit TYPEORM_SYNCHRONIZE env var; otherwise enable synchronize for non-production
      synchronize: process.env.TYPEORM_SYNCHRONIZE ? process.env.TYPEORM_SYNCHRONIZE === 'true' : process.env.NODE_ENV !== 'production',
      logging: false,
    }),
    ContactModule,
    Web3Module,
    UsersModule,
    InvestorsModule,
    StaffModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Enable throttler guard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
