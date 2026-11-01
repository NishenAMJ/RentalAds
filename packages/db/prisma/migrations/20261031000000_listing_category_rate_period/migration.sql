-- Additive: every existing listing becomes a monthly PROPERTY listing via the column defaults.
CREATE TYPE "ListingCategory" AS ENUM ('PROPERTY');
CREATE TYPE "RatePeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');

ALTER TABLE "listings"
  ADD COLUMN "category" "ListingCategory" NOT NULL DEFAULT 'PROPERTY',
  ADD COLUMN "attributes" JSONB,
  ADD COLUMN "ratePeriod" "RatePeriod" NOT NULL DEFAULT 'MONTH';
