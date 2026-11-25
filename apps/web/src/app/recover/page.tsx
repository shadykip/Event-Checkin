import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import RecoverBooking from './recover-booking';

export const metadata: Metadata = {
  title: 'Recover booking | Event Check-in',
  robots: { index: false, follow: false },
};

type RecoverySearchParams = Promise<{ reference?: string }>;

async function RecoveryForm({
  searchParams,
}: {
  searchParams: RecoverySearchParams;
}) {
  const { reference } = await searchParams;

  return (
    <RecoverBooking
      initialReference={typeof reference === 'string' ? reference : ''}
    />
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: RecoverySearchParams;
}) {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-12 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm font-semibold text-teal-800 hover:underline">
          ← Explore events
        </Link>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight">Find your booking</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lost your checkout page? Enter the order reference and purchase email.
            The emailed link opens your booking without changing your tickets.
          </p>

          <Suspense
            fallback={
              <p className="mt-6 text-sm text-slate-600">Loading booking form…</p>
            }
          >
            <RecoveryForm searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}