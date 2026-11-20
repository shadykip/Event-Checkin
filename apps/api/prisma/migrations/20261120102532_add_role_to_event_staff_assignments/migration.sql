-- CreateEnum
CREATE TYPE "EventStaffRole" AS ENUM ('DOOR_STAFF', 'ORGANIZER');

-- AlterTable
ALTER TABLE "event_staff_assignments" ADD COLUMN     "role" "EventStaffRole" NOT NULL DEFAULT 'DOOR_STAFF';
