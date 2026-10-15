// Counts only, plus a query plan against synthetic temporary rows. No user data printed.
const { ConfigModule } = require('@nestjs/config');
const { PrismaClient } = require('@prisma/client');
async function main() {
  await ConfigModule.forRoot();
  const prisma = new PrismaClient();
  try {
    const active = await prisma.listing.count({ where: { status: 'ACTIVE' } });
    const missingPins = await prisma.listing.count({ where: { status: 'ACTIVE', OR: [{ latitude: null }, { longitude: null }] } });
    console.log(JSON.stringify({ activeListings: active, activeListingsMissingCoordinates: missingPins }));
    const indexes = await prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'listings' AND indexname = 'listings_latitude_longitude_idx'`;
    if (indexes.length !== 1) throw new Error('MISSING_COORDINATE_INDEX');
    console.log('Coordinate index present');
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE perimeter_plan (id integer, latitude decimal(9,6), longitude decimal(9,6)) ON COMMIT DROP');
      await tx.$executeRawUnsafe('INSERT INTO perimeter_plan SELECT n, 5.5 + (n % 1000) * 0.004, 79.0 + (n / 1000) * 0.01 FROM generate_series(1, 120000) n');
      await tx.$executeRawUnsafe('CREATE INDEX perimeter_plan_coordinates ON perimeter_plan(latitude, longitude)');
      await tx.$executeRawUnsafe('ANALYZE perimeter_plan');
      const plan = await tx.$queryRawUnsafe('EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM perimeter_plan WHERE latitude BETWEEN 6.8958 AND 6.9588 AND longitude BETWEEN 79.8282 AND 79.8948 ORDER BY id LIMIT 250');
      console.log('Representative 120,000-row expanded bounding-box plan:');
      console.log(plan.map(row => row['QUERY PLAN']).join('\n'));
      if (!plan.some(row => /Index/.test(row['QUERY PLAN']))) throw new Error('INDEX_NOT_USED');
    }, { timeout: 60000 });
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error('Perimeter rollout check failed: ' + (error.code ?? error.errorCode ?? error.name)); process.exitCode = 1; });
