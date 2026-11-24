"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const navigationLink =
  "relative inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300 motion-safe:transition-colors after:absolute after:right-3 after:bottom-1 after:left-3 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-teal-300 hover:after:scale-x-100 motion-safe:after:transition-transform";

const signInLink =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-300 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300 motion-safe:transition-colors";

export default function PublicNavigation() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      menuButton.current?.focus();
    }
  }

  return (
    <header
      ref={header}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-sm"
    >
      <div className="mx-auto flex min-h-20 w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          aria-label="Event check-in home"
          className="group inline-flex shrink-0 items-center gap-2 rounded-lg text-sm font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300 sm:gap-3 sm:text-lg"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-300 text-xl font-bold text-slate-950 group-hover:bg-teal-200 motion-safe:transition motion-safe:duration-200 motion-safe:group-hover:-rotate-6"
          >
            ✓
          </span>
          Event check-in
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-5 md:flex"
        >
          <Link href="/" className={navigationLink}>
            Explore events
          </Link>
          <Link href="/staff/login" className={signInLink}>
            Organizer sign-in
          </Link>
        </nav>

        <button
          ref={menuButton}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300 motion-safe:transition-colors md:hidden"
        >
          <span aria-hidden="true" className="relative block h-5 w-5">
            <span
              className={`absolute left-0 h-0.5 w-5 rounded-full bg-current motion-safe:transition-transform motion-safe:duration-200 ${open ? "top-2.5 rotate-45" : "top-1.5"}`}
            />
            <span
              className={`absolute left-0 h-0.5 w-5 rounded-full bg-current motion-safe:transition-transform motion-safe:duration-200 ${open ? "top-2.5 -rotate-45" : "top-3"}`}
            />
          </span>
          Menu
        </button>
      </div>

      <div
        id="mobile-navigation"
        aria-hidden={!open}
        inert={!open}
        className={`grid overflow-hidden motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 motion-safe:ease-out md:hidden ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <nav
            aria-label="Mobile navigation"
            className="mx-4 grid gap-3 border-t border-slate-800 pt-3 pb-5 sm:mx-6"
          >
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className={navigationLink}
            >
              Explore events
            </Link>
            <Link
              href="/staff/login"
              onClick={() => setOpen(false)}
              className={signInLink}
            >
              Organizer sign-in
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
