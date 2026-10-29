import { normalizeSourceUrl } from "@/lib/source-url";

// Whole links, or a bare facebook.com / fb.com / fb.me / fb.watch address; trailing punctuation stays out.
const LINK = /((?:https?:\/\/|(?:www\.|m\.)?(?:facebook|fb)\.com\/|fb\.(?:me|watch)\/)[^\s<>"']*[^\s<>"'.,;:!?)\]])/gi;

const POST_HOSTS = /(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch|instagram\.com|tiktok\.com|x\.com|twitter\.com)$/i;

/**
 * Text with the web links in it made clickable. Notes and contacts typed before the "ลิงก์โพสต์ต้นทาง"
 * field existed often hold a Facebook link as plain text; this makes those usable without touching the
 * stored data. Only http(s) links become anchors, so nothing else can be injected.
 */
export default function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(LINK).map((part, i) => {
        if (i % 2 === 0) return part;
        const href = normalizeSourceUrl(part);
        if (!href) return part;
        const host = new URL(href).hostname;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="font-semibold text-brand underline"
          >
            {POST_HOSTS.test(host) ? "ดูโพสต์ต้นทาง" : `เปิดลิงก์ (${host.replace(/^www\./, "")})`} ↗
          </a>
        );
      })}
    </>
  );
}
