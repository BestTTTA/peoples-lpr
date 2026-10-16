import type { ReactNode } from "react";

export default function GuideAccordion({
  number,
  title,
  children,
  open = false,
}: {
  number: number;
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 font-bold outline-none transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-sm text-brand" aria-hidden>
          {number}
        </span>
        <span className="min-w-0 flex-1 text-base leading-snug sm:text-lg">{title}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-line px-4 py-5 sm:px-6 sm:py-6">{children}</div>
    </details>
  );
}
