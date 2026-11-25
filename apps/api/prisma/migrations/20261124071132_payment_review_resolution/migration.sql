-- AlterTable
ALTER TABLE "ticket_orders" ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "review_resolution" TEXT,
ADD COLUMN     "review_resolved_at" TIMESTAMPTZ(3),
ADD COLUMN     "review_resolved_by" UUID;

-- AlterTable
ALTER TABLE "ticket_purchases" ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "review_resolution" TEXT,
ADD COLUMN     "review_resolved_at" TIMESTAMPTZ(3),
ADD COLUMN     "review_resolved_by" UUID;
