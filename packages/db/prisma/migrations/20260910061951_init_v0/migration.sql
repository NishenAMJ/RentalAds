-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'RENTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE');

-- CreateEnum
CREATE TYPE "PropertySize" AS ENUM ('STUDIO', 'ONE_BR', 'TWO_BR', 'THREE_BR_PLUS', 'N_A');

-- CreateEnum
CREATE TYPE "FurnishingStatus" AS ENUM ('FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SUGGESTED', 'SENT', 'INTERESTED', 'NOT_INTERESTED', 'RENTED');

-- CreateEnum
CREATE TYPE "ComplaintTargetType" AS ENUM ('LISTING', 'USER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canApproveListings" BOOLEAN NOT NULL DEFAULT false,
    "canManageAdmins" BOOLEAN NOT NULL DEFAULT false,
    "canManageComplaints" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "size" "PropertySize" NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "parking" BOOLEAN NOT NULL DEFAULT false,
    "furnishing" "FurnishingStatus" NOT NULL,
    "areaText" TEXT NOT NULL,
    "mapLink" TEXT,
    "monthlyRent" INTEGER NOT NULL,
    "minDurationMonths" INTEGER NOT NULL,
    "keyMoney" BOOLEAN NOT NULL DEFAULT false,
    "keyMoneyAmount" INTEGER,
    "ownerContact" TEXT NOT NULL,
    "photoUrls" TEXT[],
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "lastAvailabilityConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_requests" (
    "id" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "areaText" TEXT NOT NULL,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "size" "PropertySize",
    "bedrooms" INTEGER,
    "parking" BOOLEAN,
    "furnishing" "FurnishingStatus",
    "renterContact" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "targetType" "ComplaintTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_authUserId_key" ON "users"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_userId_key" ON "admin_permissions"("userId");

-- CreateIndex
CREATE INDEX "listings_status_propertyType_areaText_idx" ON "listings"("status", "propertyType", "areaText");

-- CreateIndex
CREATE INDEX "listings_status_monthlyRent_idx" ON "listings"("status", "monthlyRent");

-- CreateIndex
CREATE INDEX "rental_requests_status_propertyType_areaText_idx" ON "rental_requests"("status", "propertyType", "areaText");

-- CreateIndex
CREATE UNIQUE INDEX "matches_listingId_requestId_key" ON "matches"("listingId", "requestId");

-- AddForeignKey
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "rental_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
