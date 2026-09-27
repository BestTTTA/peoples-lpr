"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { BRAND, createMap } from "@/lib/maps";

export type LatLng = { lat: number; lng: number };

/** Tap the map or drag the pin; or jump to the device's current position. */
export default function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const abort = new AbortController();
    let instance: MLMap | undefined;
    createMap(el.current!, abort.signal).then((created) => {
      if (!created) return;
      const { ml, map } = created;
      instance = map;
      const pin = new ml.Marker({ color: BRAND, draggable: true });
      pin.on("dragend", () => {
        const p = pin.getLngLat();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      map.on("click", (e) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      marker.current = pin;
      setMap(map);
    });
    return () => {
      abort.abort();
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map || !marker.current) return;
    if (!value) {
      marker.current.remove();
      return;
    }
    marker.current.setLngLat([value.lng, value.lat]).addTo(map);
  }, [map, value]);

  function locate() {
    if (!navigator.geolocation) {
      setGeoError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(p);
        map?.flyTo({ center: [p.lng, p.lat], zoom: 17 });
        setLocating(false);
      },
      () => {
        setGeoError("ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — แตะบนแผนที่เพื่อเลือกเองได้");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={locate} disabled={locating}>
          {locating ? "กำลังหาตำแหน่ง…" : "📍 ใช้ตำแหน่งปัจจุบัน"}
        </button>
        <span className="text-sm text-ink-3">หรือแตะบนแผนที่ / ลากหมุดเพื่อเลือกจุดเอง</span>
      </div>
      {geoError && <p className="text-sm text-warn">{geoError}</p>}
      <div className="relative h-[340px] overflow-hidden rounded-xl border border-line">
        <div className="absolute inset-0">
          <div ref={el} className="h-full w-full bg-[#45516e]" />
        </div>
      </div>
      <p className="text-xs text-ink-3">
        {value ? `ตำแหน่งที่เลือก: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "ยังไม่ได้ปักหมุด"}
      </p>
    </div>
  );
}
