CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
ALTER TABLE "users" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "suspensionReason" TEXT;
CREATE INDEX "users_accountStatus_createdAt_idx" ON "users"("accountStatus", "createdAt");
