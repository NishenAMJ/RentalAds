-- Additive only: new enum values, new booking columns with defaults, and a new table.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LISTING_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LISTING_REJECTED';

CREATE TYPE "CancelledBy" AS ENUM ('RENTER', 'OWNER', 'ADMIN', 'SYSTEM');
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'DUE', 'DONE');

ALTER TABLE "bookings"
  ADD COLUMN "cancelledBy" "CancelledBy",
  ADD COLUMN "cancelReason" TEXT,
  ADD COLUMN "refundAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundReference" TEXT;

-- A booking that was paid and then cancelled before this migration is owed its money back.
UPDATE "bookings"
SET "refundAmount" = "totalAmount", "refundStatus" = 'DUE', "cancelledBy" = COALESCE("cancelledBy", 'SYSTEM')
WHERE "status" = 'CANCELLED' AND "paidAt" IS NOT NULL;

CREATE INDEX "bookings_refundStatus_idx" ON "bookings"("refundStatus");

CREATE TABLE "listing_blocks" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "listing_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_blocks_dates_check" CHECK ("endDate" > "startDate"),
  CONSTRAINT "listing_blocks_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "listing_blocks_listingId_startDate_endDate_idx" ON "listing_blocks"("listingId", "startDate", "endDate");
