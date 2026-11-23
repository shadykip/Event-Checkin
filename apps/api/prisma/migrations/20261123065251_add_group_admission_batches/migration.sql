-- CreateTable
CREATE TABLE "admission_batches" (
    "invitation_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "admitted_after" INTEGER NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_batches_pkey" PRIMARY KEY ("invitation_id","request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admission_batches_invitation_id_admitted_after_key" ON "admission_batches"("invitation_id", "admitted_after");

-- AddForeignKey
ALTER TABLE "admission_batches" ADD CONSTRAINT "admission_batches_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "check_ins"("invitation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_batches" ADD CONSTRAINT "admission_batches_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE admission_batches
  ADD CONSTRAINT admission_batches_positive_quantity CHECK (quantity > 0),
  ADD CONSTRAINT admission_batches_valid_total CHECK (admitted_after >= quantity);