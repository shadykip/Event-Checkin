"use client";

import { useState } from "react";
import AttendanceSummary from "./attendance-summary";
import CheckInForm from "./check-in-form";
import GuestImportPreview from "./guest-import-preview";
import GuestList from "./guest-list";
import InviteGuestForm from "./invite-guest-form";
import styles from "./staff-styles";
import EventTeam from "./event-team";
import TicketAllocation from "./ticket-allocation";
import TicketTiers from "./ticket-tiers";
import PaymentReviewList from "./payment-review-list";
import InviteDoorStaff from "./invite-door-staff";

type Props = {
    slug: string;
    role: "DOOR_STAFF" | "ORGANIZER";
};

export default function EventOperations({ slug, role }: Props) {
    const [attendanceVersion, setAttendanceVersion] = useState(0);
    const [teamVersion, setTeamVersion] = useState(0);

    function refreshAttendance() {
        setAttendanceVersion((current) => current + 1);
    }

    return (
        <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">

            <div className={styles.eventBody}>
                <CheckInForm slug={slug} onConfirmed={refreshAttendance} />
                <AttendanceSummary key={attendanceVersion} slug={slug} />
            </div>

            {role === "ORGANIZER" && <TicketAllocation slug={slug} />}
            {role === "ORGANIZER" && <TicketTiers slug={slug} />}
            {role === "ORGANIZER" && (
                <>
                    <InviteDoorStaff
                        slug={slug}
                        onInvited={() => setTeamVersion((current) => current + 1)}
                    />
                    <EventTeam key={teamVersion} slug={slug} />
                </>
            )}

            {role === "ORGANIZER" && (
                <section
                    aria-labelledby={`guest-management-${slug}`}
                    className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                    <header className="px-5 py-4 sm:px-6">
                        <h3
                            id={`guest-management-${slug}`}
                            className="text-lg font-semibold tracking-tight text-slate-950"
                        >
                            Guest management
                        </h3>
                    </header>

                    <InviteGuestForm slug={slug} onIssued={refreshAttendance} />
                    <GuestImportPreview slug={slug} onIssued={refreshAttendance} />
                    <GuestList
                        slug={slug}
                        version={attendanceVersion}
                        onRevoked={refreshAttendance}
                    />

                    <PaymentReviewList slug={slug} />
                </section>
            )}
        </div>
    );
}