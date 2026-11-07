CREATE TYPE "OwnerVerificationStatus" AS ENUM (
  'NOT_REQUESTED',
  'REQUESTED',
  'VERIFIED',
  'REJECTED'
);

ALTER TABLE "users"
  ADD COLUMN "ownerVerificationStatus" "OwnerVerificationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "ownerVerificationRequestedAt" TIMESTAMP(3),
  ADD COLUMN "ownerVerificationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "ownerVerificationNote" TEXT;

CREATE INDEX "users_ownerVerificationStatus_createdAt_idx"
  ON "users"("ownerVerificationStatus", "createdAt");
