const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600";

const button =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const styles = {
  shell: "min-h-dvh bg-slate-100 font-sans text-slate-950 antialiased",

  bar: "border-b border-slate-200 bg-white text-slate-950",

  barInner:
    "mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-12",

  brand:
    "border-l-4 border-teal-600 pl-3 text-lg font-bold tracking-tight text-slate-950",

  barButton: `${button} ${focus} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`,

  workspace: "mx-auto w-full max-w-7xl px-3 py-6 sm:px-8 sm:py-9 lg:px-12",

  title: "mb-6 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl",

  eventList: "m-0 grid list-none gap-8 p-0",

  card: "min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm",

  loginCard:
    "mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8",

  eventHeader:
    "flex flex-col items-start gap-4 bg-slate-900 px-5 py-6 text-white sm:flex-row sm:justify-between sm:gap-8 sm:px-8 sm:py-7",

  eventName:
    "break-words text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl",

  muted: "mt-1 text-sm leading-6 text-slate-600",

  eventBody:
    "grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]",

  panel:
    "min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-5 sm:px-6 sm:py-6",

  attendance: "self-start",

  sectionTitle: "text-lg font-semibold tracking-tight text-slate-950",

  stack: "mt-4 grid gap-3",

  primary: `${button} ${focus} bg-teal-700 text-white shadow-sm hover:enabled:bg-teal-800`,

  secondary: `${button} ${focus} border border-slate-300 bg-white text-slate-800 hover:enabled:bg-slate-50`,

  textButton: `inline-flex min-h-11 w-fit cursor-pointer items-center rounded-md text-sm font-semibold text-teal-800 underline-offset-4 hover:underline disabled:opacity-50 ${focus}`,

  label: "grid gap-2 text-sm font-semibold text-slate-800",

  input:
    "min-h-12 w-full rounded-xl border border-slate-400 bg-white px-3.5 py-2.5 text-base font-normal text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25 disabled:bg-slate-100",

  metrics: [
    "mt-4 grid grid-cols-2 gap-3",
    "[&>div]:min-w-0 [&>div]:rounded-xl [&>div]:px-3 [&>div]:py-4 sm:[&>div]:px-4",
    "[&>div:first-child]:bg-teal-50 [&>div:last-child]:bg-slate-100",
    "[&_dt]:text-sm [&_dt]:font-medium [&_dt]:text-slate-700",
    "[&_dd]:mt-2 [&_dd]:text-3xl [&_dd]:font-semibold [&_dd]:tracking-tight",
    "[&_dd]:text-slate-950 [&_dd]:tabular-nums sm:[&_dd]:text-4xl",
  ].join(" "),

  feedback: "rounded-xl border px-4 py-3 text-sm leading-6",

  success: "border-emerald-300 bg-emerald-50 text-emerald-950",

  repeat: "border-amber-300 bg-amber-50 text-amber-950",

  error: "border-red-300 bg-red-50 text-red-900",
};

export default styles;
