import { Suspense } from "react";
import StaffPage from "../page";

export default function StaffEventsPage() {
    return (
        <Suspense fallback={<p className="p-6">Loading your events…</p>}>
            <StaffPage />
        </Suspense>
    );
}