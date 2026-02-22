import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { JwtConfig } from './config/jwt.config';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';

async function bootstrap() {
  // Validate critical security configurations before starting
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔐 Validating security configuration...');
  }
  try {
    JwtConfig.validate();
  } catch (error) {
    console.error(
      '\n❌ FATAL: Security validation failed. Application cannot start.\n',
    );
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the first proxy (Railway, nginx, etc.) so request.ip resolves the real
  // client IP from X-Forwarded-For rather than the proxy's internal address.
  // Required for accurate Stripe customer_ip_address in production.
  app.set('trust proxy', 1);

  // Serve static files from uploads directory (disabled - using GCP for profile photos)
  // app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  //   prefix: '/uploads',
  // });

  // Enable global validation pipe for all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Automatically convert types (string to number, etc.)
      },
    }),
  );

  // Enable custom throttler exception filter for user-friendly rate limit messages
  app.useGlobalFilters(new ThrottlerExceptionFilter());

  // Enable cookie parsing
  app.use(cookieParser());

  // Enable CORS for frontend requests
  // Development: localhost:5173
  // Production: liffeyfoundersclub.com
  const isDevelopment =
    process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  const corsOrigins = isDevelopment
    ? [
        'http://localhost:5173', // Local dev
        'http://localhost:3000', // Local backend (self)
        'http://127.0.0.1:5173', // Loopback dev
        'http://127.0.0.1:3000', // Loopback backend
        'http://frontend:5173', // Docker Compose
      ]
    : ['https://liffeyfoundersclub.com', 'https://www.liffeyfoundersclub.com'];

  // Add dynamic origin from environment variable if set
  if (process.env.FRONTEND_URL) {
    corsOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 3600,
  });

  if (isDevelopment) {
    console.log(`🌍 CORS enabled in DEVELOPMENT mode`);
    console.log(`📡 Allowed origins: ${corsOrigins.join(', ')}`);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  if (isDevelopment) {
    console.log(`🚀 Backend server is running on port ${port}`);
  }
}
bootstrap();
