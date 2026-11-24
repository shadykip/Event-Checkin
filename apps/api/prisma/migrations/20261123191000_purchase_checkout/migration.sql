ALTER TABLE "ticket_purchases"
  ADD COLUMN "payment_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "checkout_url" TEXT,
  ADD COLUMN "paid_at" TIMESTAMPTZ(3),
  ADD COLUMN "payment_review" TEXT;
