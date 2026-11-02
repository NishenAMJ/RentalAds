CREATE TABLE "booking_reviews" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "booking_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5),
  CONSTRAINT "booking_reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "booking_reviews_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "booking_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "booking_reviews_bookingId_key" ON "booking_reviews"("bookingId");
CREATE INDEX "booking_reviews_listingId_createdAt_idx" ON "booking_reviews"("listingId", "createdAt");
CREATE INDEX "booking_reviews_reviewerId_idx" ON "booking_reviews"("reviewerId");
