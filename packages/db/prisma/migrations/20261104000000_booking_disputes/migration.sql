ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_OPENED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE_UPDATED';

CREATE TYPE "DisputeType" AS ENUM (
    'DEPOSIT',
    'DAMAGE',
    'NO_SHOW',
    'PAYMENT',
    'ITEM_CONDITION',
    'OTHER'
);

ALTER TABLE "complaints"
    ADD COLUMN "bookingId" TEXT,
    ADD COLUMN "disputeType" "DisputeType",
    ADD COLUMN "resolution" TEXT,
    ADD COLUMN "resolvedAt" TIMESTAMP(3),
    ADD COLUMN "resolvedById" TEXT;

CREATE INDEX "complaints_bookingId_status_createdAt_idx"
    ON "complaints"("bookingId", "status", "createdAt");
CREATE UNIQUE INDEX "complaints_bookingId_key" ON "complaints"("bookingId");

ALTER TABLE "complaints"
    ADD CONSTRAINT "complaints_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "complaints"
    ADD CONSTRAINT "complaints_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

