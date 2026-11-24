import type { Metadata } from "next";
import { Suspense } from "react";
import PublicShell from "../../public-shell";
import Checkout from "./checkout";

export const metadata: Metadata = {
  title: "Ticket checkout | Event check-in",
};

export default function Page() {
  return (
    <PublicShell>
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-10"
      >
        <Suspense
          fallback={
            <section
              aria-busy="true"
              className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                Ticket checkout
              </h1>
              <p role="status" className="mt-4 text-slate-600">
                Loading your reservation…
              </p>
            </section>
          }
        >
          <Checkout />
        </Suspense>
      </main>
    </PublicShell>
  );
}
