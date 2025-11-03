import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
