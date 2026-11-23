-- AlterTable
ALTER TABLE "ticket_orders" ADD COLUMN     "people_per_ticket" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ticket_tiers" ADD COLUMN     "people_per_ticket" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ticket_tiers"
  ADD CONSTRAINT "ticket_tiers_people_per_ticket_positive"
  CHECK ("people_per_ticket" >= 1);

ALTER TABLE "ticket_orders"
  ADD CONSTRAINT "ticket_orders_people_per_ticket_positive"
  CHECK ("people_per_ticket" >= 1);
