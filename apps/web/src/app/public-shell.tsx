import Link from "next/link";
import type { ReactNode } from "react";
import PublicNavigation from "./public-navigation";

const footerLink =
  "inline-flex min-h-11 w-fit items-center rounded-md text-sm font-medium text-slate-300 hover:text-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300 motion-safe:transition motion-safe:duration-200 motion-safe:hover:translate-x-1";

export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 font-sans text-slate-950 antialiased [color-scheme:light]">
      <a
        href="#main-content"
        className="fixed -top-24 left-4 z-50 rounded-lg bg-white px-4 py-3 font-semibold text-slate-950 focus:top-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
      >
        Skip to content
      </a>
      <PublicNavigation />
      {children}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto w-full max-w-[1600px] px-4 pt-10 pb-6 sm:px-6 sm:pt-12 lg:px-10">
          <div className="grid grid-cols-2 gap-8 pb-9 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-12">
            <div className="col-span-2 sm:col-span-1">
              <Link
                href="/"
                aria-label="Event check-in home"
                className="group inline-flex items-center gap-3 rounded-lg text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-xl bg-teal-300 text-xl text-slate-950 group-hover:bg-teal-200 motion-safe:transition motion-safe:duration-200 motion-safe:group-hover:-rotate-6"
                >
                  ✓
                </span>
                Event check-in
              </Link>
            </div>
            <nav
              aria-labelledby="footer-events-title"
              className="flex flex-col items-start"
            >
              <h2
                id="footer-events-title"
                className="mb-2 text-sm font-semibold text-white"
              >
                Explore
              </h2>
              <Link href="/" className={footerLink}>
                All events
              </Link>
            </nav>
            <nav
              aria-labelledby="footer-organizers-title"
              className="flex flex-col items-start"
            >
              <h2
                id="footer-organizers-title"
                className="mb-2 text-sm font-semibold text-white"
              >
                Organizers
              </h2>
              <Link href="/staff" className={footerLink}>
                Organizer workspace
              </Link>
              <Link href="/staff/login" className={footerLink}>
                Sign in
              </Link>
            </nav>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5 text-sm leading-6 text-slate-400">
            <p>Event times are shown in Nairobi time (EAT).</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
