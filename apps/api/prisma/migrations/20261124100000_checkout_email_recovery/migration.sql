ALTER TABLE "ticket_orders"
  ADD COLUMN "recovery_requested_at" TIMESTAMPTZ(3);

ALTER TABLE "ticket_purchases"
  ADD COLUMN "recovery_requested_at" TIMESTAMPTZ(3);
