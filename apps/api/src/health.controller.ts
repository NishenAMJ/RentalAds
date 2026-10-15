import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './common/prisma.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Does not touch dependencies. */
  @Get()
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness: the database answers. Use this for load balancer and uptime checks. */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (cause) {
      this.logger.error(`Database check failed: ${String(cause)}`);
      // Details stay in the logs; callers only learn that the service is not ready.
      throw new ServiceUnavailableException('Service is not ready');
    }
  }
}
