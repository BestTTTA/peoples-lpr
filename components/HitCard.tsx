"use client";
import { useState } from "react";
import PhotoViewer from "@/components/PhotoViewer";
import PlateBadge from "@/components/PlateBadge";
import { RecencyBadge, timeAgo } from "@/components/ReportCard";
import type { SearchHit } from "@/lib/types";

/** A search match: plate photo, where it was found, pickup note and contact, and actions. */
export default function HitCard({ hit, active, onShow }: { hit: SearchHit; active: boolean; onShow: () => void }) {
  const { plate, report } = hit;
  const photo = report.photos[plate.photo];
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <article className={`flex flex-col gap-2 rounded-lg p-2 transition ${active ? "bg-surface-2" : ""}`}>
      <button type="button" onClick={onShow} className="flex items-center gap-3 text-left">
        <span className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served from our API */}
          <img
            src={`/api/files/${plate.crop}`}
            alt="รูปป้ายที่พบ"
            className="h-[70px] w-[96px] rounded-[3px] bg-black object-contain"
          />
          <RecencyBadge createdAt={report.createdAt} />
        </span>
        <span className="min-w-0 flex-1">
          <PlateBadge prefix={plate.prefix} number={plate.number} province={plate.province} size="sm" />
          <span className="mt-1 line-clamp-2 text-sm text-ink-3">
            {report.place || `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`}
          </span>
          <span className="block text-xs text-ink-3/80">พบ {timeAgo(report.createdAt)}</span>
        </span>
      </button>
      {(report.note || report.contact) && (
        <div className="rounded-lg border border-line px-3 py-2 text-sm">
          {report.note && (
            <p>
              <span className="text-ink-3">จุดรับคืน:</span> {report.note}
            </p>
          )}
          {report.contact && (
            <p>
              <span className="text-ink-3">ติดต่อ:</span> {report.contact}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={onShow}>
          📍 ดูบนแผนที่
        </button>
        <a
          className="btn-ghost px-3 py-1.5 text-sm"
          href={`https://www.google.com/maps/dir/?api=1&destination=${report.lat},${report.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          นำทาง
        </a>
        {photo && (
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setViewing(`/api/files/${photo}`)}>
            รูปเต็ม
          </button>
        )}
      </div>
      {viewing && <PhotoViewer src={viewing} alt="รูปที่ผู้แจ้งถ่ายไว้" onClose={() => setViewing(null)} />}
    </article>
  );
}
