/*
  Warnings:

  - A unique constraint covering the columns `[purchase_id,ticket_number]` on the table `ticket_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ticket_orders" ADD COLUMN     "purchase_id" UUID,
ADD COLUMN     "ticket_number" INTEGER,
ALTER COLUMN "checkout_key" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ticket_purchases" (
    "id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "checkout_key" UUID NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "buyer_email" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "people_per_ticket" INTEGER NOT NULL,
    "unit_amount_minor" INTEGER NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_purchases_tier_id_checkout_key_key" ON "ticket_purchases"("tier_id", "checkout_key");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_purchases_id_tier_id_key" ON "ticket_purchases"("id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_orders_purchase_id_ticket_number_key" ON "ticket_orders"("purchase_id", "ticket_number");

-- AddForeignKey
ALTER TABLE "ticket_purchases" ADD CONSTRAINT "ticket_purchases_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticket_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_orders" ADD CONSTRAINT "ticket_orders_purchase_id_tier_id_fkey" FOREIGN KEY ("purchase_id", "tier_id") REFERENCES "ticket_purchases"("id", "tier_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "ticket_purchases"
  ADD CONSTRAINT "ticket_purchases_quote_check" CHECK (
    "quantity" BETWEEN 1 AND 10
    AND "people_per_ticket" >= 1
    AND ("people_per_ticket" = 1 OR "quantity" = 1)
    AND "unit_amount_minor" > 0
    AND "amount_minor" = "quantity"::bigint * "unit_amount_minor"
  );

ALTER TABLE "ticket_orders"
  ADD CONSTRAINT "ticket_orders_checkout_owner_check" CHECK (
    (
      "purchase_id" IS NULL
      AND "checkout_key" IS NOT NULL
      AND "ticket_number" IS NULL
    )
    OR
    (
      "purchase_id" IS NOT NULL
      AND "checkout_key" IS NULL
      AND "ticket_number" IS NOT NULL
      AND "ticket_number" BETWEEN 1 AND 10
    )
  );

COMMIT;