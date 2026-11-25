-- AlterTable
ALTER TABLE "ticket_orders" ADD COLUMN     "provider_fee_minor" INTEGER;

-- AlterTable
ALTER TABLE "ticket_purchases" ADD COLUMN     "provider_fee_minor" INTEGER;
