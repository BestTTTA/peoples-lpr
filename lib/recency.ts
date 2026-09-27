/** Marker category: how long ago the plates were found. */
export type Recency = "new" | "recent" | "old";

const DAY = 24 * 60 * 60 * 1000;

export const RECENCY: Record<Recency, { color: string; label: string }> = {
  new: { color: "#2fd08b", label: "ใหม่ ≤ 3 วัน" },
  recent: { color: "#45b8ea", label: "≤ 2 สัปดาห์" },
  old: { color: "#ec5b5b", label: "เก่ากว่า 2 สัปดาห์" },
};

export function recencyOf(createdAt: string, now = Date.now()): Recency {
  const age = now - new Date(createdAt).getTime();
  if (age <= 3 * DAY) return "new";
  if (age <= 14 * DAY) return "recent";
  return "old";
}

/** Black license-plate glyph on a coloured disc with a white ring, as SVG markup. */
export function pinSvg(color: string, size = 36): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
<circle cx="18" cy="18" r="16.5" fill="${color}" stroke="#fff" stroke-width="3"/>
<rect x="9" y="12" width="18" height="12" rx="2.2" fill="none" stroke="#111" stroke-width="2.2"/>
<path d="M12.5 16.3h11M12.5 20h7" stroke="#111" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}
