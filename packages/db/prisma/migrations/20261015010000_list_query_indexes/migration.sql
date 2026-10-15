-- Postgres does not index foreign keys automatically. These cover the list queries
-- the app runs on every page load: public browse, "my properties/requests", the admin queue and complaints.
CREATE INDEX "listings_status_deletedAt_createdAt_idx" ON "listings"("status", "deletedAt", "createdAt");
CREATE INDEX "listings_ownerId_deletedAt_createdAt_idx" ON "listings"("ownerId", "deletedAt", "createdAt");
CREATE INDEX "rental_requests_renterId_deletedAt_createdAt_idx" ON "rental_requests"("renterId", "deletedAt", "createdAt");
CREATE INDEX "rental_requests_deletedAt_createdAt_idx" ON "rental_requests"("deletedAt", "createdAt");
CREATE INDEX "matches_requestId_idx" ON "matches"("requestId");
CREATE INDEX "complaints_status_createdAt_idx" ON "complaints"("status", "createdAt");
CREATE INDEX "complaints_reporterId_idx" ON "complaints"("reporterId");
