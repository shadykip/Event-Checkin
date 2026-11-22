/*
  Warnings:

  - A unique constraint covering the columns `[reset_token_hash]` on the table `staff_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "staff_accounts" ADD COLUMN     "reset_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "reset_requested_at" TIMESTAMPTZ(3),
ADD COLUMN     "reset_token_hash" CHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_reset_token_hash_key" ON "staff_accounts"("reset_token_hash");
