import type { ReactNode } from "react";

/**
 * Title band for inner pages, in the same blue as the header and the home
 * page. The page content goes in a container with a negative top margin so
 * its first card overlaps the band's lower edge.
 */
export default function PageBanner({
  title,
  subtitle,
  width = "max-w-6xl",
  compact = false,
  children,
}: {
  title: string;
  subtitle?: string;
  width?: string;
  /** Less room under the text, for pages where the form should start high. */
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="bg-linear-to-b from-brand to-sky text-white">
      <div className={`mx-auto w-full px-4 pt-5 sm:pt-7 ${compact ? "pb-12" : "pb-14 sm:pb-16"} ${width}`}>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/85 sm:text-lg">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
