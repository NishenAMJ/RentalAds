// Read-only role/permission diagnostic. Never prints credentials or tokens.
const { ConfigModule } = require('@nestjs/config');
const { PrismaClient } = require('@prisma/client');

async function main() {
  await ConfigModule.forRoot();
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2]?.trim();
    if (email) {
      const account = await prisma.user.findUnique({
        where: { email },
        select: {
          role: true,
          adminPermission: { select: {
            canApproveListings: true, canManageAdmins: true, canManageComplaints: true,
          } },
        },
      });
      const otherAdminAccounts = await prisma.user.count({ where: {
        email: { not: email },
        adminPermission: { is: { canManageAdmins: true } },
      } });
      console.log(JSON.stringify({ account: account ?? { found: false }, otherAdminAccounts }, null, 2));
    } else {
      const roles = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
      const privilegedRenters = await prisma.user.count({ where: {
        role: 'RENTER',
        adminPermission: { is: { OR: [
          { canApproveListings: true }, { canManageAdmins: true }, { canManageComplaints: true },
        ] } },
      } });
      console.log(JSON.stringify({ roles, privilegedRenters }, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(error => {
  console.error('Account check failed: ' + (error.code ?? error.errorCode ?? error.name));
  process.exitCode = 1;
});
