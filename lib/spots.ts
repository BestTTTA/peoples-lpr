import type { PublicReport } from "./types";

/**
 * Finders often send several reports from the same place (one per batch of
 * photos). Shown separately they stack on the map and repeat in lists, and the
 * counts stop adding up. A spot merges the reports within ~10 m into one.
 */
export type Spot = PublicReport & {
  /** Every report merged into this spot, newest first. The spot's own id is the newest. */
  reportIds: string[];
};

/** 4 decimals of lat/lng ≈ 11 m. */
const spotKey = (r: { lat: number; lng: number }) => `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;

/** Spots, newest first; each takes its place, time and position from its newest report. */
export function toSpots(reports: PublicReport[]): Spot[] {
  const bySpot = new Map<string, PublicReport[]>();
  for (const r of reports) {
    const k = spotKey(r);
    bySpot.set(k, [...(bySpot.get(k) ?? []), r]);
  }
  return [...bySpot.values()]
    .map((group) => {
      group.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const newest = group[0];
      return {
        ...newest,
        place: group.find((r) => r.place)?.place ?? "",
        plates: group.flatMap((r) => r.plates),
        reportIds: group.map((r) => r.id),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
