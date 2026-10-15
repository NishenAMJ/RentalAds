ALTER TABLE "rental_requests" ADD COLUMN "searchLatitude" DOUBLE PRECISION,
  ADD COLUMN "searchLongitude" DOUBLE PRECISION,
  ADD COLUMN "searchRadiusKm" DOUBLE PRECISION;
ALTER TABLE "matches" ADD COLUMN "locationOverrideReason" TEXT,
  ADD COLUMN "locationOverrideAdminId" TEXT,
  ADD COLUMN "locationOverrideAt" TIMESTAMP(3);
CREATE INDEX "listings_latitude_longitude_idx" ON "listings"("latitude", "longitude");
