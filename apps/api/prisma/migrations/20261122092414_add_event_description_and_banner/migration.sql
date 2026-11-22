-- AlterTable
ALTER TABLE "events" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "event_banners" (
    "event_id" UUID NOT NULL,
    "image" BYTEA NOT NULL,

    CONSTRAINT "event_banners_pkey" PRIMARY KEY ("event_id")
);

-- AddForeignKey
ALTER TABLE "event_banners" ADD CONSTRAINT "event_banners_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
