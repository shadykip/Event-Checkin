-- CreateTable
CREATE TABLE "staff_accounts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_staff_assignments" (
    "event_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_staff_assignments_pkey" PRIMARY KEY ("event_id","staff_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_email_key" ON "staff_accounts"("email");

-- CreateIndex
CREATE INDEX "event_staff_assignments_staff_id_idx" ON "event_staff_assignments"("staff_id");

-- AddForeignKey
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
