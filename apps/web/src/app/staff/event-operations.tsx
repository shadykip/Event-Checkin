"use client";

import { useState } from "react";
import AttendanceSummary from "./attendance-summary";
import CheckInForm from "./check-in-form";
import GuestImportPreview from "./guest-import-preview";
import GuestList from "./guest-list";
import InviteGuestForm from "./invite-guest-form";
import styles from "./staff-styles";
import EventTeam from "./event-team";

type Props = {
    slug: string;
    role: "DOOR_STAFF" | "ORGANIZER";
};

export default function EventOperations({ slug, role }: Props) {
    const [attendanceVersion, setAttendanceVersion] = useState(0);

    function refreshAttendance() {
        setAttendanceVersion((current) => current + 1);
    }

    return (
        <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
            <div className={styles.eventBody}>
                <CheckInForm slug={slug} onConfirmed={refreshAttendance} />
                <AttendanceSummary key={attendanceVersion} slug={slug} />
            </div>
            {role === "ORGANIZER" && <EventTeam key={slug} slug={slug} />}

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
                </section>
            )}
        </div>
    );
}