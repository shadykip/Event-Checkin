import { Suspense } from "react";
import Checkout from "./checkout";

export default function Page() {
    return (
        <main className="grid min-h-dvh place-items-center bg-slate-100 p-5">
            <Suspense fallback={<p role="status">Loading checkout…</p>}>
                <Checkout />
            </Suspense>
        </main>
    );
}