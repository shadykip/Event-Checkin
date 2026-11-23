-- CreateTable
CREATE TABLE "ticket_tiers" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KES',
    "capacity" INTEGER NOT NULL,
    "sales_start_at" TIMESTAMPTZ(3),
    "sales_end_at" TIMESTAMPTZ(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ticket_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_tiers_event_id_archived_idx" ON "ticket_tiers"("event_id", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_tiers_event_id_name_key_key" ON "ticket_tiers"("event_id", "name_key");

-- AddForeignKey
ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_tiers"
  ADD CONSTRAINT "ticket_tiers_price_nonnegative"
    CHECK ("price_minor" >= 0),
  ADD CONSTRAINT "ticket_tiers_capacity_positive"
    CHECK ("capacity" > 0),
  ADD CONSTRAINT "ticket_tiers_currency_kes"
    CHECK ("currency" = 'KES'),
  ADD CONSTRAINT "ticket_tiers_sales_window"
    CHECK (
      "sales_start_at" IS NULL
      OR "sales_end_at" IS NULL
      OR "sales_start_at" < "sales_end_at"
    );