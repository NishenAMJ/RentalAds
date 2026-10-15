/*
  Warnings:

  - You are about to drop the column `latitude` on the `admin_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `admin_permissions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "admin_permissions" DROP COLUMN "latitude",
DROP COLUMN "longitude";
