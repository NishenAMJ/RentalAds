import type { INestApplication } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageService } from '@nestjs/throttler';

/** Clears rate-limit counters so each test starts with a fresh allowance. */
export function resetThrottle(app: INestApplication): void {
  const storage = app.get<ThrottlerStorageService>(ThrottlerStorage);
  storage.onApplicationShutdown();
  storage.storage.clear();
}
