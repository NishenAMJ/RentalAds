CREATE TYPE "OwnerPayoutStatus" AS ENUM ('DUE', 'PAID', 'CANCELLED');

CREATE TABLE "owner_payouts" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "OwnerPayoutStatus" NOT NULL DEFAULT 'DUE',
    "note" TEXT,
    "transferReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_payouts_pkey" PRIMARY KEY ("id")
    ,CONSTRAINT "owner_payouts_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "owner_payouts_bookingId_key" ON "owner_payouts"("bookingId");
CREATE INDEX "owner_payouts_status_createdAt_idx" ON "owner_payouts"("status", "createdAt");
CREATE INDEX "owner_payouts_ownerId_status_idx" ON "owner_payouts"("ownerId", "status");

ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
