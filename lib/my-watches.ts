"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { PlateQuery } from "./urls";

/**
 * Server-side "ฝากตามหา" the owner made from this browser: each has an id and
 * a token stored only here, which lets the owner cancel their own entry
 * without an account. Nothing else is kept client-side — the name and phone
 * live on the server, so the owner must still see the match on the finder's
 * screen (or come back and search). Storage can be blocked or cleared, so
 * every access is guarded.
 */
export type MyWatch = PlateQuery & {
  id: string;
  token: string;
  managementCode?: string;
  since: string;
  name: string;
};

const KEY = "peoples-lpr:my-watches";
const MAX = 20;
const EVENT = "peoples-lpr:my-watches";

function parse(raw: string): MyWatch[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter(
          (w) => w && typeof w.id === "string" && typeof w.token === "string" && w.prefix && w.number && w.province,
        )
      : [];
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

export const getMyWatches = (): MyWatch[] => parse(readRaw());

function save(list: MyWatch[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function addMyWatch(w: MyWatch): boolean {
  return save([...getMyWatches().filter((x) => x.id !== w.id), w]);
}

export function removeMyWatch(id: string): void {
  save(getMyWatches().filter((w) => w.id !== id));
}

export function updateMyWatch(id: string, patch: Partial<Pick<MyWatch, "name" | "prefix" | "number" | "province">>): void {
  save(getMyWatches().map((w) => (w.id === id ? { ...w, ...patch } : w)));
}

function onChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useMyWatches(): MyWatch[] {
  const raw = useSyncExternalStore(onChange, readRaw, () => "[]");
  return useMemo(() => parse(raw), [raw]);
}
