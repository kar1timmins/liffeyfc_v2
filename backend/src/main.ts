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
  console.log('🔐 Validating security configuration...');
  try {
    JwtConfig.validate();
  } catch (error) {
    console.error('\n❌ FATAL: Security validation failed. Application cannot start.\n');
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
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
  const allowedOrigins = [
    'http://localhost:5173', 
    'http://frontend:5173',
    'https://liffeyfoundersclub.com',
    'https://www.liffeyfoundersclub.com',
  ];

  // Add dynamic origin from environment variable if set
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Backend server is running on port ${port}`);
  console.log(`📡 CORS enabled for: ${allowedOrigins.join(', ')}`);
}
bootstrap();
