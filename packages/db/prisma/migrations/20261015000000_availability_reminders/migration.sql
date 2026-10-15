-- Owners are reminded to confirm availability; reminderSentAt prevents repeat reminders.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AVAILABILITY_REMINDER';
ALTER TABLE "listings" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
