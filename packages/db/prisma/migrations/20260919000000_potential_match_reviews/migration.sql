ALTER TABLE "matches" ADD COLUMN "recommendationReason" TEXT,
  ADD COLUMN "recommendedByAdminId" TEXT,
  ADD COLUMN "recommendationReviewedAt" TIMESTAMP(3);
