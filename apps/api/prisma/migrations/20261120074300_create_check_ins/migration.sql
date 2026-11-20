-- AlterTable
ALTER TABLE "events" ADD COLUMN     "checkInInvitationId" UUID;

-- CreateTable
CREATE TABLE "check_ins" (
    "invitation_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("invitation_id")
);

-- CreateIndex
CREATE INDEX "check_ins_staff_id_idx" ON "check_ins"("staff_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_checkInInvitationId_fkey" FOREIGN KEY ("checkInInvitationId") REFERENCES "check_ins"("invitation_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
