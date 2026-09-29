/** A Thai private-car plate drawn in CSS: letters+number on top, province below. */
export default function PlateBadge({
  prefix,
  number,
  province,
  size = "md",
  emptyProvince = "ไม่ระบุจังหวัด",
}: {
  prefix: string;
  number: string;
  province: string;
  size?: "sm" | "md" | "lg";
  /** Shown when there is no province: a plate reported without one, or a search across all. */
  emptyProvince?: string;
}) {
  const s = {
    sm: { box: "px-2 py-0.5 border", top: "text-sm", bottom: "text-[9px]" },
    md: { box: "px-3 py-1 border-2", top: "text-xl", bottom: "text-[11px]" },
    lg: { box: "px-5 py-2 border-[3px]", top: "text-4xl", bottom: "text-base" },
  }[size];
  return (
    <div className={`inline-flex flex-col items-center rounded-md border-plate bg-white leading-tight text-plate ${s.box}`}>
      <span className={`font-bold tracking-wide whitespace-nowrap ${s.top}`}>
        {prefix || "—"} {number || "—"}
      </span>
      <span className={`whitespace-nowrap ${s.bottom} ${province ? "" : "opacity-60"}`}>{province || emptyProvince}</span>
    </div>
  );
}
