"use client";
import { useEffect, useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import ChannelIcon from "@/components/ChannelIcon";
import { CHANNEL_TYPES, type ContactInfo, channelDisplay, channelHref } from "@/lib/contact";

// Fetched once per page load and shared by every instance on the page.
let pending: Promise<ContactInfo | null> | null = null;
const load = () =>
  (pending ??= fetch("/api/contact")
    .then((r) => (r.ok ? (r.json() as Promise<ContactInfo>) : null))
    .catch(() => null));

/** "ติดต่อเรา": the site's contact channels from /admin. Renders nothing until some are set. */
export default function ContactChannels({ className = "", preview }: { className?: string; preview?: ContactInfo }) {
  const [loaded, setLoaded] = useState<ContactInfo | null>(null);
  useEffect(() => {
    if (!preview) load().then(setLoaded);
  }, [preview]);
  const contact = preview ?? loaded;
  if (!contact?.channels.length) return null;

  return (
    <section className={`flex w-full flex-col items-center gap-3 ${className}`}>
      <div className="text-center">
        <h2 className="text-base font-bold text-ink">{contact.heading}</h2>
        {contact.note && <p className="mt-0.5 max-w-md text-xs text-ink-3">{contact.note}</p>}
      </div>
      {/* Centred whatever the count: one channel shouldn't sit off to the side. */}
      <ul className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
        {contact.channels.map((c, i) => {
          const href = channelHref(c);
          const name = c.label || CHANNEL_TYPES[c.type].label;
          const sub = channelDisplay(c);
          const body = (
            <>
              <ChannelIcon type={c.type} />
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                {sub && sub !== name && <span className="block truncate text-xs text-ink-3">{sub}</span>}
              </span>
              {href && <LuChevronRight aria-hidden className="shrink-0 text-ink-3 transition group-hover:translate-x-0.5" />}
            </>
          );
          const card = "group flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-3 py-2.5";
          return (
            <li key={i} className="w-full sm:w-[calc(50%-0.25rem)] sm:max-w-80">
              {href ? (
                <a
                  href={href}
                  title={`${name} — ${CHANNEL_TYPES[c.type].label}`}
                  {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={`${card} transition hover:-translate-y-0.5 hover:border-brand hover:bg-surface-2`}
                >
                  {body}
                </a>
              ) : (
                <div className={card}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
