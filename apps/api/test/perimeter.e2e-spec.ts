import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { RadiusThrottleGuard } from '../src/common/guards/radius-throttle.guard';
import { SearchListingsQuery } from '../src/common/search-area.dto';

@Controller('listings')
class SearchController {
  @Get()
  @UseGuards(RadiusThrottleGuard)
  browse(@Query() query: SearchListingsQuery) {
    return query;
  }
}
describe('radius HTTP validation and real throttling', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }])],
      controllers: [SearchController],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('requires finite complete coordinates and a radius in range', async () => {
    for (const query of [
      'searchLatitude=6',
      'searchLatitude=6&searchLongitude=80&searchRadiusKm=0',
      'searchLatitude=NaN&searchLongitude=80&searchRadiusKm=3',
      'searchLatitude=91&searchLongitude=80&searchRadiusKm=3',
      'searchLatitude=&searchLongitude=80&searchRadiusKm=3',
    ]) {
      await request(app.getHttpServer()).get(`/listings?${query}`).expect(400);
    }
    await request(app.getHttpServer())
      .get('/listings?searchLatitude=6.9&searchLongitude=79.8&searchRadiusKm=3')
      .expect(200);
  });
  it('counts invalid radius attempts, ignores forged forwarding headers, and exempts ordinary browsing', async () => {
    for (let i = 0; i < 20; i++)
      await request(app.getHttpServer())
        .get('/listings?searchLatitude=6')
        .set('X-Forwarded-For', `10.0.0.${i}`)
        .expect(400);
    await request(app.getHttpServer())
      .get('/listings?searchLatitude=7')
      .expect(429);
    for (let i = 0; i < 22; i++)
      await request(app.getHttpServer()).get('/listings').expect(200);
  });
});
