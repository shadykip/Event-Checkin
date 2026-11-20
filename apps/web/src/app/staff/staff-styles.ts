const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600";

const button =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const styles = {
  shell:
    "min-h-dvh bg-slate-100 font-sans text-slate-950 antialiased",

  bar:
    "border-b border-slate-700 bg-slate-900 text-white",

  barInner:
    "mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8",

  brand:
    "text-lg font-bold tracking-tight",

  barButton:
    `${button} border border-slate-500 text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white`,

  workspace:
    "mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12",

  title:
    "mb-6 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl",

  eventList:
    "m-0 grid list-none gap-6 p-0",

  card:
    "min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",

  loginCard:
    "mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8",

  eventHeader:
    "border-b border-slate-200 border-l-4 border-l-teal-600 px-5 py-5 sm:px-7 sm:py-6",

  eventName:
    "text-xl font-bold tracking-tight text-slate-950 sm:text-2xl",

  muted:
    "mt-1 text-sm leading-6 text-slate-600",

  eventBody:
    "grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)]",

  panel:
    "min-w-0 px-5 py-6 sm:px-7",

  attendance:
    "border-t border-slate-200 bg-slate-50 md:border-t-0 md:border-l",

  sectionTitle:
    "text-base font-bold tracking-tight text-slate-900",

  stack:
    "mt-4 grid gap-3",

  primary:
    `${button} ${focus} bg-teal-700 text-white shadow-sm hover:enabled:bg-teal-800`,

  secondary:
    `${button} ${focus} border border-slate-300 bg-white text-slate-800 hover:enabled:bg-slate-50`,

  textButton:
    `inline-flex min-h-11 w-fit cursor-pointer items-center rounded-md text-sm font-semibold text-teal-800 underline-offset-4 hover:underline disabled:opacity-50 ${focus}`,

  label:
    "grid gap-2 text-sm font-semibold text-slate-800",

  input:
    "min-h-12 w-full rounded-xl border border-slate-400 bg-white px-3.5 py-2.5 text-base font-normal text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25 disabled:bg-slate-100",

  metrics:
    "mt-4 mb-1 grid grid-cols-2 gap-3 [&>div]:rounded-xl [&>div]:border [&>div]:border-slate-200 [&>div]:bg-white [&>div]:p-3 [&_dt]:text-sm [&_dt]:text-slate-600 [&_dd]:mt-1 [&_dd]:text-3xl [&_dd]:font-bold [&_dd]:tracking-tight [&_dd]:tabular-nums",

  feedback:
    "rounded-xl border px-4 py-3 text-sm leading-6",

  success:
    "border-emerald-300 bg-emerald-50 text-emerald-950",

  repeat:
    "border-amber-300 bg-amber-50 text-amber-950",

  error:
    "border-red-300 bg-red-50 text-red-900",
};

export default styles;
