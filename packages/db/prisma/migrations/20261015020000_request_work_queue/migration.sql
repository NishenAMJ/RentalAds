-- Internal work queue for admins: who is handling a request, private notes and a follow-up date.
ALTER TABLE "rental_requests"
  ADD COLUMN "assignedAdminId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "adminNotes" TEXT,
  ADD COLUMN "followUpAt" TIMESTAMP(3);

ALTER TABLE "rental_requests"
  ADD CONSTRAINT "rental_requests_assignedAdminId_fkey"
  FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "rental_requests_assignedAdminId_status_idx" ON "rental_requests"("assignedAdminId", "status");
