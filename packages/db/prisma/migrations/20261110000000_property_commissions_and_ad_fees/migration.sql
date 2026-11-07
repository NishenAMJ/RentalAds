-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('DUE', 'INVOICED', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "PropertyFeeType" AS ENUM ('COMMISSION', 'LISTING_FEE');

-- AlterTable
ALTER TABLE "admin_permissions" ADD COLUMN "canManageCommissions" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "property_commissions" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "listingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "feeType" "PropertyFeeType" NOT NULL DEFAULT 'COMMISSION',
    "agreedRent" INTEGER,
    "ratePercent" INTEGER DEFAULT 30,
    "amount" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'DUE',
    "paymentReference" TEXT,
    "note" TEXT,
    "invoicedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_commissions_matchId_key" ON "property_commissions"("matchId");

-- CreateIndex
CREATE INDEX "property_commissions_status_createdAt_idx" ON "property_commissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "property_commissions_ownerId_status_idx" ON "property_commissions"("ownerId", "status");

-- CreateIndex
CREATE INDEX "property_commissions_listingId_idx" ON "property_commissions"("listingId");

-- AddForeignKey
ALTER TABLE "property_commissions" ADD CONSTRAINT "property_commissions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_commissions" ADD CONSTRAINT "property_commissions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_commissions" ADD CONSTRAINT "property_commissions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_commissions" ADD CONSTRAINT "property_commissions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_commissions" ADD CONSTRAINT "property_commissions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

