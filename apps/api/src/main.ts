import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { JsonLogger } from './common/json-logger';

async function bootstrap() {
  // Structured logs in production; Nest's readable console output while developing.
  const app = await NestFactory.create(AppModule, {
    ...(process.env.NODE_ENV === 'production'
      ? { logger: new JsonLogger() }
      : {}),
  });
  configureApp(app);
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
