import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { JwtConfig } from './config/jwt.config';

async function bootstrap() {
  // Validate critical security configurations before starting
  console.log('🔐 Validating security configuration...');
  try {
    JwtConfig.validate();
  } catch (error) {
    console.error('\n❌ FATAL: Security validation failed. Application cannot start.\n');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  
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
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Backend server is running on port ${port}`);
  console.log(`📡 CORS enabled for: ${allowedOrigins.join(', ')}`);
}
bootstrap();
