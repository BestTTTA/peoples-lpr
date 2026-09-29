"use client";
import { useEffect, useState } from "react";
import { CHANNEL_TYPES, type ContactInfo, channelHref } from "@/lib/contact";

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
    <section className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <h2 className="text-sm font-semibold">{contact.heading}</h2>
      {contact.note && <p className="max-w-md text-xs text-ink-3">{contact.note}</p>}
      <ul className="flex flex-wrap justify-center gap-2">
        {contact.channels.map((c, i) => {
          const href = channelHref(c);
          const external = href?.startsWith("http");
          const body = (
            <>
              <span aria-hidden>{CHANNEL_TYPES[c.type].icon}</span>
              <span className="flex flex-col text-left leading-tight">
                <span className="text-[11px] text-ink-3">{c.label || CHANNEL_TYPES[c.type].label}</span>
                <span className="text-sm font-medium break-all">{c.value}</span>
              </span>
            </>
          );
          return (
            <li key={i}>
              {href ? (
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 hover:border-brand"
                >
                  {body}
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
