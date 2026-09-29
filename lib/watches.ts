"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { PlateQuery } from "./urls";

/**
 * Plates this browser asked us to keep looking for ("ฝากตามหา"). They live in
 * localStorage only: there are no accounts, and nothing about the searcher is
 * sent anywhere. Storage can be blocked or cleared, so every access is guarded.
 */
export type Watch = PlateQuery & { since: string };

const KEY = "peoples-lpr:watches";
const MAX = 20;
const EVENT = "peoples-lpr:watches";

const same = (a: PlateQuery, b: PlateQuery) =>
  a.prefix === b.prefix && a.number === b.number && a.province === b.province;

function parse(raw: string): Watch[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((w) => w && w.prefix && w.number && typeof w.province === "string") : [];
  } catch {
    return [];
  }
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export const getWatches = (): Watch[] => parse(readRaw());

function save(list: Watch[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export const isWatched = (q: PlateQuery) => getWatches().some((w) => same(w, q));

/** False when the browser won't store it (private mode, blocked storage). */
export function addWatch(q: PlateQuery): boolean {
  if (isWatched(q)) return true;
  return save([...getWatches(), { prefix: q.prefix, number: q.number, province: q.province, since: new Date().toISOString() }]);
}

export function removeWatch(q: PlateQuery): void {
  save(getWatches().filter((w) => !same(w, q)));
}

/** Re-render on changes from this tab (our event) or another tab (storage event). */
export function onWatchesChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The watch list, kept current across components and tabs. Empty during server render. */
export function useWatches(): Watch[] {
  const raw = useSyncExternalStore(onWatchesChange, readRaw, () => "[]");
  return useMemo(() => parse(raw), [raw]);
}
