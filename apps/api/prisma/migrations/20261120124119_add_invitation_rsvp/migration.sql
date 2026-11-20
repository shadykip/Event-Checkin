-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "rsvp_responded_at" TIMESTAMPTZ(3),
ADD COLUMN     "rsvp_status" "RsvpStatus" NOT NULL DEFAULT 'PENDING';
