// Remove accidental admin grants from a named renter, preserving another administrator.
const { ConfigModule } = require('@nestjs/config');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) throw new Error('EMAIL_REQUIRED');
  await ConfigModule.forRoot();
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async tx => {
      const account = await tx.user.findUnique({ where: { email }, select: { id: true, role: true } });
      if (account?.role !== 'RENTER') throw new Error('RENTER_ACCOUNT_REQUIRED');
      const otherAdmins = await tx.user.count({ where: {
        id: { not: account.id }, adminPermission: { is: { canManageAdmins: true } },
      } });
      if (!otherAdmins) throw new Error('ANOTHER_ADMIN_REQUIRED');
      return tx.adminPermission.updateMany({
        where: { userId: account.id },
        data: { canApproveListings: false, canManageAdmins: false, canManageComplaints: false },
      });
    }, { isolationLevel: 'Serializable' });
    console.log(JSON.stringify({ updatedPermissionRecords: result.count }));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(error => {
  const safeMessages = ['EMAIL_REQUIRED', 'RENTER_ACCOUNT_REQUIRED', 'ANOTHER_ADMIN_REQUIRED'];
  console.error('Permission correction failed: ' +
    (safeMessages.includes(error.message) ? error.message : error.code ?? error.errorCode ?? error.name));
  process.exitCode = 1;
});
