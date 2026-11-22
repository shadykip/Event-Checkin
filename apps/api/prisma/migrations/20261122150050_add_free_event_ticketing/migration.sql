-- CreateTable
CREATE TABLE "ticket_allocations" (
    "event_id" UUID NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "ticket_allocations_pkey" PRIMARY KEY ("event_id")
);

-- AddForeignKey
ALTER TABLE "ticket_allocations" ADD CONSTRAINT "ticket_allocations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
