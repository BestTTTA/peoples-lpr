"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import CropEditor from "@/components/CropEditor";
import DevCredit from "@/components/DevCredit";
import LocationPicker, { type LatLng } from "@/components/LocationPicker";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import UploadGuide from "@/components/UploadGuide";
import { type Box, cropPlate, detectPlates, preparePhoto, rotateBox, rotatePhoto } from "@/lib/image";
import { MAX_PLATES } from "@/lib/limits";
import { postForm } from "@/lib/post";
import { reportPath } from "@/lib/urls";
import { clean, isValidNumber, isValidPrefix, numberProblem, prefixProblem, splitPlate } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import type { OcrResult, WatchMatch } from "@/lib/types";

/** AI detection state of a photo; undefined = not asked (manual mode). */
type Scan = "busy" | "found" | "whole" | "none" | "fail";

/** A photo this shape is already a close-up of one plate (detectors miss those). */
const plateShapedPhoto = (p: { width: number; height: number }) => {
  const r = p.width / p.height;
  return r >= 1.6 && r <= 5;
};

type Photo = {
  id: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  boxes: Box[];
  scan?: Scan;
  /** AI boxes the finder deleted: kept with the report as "not a plate" training data. */
  rejected?: Box[];
};

type CropMode = "auto" | "manual";

type Draft = {
  key: string;
  photo: number;
  /** Where the plate is in its photo (sent along as training data). */
  box: Box;
  crop: Blob;
  cropUrl: string;
  prefix: string;
  number: string;
  province: string;
  plateConf: number;
  provinceConf: number;
  /** The OCR text needed repair (stray digits, letters missing): likely wrong even if "confident". */
  suspect?: boolean;
  /** The finder looked at it (accepted or edited): uncertainty no longer flags it. */
  reviewed?: boolean;
  /** Left out of the report. */
  skipped?: boolean;
};

// Small requests: a dropped upload on mobile data then costs one retry of a few crops.
const OCR_BATCH = 8;
const MAX_PHOTOS = 10;
const PLATE_CONF_OK = 0.85;
const PROVINCE_CONF_OK = 0.6;

const STEPS = ["เลือกรูป & ตีกรอบ", "ตรวจสอบเลขป้าย", "ปักหมุด & ยืนยัน"];

export default function ReportFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  /** After submit: show matches first (owners who ฝากตามหา this plate), then
   * let the finder continue to the pin on the map. */
  const [success, setSuccess] = useState<{ reportId: string; matches: WatchMatch[] } | null>(null);
  /**
   * Review step, "ตรวจแก้ทีละป้าย": the plates that were yellow when it was
   * opened. A snapshot, so a plate stays on screen while it is being fixed
   * instead of vanishing the moment its reading becomes valid.
   */
  const [focusKeys, setFocusKeys] = useState<string[] | null>(null);
  const [mode, setMode] = useState<CropMode>("auto");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  function chooseMode(m: CropMode) {
    setMode(m);
    // Switching to auto: scan photos that have neither boxes nor a scan yet.
    if (m === "auto") photos.filter((p) => !p.scan && p.boxes.length === 0).forEach(scan);
  }

  function patchPhoto(id: string, patch: Partial<Photo>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  /** Ask the AI for plate boxes. Boxes the finder drew meanwhile are kept. */
  async function scan(p: Photo) {
    patchPhoto(p.id, { scan: "busy" });
    try {
      let found = await detectPlates(p);
      let scan: Scan = found.length ? "found" : "none";
      if (!found.length && plateShapedPhoto(p)) {
        found = [{ x: 0, y: 0, w: 1, h: 1, source: "whole" }];
        scan = "whole";
      }
      setPhotos((prev) =>
        prev.map((q) => (q.id !== p.id ? q : { ...q, scan, boxes: q.boxes.length ? q.boxes : found })),
      );
    } catch {
      patchPhoto(p.id, { scan: "fail" });
    }
  }

  const scanning = photos.some((p) => p.scan === "busy");
  const boxCount = photos.reduce((s, p) => s + p.boxes.length, 0);
  const current = photos[active];
  const offset = photos.slice(0, active).reduce((s, p) => s + p.boxes.length, 0);

  async function addFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setError(`อัปโหลดได้สูงสุด ${MAX_PHOTOS} รูปต่อครั้ง`);
    setBusy("กำลังเตรียมรูป…");
    setError("");
    try {
      const added: Photo[] = [];
      for (const f of files.slice(0, room)) {
        const p = await preparePhoto(f);
        added.push({ id: crypto.randomUUID(), ...p, url: URL.createObjectURL(p.blob), boxes: [] });
      }
      setPhotos((prev) => [...prev, ...added]);
      setActive(photos.length);
      if (mode === "auto") added.forEach(scan);
      if (files.length > room) setError(`รับไว้ ${room} รูปแรก (สูงสุด ${MAX_PHOTOS} รูป)`);
    } catch {
      setError("เปิดรูปไม่สำเร็จ ลองใช้ไฟล์ JPG หรือ PNG");
    } finally {
      setBusy("");
    }
  }

  function setBoxes(i: number, boxes: Box[]) {
    setPhotos((prev) => prev.map((p, j) => (j === i ? { ...p, boxes } : p)));
  }

  /** The finder changed the boxes: AI boxes they removed are remembered as rejected. */
  function editBoxes(i: number, boxes: Box[]) {
    setPhotos((prev) =>
      prev.map((p, j) => {
        if (j !== i) return p;
        const removed = p.boxes.filter((b) => b.source === "ai" && !boxes.includes(b));
        return { ...p, boxes, rejected: [...(p.rejected ?? []), ...removed] };
      }),
    );
  }

  /** Turn the photo 90° clockwise; drawn boxes turn with it. In AI mode, look again (upright plates detect better). */
  async function rotate(i: number) {
    const p = photos[i];
    if (!p || p.scan === "busy") return;
    setBusy("กำลังหมุนรูป…");
    try {
      const r = await rotatePhoto(p.blob);
      URL.revokeObjectURL(p.url);
      const turned: Photo = {
        ...p,
        ...r,
        url: URL.createObjectURL(r.blob),
        boxes: p.boxes.map(rotateBox),
        rejected: (p.rejected ?? []).map(rotateBox),
      };
      if (mode === "auto") {
        // A fresh look at the turned photo; earlier AI boxes no longer apply.
        turned.boxes = [];
        turned.rejected = [];
        turned.scan = undefined;
      }
      setPhotos((prev) => prev.map((q) => (q.id === p.id ? turned : q)));
      if (mode === "auto") scan(turned);
    } catch {
      setError("หมุนรูปไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(photos[i].url);
    setPhotos((prev) => prev.filter((_, j) => j !== i));
    setActive((a) => Math.max(0, a >= i ? a - 1 : a));
  }

  async function readPlates() {
    if (scanning) return setError("รอ AI หาป้ายให้เสร็จก่อน");
    if (boxCount === 0) return setError("ลากกรอบครอบป้ายอย่างน้อย 1 ป้าย");
    if (boxCount > MAX_PLATES) return setError(`ส่งได้สูงสุด ${MAX_PLATES} ป้ายต่อครั้ง`);
    setError("");
    setBusy("กำลังตัดรูปป้าย…");
    drafts.forEach((d) => URL.revokeObjectURL(d.cropUrl));

    const next: Draft[] = [];
    for (const [pi, p] of photos.entries())
      for (const b of p.boxes) {
        const crop = await cropPlate(p.blob, b);
        next.push({
          key: crypto.randomUUID(),
          photo: pi,
          box: b,
          crop,
          cropUrl: URL.createObjectURL(crop),
          prefix: "",
          number: "",
          province: "",
          plateConf: 0,
          provinceConf: 0,
        });
      }

    setBusy(`กำลังอ่านป้ายทะเบียน ${next.length} ป้าย…`);
    // Each batch stands alone: if one fails, the others still get read.
    let failed = 0;
    let lastError = "";
    for (let i = 0; i < next.length; i += OCR_BATCH) {
      const chunk = next.slice(i, i + OCR_BATCH);
      const form = new FormData();
      chunk.forEach((d) => form.append("file", d.crop, "plate.jpg"));
      try {
        const data = await postForm<{ results: OcrResult[] }>("/api/ocr", form);
        data.results.forEach((r, j) => {
          const { prefix, number, suspect } = splitPlate(r.plate_number);
          Object.assign(chunk[j], {
            prefix,
            number,
            suspect,
            province: isProvince(r.province) ? r.province : "",
            plateConf: r.plate_confidence,
            provinceConf: r.province_confidence,
          });
        });
      } catch (err) {
        failed += chunk.length;
        lastError = err instanceof Error && err.message ? err.message : "อ่านป้ายไม่สำเร็จ";
      }
    }
    if (failed)
      setError(
        failed === next.length
          ? `${lastError} — กรอกข้อมูลเองได้ด้านล่าง`
          : `อ่านไม่สำเร็จ ${failed} จาก ${next.length} ป้าย (${lastError}) — กรอกป้ายที่ว่างเองได้ด้านล่าง`,
      );
    setDrafts(next);
    setBusy("");
    setStep(1);
  }

  // Editing is not reviewing: a plate is only done when the finder says so ("ถูกต้องแล้ว").
  function editDraft(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  // The province may be left out ("ไม่ระบุจังหวัด") when the plate doesn't show it clearly.
  const draftValid = (d: Draft) =>
    isValidPrefix(d.prefix) && isValidNumber(d.number) && (d.province === "" || isProvince(d.province));
  const lowConf = (d: Draft) => d.plateConf < PLATE_CONF_OK || d.provinceConf < PROVINCE_CONF_OK;
  /** Yellow: incomplete, or the reader was unsure and nobody has looked yet. */
  const flagged = (d: Draft) =>
    !d.skipped && (!draftValid(d) || (!d.reviewed && (lowConf(d) || !!d.suspect || d.province === "")));
  const kept = drafts.filter((d) => !d.skipped);
  const flaggedCount = drafts.filter(flagged).length;
  const allValid = kept.length > 0 && kept.every(draftValid);

  /** Skip reviewing: keep complete readings as they are, leave out the incomplete ones, and go on. */
  function skipFlagged() {
    const next = drafts.map((d) => (flagged(d) ? (draftValid(d) ? { ...d, reviewed: true } : { ...d, skipped: true }) : d));
    setDrafts(next);
    setFocusKeys(null);
    if (next.some((d) => !d.skipped)) setStep(2);
    else setError("ไม่มีป้ายที่อ่านได้ครบ — แก้อย่างน้อย 1 ป้ายก่อน");
  }

  async function submit() {
    if (!consent) return setError("กรุณายินยอมให้เก็บและเผยแพร่ข้อมูลก่อนยืนยัน");
    if (!location) return setError("กรุณาปักหมุดตำแหน่งที่พบป้าย");
    setError("");
    setBusy("กำลังบันทึก…");
    // Only send photos that still have at least one plate, and re-index.
    const used = [...new Set(kept.map((d) => d.photo))].sort((a, b) => a - b);
    const form = new FormData();
    form.append(
      "meta",
      JSON.stringify({
        lat: location.lat,
        lng: location.lng,
        note: note.trim(),
        contact: contact.trim(),
        plates: kept.map((d) => ({
          prefix: clean(d.prefix),
          number: clean(d.number),
          province: d.province,
          photo: used.indexOf(d.photo),
          box: storedBox(d.box),
        })),
        // Training data for the plate detector: plates boxed but left out, and AI boxes deleted.
        extraBoxes: [
          ...drafts
            .filter((d) => d.skipped && used.includes(d.photo))
            .map((d) => ({ ...storedBox(d.box), photo: used.indexOf(d.photo), kind: "skipped" })),
          ...used.flatMap((pi, i) =>
            (photos[pi].rejected ?? []).map((b) => ({ ...storedBox(b), photo: i, kind: "rejected" })),
          ),
        ],
      }),
    );
    used.forEach((i) => form.append("photo", photos[i].blob, "photo.jpg"));
    kept.forEach((d) => form.append("crop", d.crop, "plate.jpg"));
    try {
      // One attempt only: a retry after a lost response could save the report twice.
      const data = await postForm<{ id: string; matches?: WatchMatch[] }>("/api/reports", form, 1);
      const matches = data.matches ?? [];
      if (matches.length === 0) {
        router.push(reportPath(data.id));
        return;
      }
      // Hold on the success screen so the finder can see the owner's contact
      // and the "ask for proof" note before moving to the map.
      setSuccess({ reportId: data.id, matches });
      setBusy("");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "บันทึกไม่สำเร็จ");
      setBusy("");
    }
  }

  if (success) {
    return (
      <ReportSuccess
        matches={success.matches}
        reportedPlates={kept.map((d) => ({ prefix: clean(d.prefix), number: clean(d.number), province: d.province }))}
        onContinue={() => router.push(reportPath(success.reportId))}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 pb-28">
      <div>
        <h1 className="text-xl font-bold">แจ้งพบป้ายทะเบียน</h1>
        <p className="text-sm text-ink-3">ช่วยให้เจ้าของป้ายตามหาเจอ — ใช้เวลาไม่ถึง 2 นาที</p>
      </div>

      <UploadGuide />

      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-xl px-2 py-2 text-center text-xs font-semibold sm:text-sm ${
              i === step ? "bg-brand text-white shadow" : i < step ? "bg-brand/10 text-brand" : "bg-surface text-ink-3 border border-line"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {error && <div className="rounded-xl border border-warn/50 bg-warn/10 px-4 py-2.5 text-sm">{error}</div>}

      {step === 0 && (
        <section className="card flex flex-col gap-3 p-4">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="วิธีครอบป้าย">
            {(
              [
                ["auto", "🤖 AI ครอปให้", "หาป้ายในรูปอัตโนมัติ"],
                ["manual", "✍️ ตีกรอบเอง", "ลากครอบทีละป้าย"],
              ] as const
            ).map(([m, label, sub]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => chooseMode(m)}
                className={`rounded-lg px-3 py-2 text-left ${mode === m ? "bg-brand text-white" : "text-ink-3 hover:text-ink"}`}
              >
                <span className="block text-sm font-semibold">{label}</span>
                <span className={`block text-xs ${mode === m ? "text-white/80" : ""}`}>{sub}</span>
              </button>
            ))}
          </div>

          {photos.length === 0 ? (
            <div
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line px-4 py-10 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
            >
              <div className="text-4xl">📷</div>
              <p className="font-semibold">ถ่ายรูปหรือเลือกรูปป้ายทะเบียนที่พบ</p>
              <p className="text-sm text-ink-3">รูปเดียวหลายป้ายได้ · เลือกได้สูงสุด {MAX_PHOTOS} รูป · ลากไฟล์มาวางได้</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className="btn-primary" onClick={() => cameraInput.current?.click()}>
                  ถ่ายรูป
                </button>
                <button type="button" className="btn-ghost" onClick={() => fileInput.current?.click()}>
                  เลือกจากเครื่อง
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <div key={p.id} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      className={`block overflow-hidden rounded-lg border-2 ${i === active ? "border-brand" : "border-transparent"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                      <img src={p.url} alt={`รูปที่ ${i + 1}`} className="h-16 w-20 object-cover" />
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
                      {p.scan === "busy" ? "AI…" : `${p.boxes.length} ป้าย`}
                    </span>
                    <button
                      type="button"
                      aria-label={`ลบรูปที่ ${i + 1}`}
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="grid h-16 w-20 shrink-0 place-items-center rounded-lg border-2 border-dashed border-line text-2xl text-ink-3"
                    aria-label="เพิ่มรูป"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-lg bg-violet/10 px-2 py-1 font-medium text-violet">
                  {mode === "manual"
                    ? "✍️ ลากครอบป้ายทีละป้ายบนรูป"
                    : current?.scan === "busy"
                      ? "🤖 AI กำลังหาป้ายในรูปนี้…"
                      : current?.scan === "whole"
                        ? "🤖 รูปนี้เป็นป้ายเดียวเต็มรูป — ใช้ทั้งรูปเป็น 1 ป้าย (แก้กรอบได้)"
                        : current?.scan === "none"
                        ? "🤖 AI หาป้ายไม่เจอ — ลากครอบเองได้"
                        : current?.scan === "fail"
                          ? "🤖 AI ใช้งานไม่ได้ตอนนี้ — ลากครอบเองได้"
                          : "🤖 ตรวจกรอบที่ AI ตีให้ · กด × ลบกรอบผิด · ลากเพิ่มป้ายที่ขาด"}
                </span>
                {mode === "auto" && current && current.scan !== "busy" && (
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-sm"
                    onClick={() => {
                      setBoxes(active, []);
                      scan({ ...current, boxes: [] });
                    }}
                  >
                    ให้ AI หาใหม่
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm"
                  title="หมุนรูปตามเข็มนาฬิกา 90°"
                  disabled={!!busy || current.scan === "busy"}
                  onClick={() => rotate(active)}
                >
                  ↻ หมุนรูป
                </button>
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => setBoxes(active, [...current.boxes, { x: 0, y: 0, w: 1, h: 1, source: "whole" }])}
                >
                  ทั้งรูปคือ 1 ป้าย
                </button>
                {current.boxes.length > 0 && (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => editBoxes(active, [])}>
                    ล้างกรอบในรูปนี้
                  </button>
                )}
              </div>

              {current && (
                <CropEditor
                  key={current.url}
                  src={current.url}
                  width={current.width}
                  height={current.height}
                  boxes={current.boxes}
                  numberOffset={offset}
                  onChange={(b) => editBoxes(active, b)}
                />
              )}
            </>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-ink-3">
            ตรวจสอบว่าตรงกับป้ายจริง แก้ไขได้ทุกช่อง · ช่อง<span className="mx-1 rounded bg-warn/20 px-1">สีเหลือง</span>
            คือระบบไม่แน่ใจ
          </p>
          {drafts.length === 0 && <div className="card p-4 text-sm">ไม่มีป้ายเหลืออยู่ — กลับไปตีกรอบใหม่</div>}
          {(flaggedCount > 0 || focusKeys) && (
            <div
              className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm ${
                flaggedCount > 0 ? "border-warn/50 bg-warn/10" : "border-emerald-500/50 bg-emerald-500/10"
              }`}
            >
              <span className="font-semibold">
                {flaggedCount > 0
                  ? focusKeys
                    ? `⚠️ เหลือ ${flaggedCount} ป้ายที่ต้องตรวจ`
                    : `⚠️ มี ${flaggedCount} ป้ายที่ระบบไม่แน่ใจ (สีเหลือง)`
                  : "✓ ตรวจครบแล้ว — กด “ถัดไป” ได้เลย"}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => setFocusKeys(focusKeys ? null : drafts.filter(flagged).map((d) => d.key))}
                >
                  {focusKeys ? "แสดงทุกป้าย" : "ตรวจแก้ทีละป้าย"}
                </button>
                {flaggedCount > 0 && (
                  <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={skipFlagged}>
                    ข้ามทั้งหมดแล้วไปต่อ
                  </button>
                )}
              </div>
              {flaggedCount > 0 && (
                <p className="w-full text-xs text-ink-3">
                  “ข้าม” = ใช้ค่าที่ระบบอ่านได้ตามเดิม (จังหวัดที่อ่านไม่ได้ส่งเป็น “ไม่ระบุจังหวัด”) ส่วนป้ายที่ไม่มีหมวดหรือเลขจะไม่ถูกส่ง
                </p>
              )}
            </div>
          )}
          {drafts.map((d, i) => {
            if (focusKeys && !focusKeys.includes(d.key)) return null;
            const done = !flagged(d) && !!d.reviewed;
            const lowPlate = (d.plateConf < PLATE_CONF_OK || !!d.suspect) && !d.reviewed;
            const prefixErr = prefixProblem(d.prefix);
            const numberErr = numberProblem(d.number);
            const lowProvince = d.provinceConf < PROVINCE_CONF_OK && !d.reviewed;
            if (d.skipped)
              return (
                <article key={d.key} className="card flex items-center gap-3 p-3 opacity-60">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                  <img src={d.cropUrl} alt={`ป้ายที่ ${i + 1}`} className="h-12 w-20 rounded object-contain" />
                  <span className="flex-1 text-sm">
                    ป้ายที่ {i + 1} · ข้ามแล้ว — ป้ายนี้จะไม่ถูกส่ง
                  </span>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-sm"
                    onClick={() => editDraft(d.key, { skipped: false, reviewed: false })}
                  >
                    นำกลับมา
                  </button>
                </article>
              );
            return (
              <article
                key={d.key}
                className={`card grid gap-3 p-3 sm:grid-cols-[220px_1fr] ${
                  flagged(d) ? "border-warn/60" : done ? "border-emerald-500/60" : ""
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="relative overflow-hidden rounded-lg bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                    <img src={d.cropUrl} alt={`ป้ายที่ ${i + 1}`} className="max-h-32 w-full object-contain" />
                    <span className="absolute top-1 left-1 rounded-md bg-brand px-1.5 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <PlateBadge prefix={clean(d.prefix)} number={d.number} province={d.province} size="sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm font-medium">
                      หมวดอักษร
                      <input
                        className={`field mt-1 ${prefixErr ? "border-red-500 bg-red-500/10" : lowPlate ? "border-warn bg-warn/10" : ""}`}
                        value={d.prefix}
                        maxLength={5}
                        placeholder="เช่น 3ฒน"
                        onChange={(e) => editDraft(d.key, { prefix: e.target.value })}
                      />
                      {prefixErr && <span className="mt-1 block text-xs font-normal text-red-400">{prefixErr}</span>}
                    </label>
                    <label className="text-sm font-medium">
                      เลขทะเบียน
                      <input
                        className={`field mt-1 ${numberErr ? "border-red-500 bg-red-500/10" : lowPlate ? "border-warn bg-warn/10" : ""}`}
                        value={d.number}
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="เช่น 5702"
                        onChange={(e) => editDraft(d.key, { number: e.target.value.replace(/\D/g, "") })}
                      />
                      {numberErr && <span className="mt-1 block text-xs font-normal text-red-400">{numberErr}</span>}
                    </label>
                  </div>
                  <label className="text-sm font-medium">
                    จังหวัด
                    <ProvinceInput
                      className={`mt-1 ${lowProvince || (!d.province && !d.reviewed) ? "[&_.field]:border-warn [&_.field]:bg-warn/10" : ""}`}
                      value={d.province}
                      onChange={(v) => editDraft(d.key, { province: v })}
                      emptyLabel="ไม่ระบุจังหวัด"
                    />
                    {!d.province && !d.reviewed && (
                      <span className="mt-1 block text-xs font-normal text-ink-3">
                        อ่านจังหวัดไม่ได้ — เลือกจากรายการ หรือกด “ถูกต้องแล้ว” เพื่อส่งแบบไม่ระบุจังหวัด
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2 text-xs text-ink-3">
                    <span>
                      ความมั่นใจ: เลข {Math.round(d.plateConf * 100)}% · จังหวัด {Math.round(d.provinceConf * 100)}%
                      {d.suspect && !d.reviewed && " · ระบบอ่านได้ไม่ครบรูปแบบ เทียบกับรูปอีกครั้ง"}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-red-400 hover:underline"
                      onClick={() => removeDraft(d.key)}
                    >
                      ลบป้ายนี้
                    </button>
                  </div>
                  {flagged(d) && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary px-3 py-1.5 text-sm"
                        disabled={!draftValid(d)}
                        onClick={() => editDraft(d.key, { reviewed: true })}
                      >
                        ✓ ถูกต้องแล้ว
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1.5 text-sm"
                        onClick={() => editDraft(d.key, { skipped: true })}
                      >
                        ข้ามป้ายนี้
                      </button>
                      {!draftValid(d) && (
                        <span className="self-center text-xs text-ink-3">แก้ช่องสีแดงก่อนจึงกด “ถูกต้องแล้ว” ได้</span>
                      )}
                    </div>
                  )}
                  {done && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      ✓ ตรวจแล้ว
                      <button
                        type="button"
                        className="text-xs text-ink-3 hover:text-ink"
                        onClick={() => editDraft(d.key, { reviewed: false })}
                      >
                        แก้อีกครั้ง
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {step === 2 && (
        <section className="card flex flex-col gap-4 p-4">
          <div>
            <h2 className="font-semibold">ตำแหน่งที่พบป้าย / จุดรับคืน</h2>
            <p className="text-sm text-ink-3">ผู้ค้นหาจะเห็นหมุดนี้บนแผนที่</p>
          </div>
          <LocationPicker value={location} onChange={setLocation} />
          <label className="text-sm font-medium">
            จุดรับคืน / หมายเหตุ <span className="font-normal text-ink-3">(แนะนำ)</span>
            <textarea
              className="field mt-1 min-h-20"
              maxLength={500}
              placeholder="เช่น ฝากไว้ที่ป้อมยามหน้าหมู่บ้าน, เก็บได้หลังน้ำลด"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            ช่องทางติดต่อ <span className="font-normal text-ink-3">(ไม่บังคับ — แสดงเฉพาะผู้ที่ค้นเจอป้ายตรงกัน)</span>
            <input
              className="field mt-1"
              maxLength={200}
              placeholder="เช่น Line ID หรือเบอร์โทร"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {drafts.map((d) => (
              <PlateBadge key={d.key} prefix={clean(d.prefix)} number={d.number} province={d.province} size="sm" />
            ))}
          </div>

          <label
            htmlFor="finder-consent"
            className={`flex gap-2 rounded-xl border p-3 text-sm transition ${
              consent ? "border-brand/50 bg-brand/5" : "border-warn/50 bg-warn/10"
            }`}
          >
            <input
              id="finder-consent"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="text-ink-3">
              <b className="text-ink">ความยินยอมในการเก็บและเผยแพร่ข้อมูล</b>
              <br />
              ยินยอมให้ <b className="text-ink">ป้ายทะเบียนหาย.com</b> จัดเก็บและประกาศข้อมูลที่กรอก
              (รูปป้าย, จุดที่พบ, ข้อความและช่องทางติดต่อถ้ามี) บนเว็บไซต์ เพื่อวัตถุประสงค์เดียวคือช่วยเจ้าของป้ายทะเบียนที่สูญหาย
              ให้ติดต่อขอรับคืน โดยไม่อนุญาตให้นำไปใช้ในวัตถุประสงค์อื่น
              <br />
              <span className="text-ink-3/80">
                จำเป็นต้องยินยอม จึงจะยืนยันขึ้นข้อมูลป้ายทะเบียนที่พบได้
              </span>
            </span>
          </label>
        </section>
      )}

      <DevCredit className="pt-4" />

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          {step > 0 && (
            <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => setStep(step - 1)}>
              ย้อนกลับ
            </button>
          )}
          <span className="min-w-0 truncate text-sm text-ink-3">
            {busy ||
              (step === 0
                ? `${photos.length} รูป · ${boxCount} ป้าย`
                : step === 1
                  ? kept.every(draftValid)
                    ? `${kept.length} ป้ายพร้อม${drafts.length > kept.length ? ` · ข้าม ${drafts.length - kept.length}` : ""}`
                    : `อีก ${kept.filter((d) => !draftValid(d)).length} ป้ายยังไม่ครบ — แก้ช่องสีแดง หรือกดข้าม`
                  : !consent
                    ? "ติ๊กยินยอมก่อนจึงจะยืนยันได้"
                    : location
                      ? "พร้อมยืนยัน"
                      : "ยังไม่ได้ปักหมุด")}
          </span>
          {step === 0 && (
            <button type="button" className="btn-primary ml-auto" disabled={!!busy || boxCount === 0} onClick={readPlates}>
              อ่านป้าย ({boxCount})
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn-primary ml-auto" disabled={!allValid} onClick={() => setStep(2)}>
              ถัดไป
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="btn-primary ml-auto"
              disabled={!!busy || !location || !consent}
              onClick={submit}
            >
              ยืนยันและขึ้นแผนที่
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A box as kept with the report (lib/boxes StoredBox). */
function storedBox(b: Box) {
  return {
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    source: b.source ?? "manual",
    ...(b.conf !== undefined ? { conf: b.conf } : {}),
    ...(b.rot ? { angle: b.rot.angle, pw: b.rot.w, ph: b.rot.h } : {}),
  };
}

/**
 * Shown after a report with at least one owner-side "ฝากตามหา" match. The
 * finder sees the owner's name + phone and the reminder to ask for proof of
 * ownership before handing the plate back. (Consent to publish was taken on
 * the previous step, so the match info is shown directly here.)
 */
function ReportSuccess({
  matches,
  reportedPlates,
  onContinue,
}: {
  matches: WatchMatch[];
  reportedPlates: { prefix: string; number: string; province: string }[];
  onContinue: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4 pb-24">
      <p className="text-sm text-emerald-400">
        ✓ บันทึกแล้ว · {reportedPlates.length} ป้ายขึ้นแผนที่ · มีเจ้าของตามหา{" "}
        <b>{matches.length}</b> คน
      </p>

      {matches.map((m) => (
        <section
          key={m.id}
          className="card flex flex-col gap-4 border-emerald-500/40 bg-emerald-500/5 p-5 sm:flex-row sm:items-stretch"
        >
          <div className="flex flex-col items-center justify-center gap-2 sm:border-r sm:border-emerald-500/20 sm:pr-5">
            <PlateBadge prefix={m.prefix} number={m.number} province={m.province} size="lg" />
            <span className="text-xs text-ink-3">ฝากไว้ {relativeTime(m.since)}</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            <div>
              <div className="text-xs text-ink-3">เจ้าของป้าย</div>
              <div className="text-lg font-bold">{m.name}</div>
            </div>
            <a
              href={`tel:${m.phone}`}
              className="btn-primary justify-start px-4 py-3 text-left text-lg sm:text-xl"
            >
              <span aria-hidden>📞</span>
              <span className="font-mono tracking-wide">{m.phone}</span>
            </a>
            <p className="text-xs text-ink-3">กดเพื่อโทร · ติดต่อเจ้าของเพื่อนัดส่งคืนได้เลย</p>
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
        <b className="block">⚠️ ก่อนส่งมอบป้ายทะเบียนคืน (ถ้าสะดวก)</b>
        โปรดขอดูหลักฐานการเป็นเจ้าของ เช่น รูปถ่าย บัตรประชาชน หรือสำเนาทะเบียนรถ
      </div>

      <button type="button" className="btn-ghost self-center" onClick={onContinue}>
        ไปที่จุดรับคืนบนแผนที่ →
      </button>
    </div>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.round(h / 24)} วันที่แล้ว`;
}
