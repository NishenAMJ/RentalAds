CREATE TABLE "admin_activity" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_activity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "admin_activity_createdAt_id_idx" ON "admin_activity"("createdAt", "id");
CREATE INDEX "admin_activity_entityType_entityId_createdAt_idx" ON "admin_activity"("entityType", "entityId", "createdAt");
