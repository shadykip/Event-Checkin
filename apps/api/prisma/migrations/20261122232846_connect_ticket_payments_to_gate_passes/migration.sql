/*
  Warnings:

  - A unique constraint covering the columns `[invitation_id]` on the table `ticket_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ticket_orders" ADD COLUMN     "checkout_url" TEXT,
ADD COLUMN     "email_sent_at" TIMESTAMPTZ(3),
ADD COLUMN     "invitation_id" UUID,
ADD COLUMN     "payment_review" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ticket_orders_invitation_id_key" ON "ticket_orders"("invitation_id");

-- AddForeignKey
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
