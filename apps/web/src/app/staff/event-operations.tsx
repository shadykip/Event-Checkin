"use client";

import { useState } from "react";
import AttendanceSummary from "./attendance-summary";
import CheckInForm from "./check-in-form";
import InviteGuestForm from "./invite-guest-form";
import styles from "./staff-styles";
import GuestList from "./guest-list";

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
        <>
            <div className={styles.eventBody}>
                <CheckInForm slug={slug} onConfirmed={refreshAttendance} />
                <AttendanceSummary key={attendanceVersion} slug={slug} />
            </div>

            {role === "ORGANIZER" && (
                <>
                    <InviteGuestForm slug={slug} onIssued={refreshAttendance} />
                    <GuestList
                        slug={slug}
                        version={attendanceVersion}
                        onRevoked={refreshAttendance}
                    />
                </>
            )}
        </>
    );
}