import { Suspense } from "react";
import StaffPage from "../../page";

export default function StaffEventDetailPage() {
    return (
        <Suspense fallback={<p className="p-6">Loading event workspace…</p>}>
            <StaffPage />
        </Suspense>
    );
}