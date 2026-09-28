import { RECENCY, pinSvg, recencyOf } from "@/lib/recency";
import type { PublicReport } from "@/lib/types";

const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });

export function timeAgo(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins > -60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours > -24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

/** Round category badge (recency colour + plate glyph) that sits on a thumbnail corner. */
export function RecencyBadge({ createdAt, size = 22 }: { createdAt: string; size?: number }) {
  const { color, label } = RECENCY[recencyOf(createdAt)];
  return (
    <span
      title={label}
      className="absolute -right-1.5 -bottom-1.5 block"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: pinSvg(color, size) }}
    />
  );
}

/** List row for a found-plates pin: plate thumbnail, count, place, time. */
export default function ReportCard({
  report,
  active,
  onClick,
}: {
  report: PublicReport;
  active: boolean;
  onClick: () => void;
}) {
  const first = report.plates[0];
  const more = report.plates.length - 1;
  const prefixes = report.plates
    .slice(0, 3)
    .map((p) => `${p.prefix} ${p.number}`)
    .join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
        active ? "bg-surface-2" : "hover:bg-surface-2/60"
      }`}
    >
      <span className="relative shrink-0">
        <span className="grid h-[70px] w-[70px] place-items-center rounded-[3px] bg-[#34363b]">
          <span className="flex flex-col items-center rounded-[3px] border border-plate bg-white px-1.5 leading-tight text-plate">
            <b className="text-[12px] whitespace-nowrap">
              {first.prefix} {first.number}
            </b>
            <span className="max-w-[54px] truncate text-[7px]">{first.province}</span>
          </span>
          {more > 0 && (
            <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
              +{more}
            </span>
          )}
        </span>
        <RecencyBadge createdAt={report.createdAt} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">
          พบ {report.plates.length} ป้าย · {prefixes}
        </span>
        <span className="line-clamp-2 text-sm text-ink-3">
          {report.place || `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`}
        </span>
        <span className="block text-xs text-ink-3/80">{timeAgo(report.createdAt)}</span>
      </span>
    </button>
  );
}
