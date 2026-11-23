-- AlterTable
ALTER TABLE "ticket_orders" ADD COLUMN     "payment_started_at" TIMESTAMPTZ(3),
ADD COLUMN     "recovery_after" TIMESTAMPTZ(3),
ADD COLUMN     "recovery_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recovery_lease" UUID;

-- CreateIndex
CREATE INDEX "ticket_orders_recovery_after_id_idx" ON "ticket_orders"("recovery_after", "id");
UPDATE ticket_orders
SET payment_started_at = created_at
WHERE checkout_url IS NOT NULL;

UPDATE ticket_orders
SET recovery_after = NOW()
WHERE payment_review IS NULL
  AND (
    (payment_started_at IS NOT NULL AND invitation_id IS NULL)
    OR (invitation_id IS NOT NULL AND email_sent_at IS NULL)
  );