-- CreateTable
CREATE TABLE "ticket_orders" (
    "id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "checkout_key" UUID NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_email" TEXT NOT NULL,
    "tier_name" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),

    CONSTRAINT "ticket_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_orders_tier_id_paid_at_expires_at_idx" ON "ticket_orders"("tier_id", "paid_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_orders_tier_id_checkout_key_key" ON "ticket_orders"("tier_id", "checkout_key");

-- AddForeignKey
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticket_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
