// Adds a handful of sample vehicles, equipment and event gear so the site has something to browse in a demo.
//
//   node --env-file=.env scripts/seed-demo.cjs --yes          add the sample listings
//   node --env-file=.env scripts/seed-demo.cjs --remove --yes  delete them again
//
// It writes to whatever database DATABASE_URL points at, so it refuses to run without --yes and prints the target first.
// Everything it creates belongs to one fake owner (demo-owner@example.test), so --remove can take it all back out.
const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const args = new Set(process.argv.slice(2));
const data = JSON.parse(readFileSync(join(__dirname, 'demo-data.json'), 'utf8'));

function target() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return `${url.hostname}${url.pathname}`;
  } catch {
    return '(DATABASE_URL is missing or invalid)';
  }
}

async function main() {
  console.log(`Database: ${target()}`);
  if (!args.has('--yes')) {
    console.log('Nothing changed. Add --yes to confirm you want to write to this database.');
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient();
  try {
    const owner = await prisma.user.findUnique({ where: { authUserId: data.owner.authUserId } });
    if (args.has('--remove')) {
      if (!owner) return console.log('No demo data found.');
      const bookings = await prisma.booking.count({ where: { listing: { ownerId: owner.id } } });
      if (bookings) throw new Error(`The demo listings have ${bookings} booking(s); remove those first.`);
      const removed = await prisma.listing.deleteMany({ where: { ownerId: owner.id } });
      await prisma.user.delete({ where: { id: owner.id } });
      return console.log(`Removed ${removed.count} demo listings and the demo owner.`);
    }
    const demoOwner =
      owner ??
      (await prisma.user.create({
        data: { authUserId: data.owner.authUserId, email: data.owner.email, phone: data.owner.phone, role: 'OWNER' },
      }));
    const existing = await prisma.listing.count({ where: { ownerId: demoOwner.id } });
    if (existing) return console.log(`Demo data is already there (${existing} listings). Use --remove first to start over.`);
    for (const item of data.listings) {
      await prisma.listing.create({
        data: {
          ownerId: demoOwner.id,
          category: item.category,
          title: item.title,
          description: item.description,
          areaText: item.areaText,
          monthlyRent: item.rate,
          ratePeriod: item.ratePeriod,
          depositAmount: item.depositAmount,
          attributes: item.attributes,
          ownerContact: data.owner.phone,
          photoUrls: [`https://picsum.photos/seed/${item.photo}/960/600`],
          status: 'ACTIVE',
          lastAvailabilityConfirmedAt: new Date(),
        },
      });
    }
    console.log(`Added ${data.listings.length} demo listings, owned by ${data.owner.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
