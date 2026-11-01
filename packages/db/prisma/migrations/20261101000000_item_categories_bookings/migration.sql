-- Additive and relaxing only: existing property listings keep every value they have today.
ALTER TYPE "ListingCategory" ADD VALUE IF NOT EXISTS 'VEHICLE';
ALTER TYPE "ListingCategory" ADD VALUE IF NOT EXISTS 'EQUIPMENT';
ALTER TYPE "ListingCategory" ADD VALUE IF NOT EXISTS 'EVENT_GEAR';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CANCELLED';

CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

ALTER TABLE "listings"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "depositAmount" INTEGER,
  ALTER COLUMN "propertyType" DROP NOT NULL,
  ALTER COLUMN "size" DROP NOT NULL,
  ALTER COLUMN "bedrooms" DROP NOT NULL,
  ALTER COLUMN "bathrooms" DROP NOT NULL,
  ALTER COLUMN "furnishing" DROP NOT NULL,
  ALTER COLUMN "minDurationMonths" DROP NOT NULL;

CREATE INDEX "listings_status_category_createdAt_idx" ON "listings"("status", "category", "createdAt");

CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "renterId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "units" INTEGER NOT NULL,
  "rateAmount" INTEGER NOT NULL,
  "rentalTotal" INTEGER NOT NULL,
  "serviceFee" INTEGER NOT NULL,
  "depositAmount" INTEGER NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "renterContact" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "paymentReference" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_dates_check" CHECK ("endDate" > "startDate"),
  CONSTRAINT "bookings_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bookings_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "bookings_listingId_status_startDate_endDate_idx" ON "bookings"("listingId", "status", "startDate", "endDate");
CREATE INDEX "bookings_renterId_createdAt_idx" ON "bookings"("renterId", "createdAt");

