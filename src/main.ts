import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173']
  app.enableCors({ origin: allowedOrigins, credentials: true })
  app.useWebSocketAdapter(new IoAdapter(app))
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
