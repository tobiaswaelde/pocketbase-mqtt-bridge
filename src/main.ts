import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { ENV } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: ENV.CORS_ORIGIN });
  app.enableShutdownHooks();
  await app.listen(ENV.PORT, ENV.HOST);
}

void bootstrap();
