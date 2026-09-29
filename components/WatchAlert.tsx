"use client";
import { useEffect, useState } from "react";
import HitCard from "@/components/HitCard";
import PlateBadge from "@/components/PlateBadge";
import type { SearchHit } from "@/lib/types";
import { href, reportPath } from "@/lib/urls";
import { type Watch, getWatches, removeWatch } from "@/lib/watches";

type Found = { watch: Watch; hits: SearchHit[] };

/**
 * On every visit, re-checks the plates this browser asked us to look for
 * ("ฝากตามหา") and pops up the ones someone has since reported.
 * Closing keeps the watch (it reminds again next visit); "เลิกตามหา" drops it.
 */
export default function WatchAlert() {
  const [found, setFound] = useState<Found[]>([]);

  useEffect(() => {
    const watches = getWatches();
    if (watches.length === 0) return;
    let cancelled = false;
    Promise.all(
      watches.map(async (watch): Promise<Found | null> => {
        const q = new URLSearchParams({ prefix: watch.prefix, number: watch.number, province: watch.province });
        const res = await fetch(`/api/search?${q}`).catch(() => null);
        const data = res?.ok ? ((await res.json()) as { exact: SearchHit[] }) : null;
        return data?.exact.length ? { watch, hits: data.exact } : null;
      }),
    ).then((all) => {
      if (!cancelled) setFound(all.filter((f): f is Found => !!f));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!found.length) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFound([]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [found.length]);

  if (!found.length) return null;

  function stop(w: Watch) {
    removeWatch(w);
    setFound((prev) => prev.filter((f) => f.watch !== w));
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && setFound([])}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="watch-alert-title"
        className="card flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto p-4"
      >
        <div className="flex items-start gap-3">
          <div className="text-4xl leading-none">🎉</div>
          <div className="min-w-0 flex-1">
            <h2 id="watch-alert-title" className="text-lg font-bold text-emerald-400">
              พบป้ายที่คุณฝากตามหาแล้ว!
            </h2>
            <p className="text-sm text-ink-3">มีคนแจ้งพบป้ายที่คุณฝากไว้ ดูจุดรับคืนและช่องทางติดต่อด้านล่าง</p>
          </div>
          <button type="button" className="icon-btn shrink-0" aria-label="ปิด" onClick={() => setFound([])}>
            ✕
          </button>
        </div>

        {found.map(({ watch, hits }) => (
          <section key={`${watch.prefix}${watch.number}${watch.province}`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <PlateBadge prefix={watch.prefix} number={watch.number} province={watch.province} size="sm" emptyProvince="ทุกจังหวัด" />
              <button type="button" className="text-sm text-ink-3 hover:text-ink" onClick={() => stop(watch)}>
                ได้คืนแล้ว / เลิกตามหา
              </button>
            </div>
            {hits.map((h) => (
              <HitCard
                key={h.plate.id}
                hit={h}
                active={false}
                onShow={() => {
                  window.location.href = href(reportPath(h.report.id));
                }}
              />
            ))}
          </section>
        ))}

        <button type="button" className="btn-ghost" onClick={() => setFound([])}>
          ปิด (เตือนอีกครั้งเมื่อกลับมา)
        </button>
      </div>
    </div>
  );
}
