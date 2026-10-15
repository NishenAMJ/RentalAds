// Read-only connectivity/schema check. Never prints connection strings or rows.
const { ConfigModule } = require('@nestjs/config');
const { PrismaClient } = require('@prisma/client');

async function main() {
  await ConfigModule.forRoot();
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('users', 'listings', 'rental_requests', 'matches', 'complaints', 'admin_permissions')
      ORDER BY tablename
    `;
    console.log('Database connection: OK');
    console.log('Tables: ' + tables.map((table) => table.tablename).join(', '));
    if (tables.length !== 6) throw new Error('INCOMPLETE_SCHEMA');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    'Database check failed: ' +
      (error.code ??
        error.errorCode ??
        (error.message === 'INCOMPLETE_SCHEMA' ? error.message : error.name)),
  );
  process.exitCode = 1;
});
