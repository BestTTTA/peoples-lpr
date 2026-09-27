"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import CropEditor from "@/components/CropEditor";
import DevCredit from "@/components/DevCredit";
import LocationPicker, { type LatLng } from "@/components/LocationPicker";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import UploadGuide from "@/components/UploadGuide";
import { type Box, cropPlate, detectPlates, preparePhoto } from "@/lib/image";
import { postForm } from "@/lib/post";
import { clean, isValidNumber, isValidPrefix, splitPlate } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import type { OcrResult } from "@/lib/types";

/** AI detection state of a photo; undefined = not asked (manual mode). */
type Scan = "busy" | "found" | "none" | "fail";

type Photo = { id: string; blob: Blob; url: string; width: number; height: number; boxes: Box[]; scan?: Scan };

type CropMode = "auto" | "manual";

type Draft = {
  key: string;
  photo: number;
  crop: Blob;
  cropUrl: string;
  prefix: string;
  number: string;
  province: string;
  plateConf: number;
  provinceConf: number;
};

// Small requests: a dropped upload on mobile data then costs one retry of a few crops.
const OCR_BATCH = 8;
const MAX_PHOTOS = 10;
const MAX_PLATES = 30;
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
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
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
      const found = await detectPlates(p);
      setPhotos((prev) =>
        prev.map((q) =>
          q.id !== p.id
            ? q
            : { ...q, scan: found.length ? "found" : "none", boxes: q.boxes.length ? q.boxes : found },
        ),
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
          const { prefix, number } = splitPlate(r.plate_number);
          Object.assign(chunk[j], {
            prefix,
            number,
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

  function editDraft(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  const draftValid = (d: Draft) => isValidPrefix(d.prefix) && isValidNumber(d.number) && isProvince(d.province);
  const allValid = drafts.length > 0 && drafts.every(draftValid);

  async function submit() {
    if (!location) return setError("กรุณาปักหมุดตำแหน่งที่พบป้าย");
    setError("");
    setBusy("กำลังบันทึก…");
    // Only send photos that still have at least one plate, and re-index.
    const used = [...new Set(drafts.map((d) => d.photo))].sort((a, b) => a - b);
    const form = new FormData();
    form.append(
      "meta",
      JSON.stringify({
        lat: location.lat,
        lng: location.lng,
        note: note.trim(),
        contact: contact.trim(),
        plates: drafts.map((d) => ({
          prefix: clean(d.prefix),
          number: clean(d.number),
          province: d.province,
          photo: used.indexOf(d.photo),
        })),
      }),
    );
    used.forEach((i) => form.append("photo", photos[i].blob, "photo.jpg"));
    drafts.forEach((d) => form.append("crop", d.crop, "plate.jpg"));
    try {
      // One attempt only: a retry after a lost response could save the report twice.
      const data = await postForm<{ id: string }>("/api/reports", form, 1);
      router.push(`/?report=${data.id}&lat=${location.lat}&lng=${location.lng}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "บันทึกไม่สำเร็จ");
      setBusy("");
    }
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
                  onClick={() => setBoxes(active, [...current.boxes, { x: 0, y: 0, w: 1, h: 1 }])}
                >
                  ทั้งรูปคือ 1 ป้าย
                </button>
                {current.boxes.length > 0 && (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setBoxes(active, [])}>
                    ล้างกรอบในรูปนี้
                  </button>
                )}
              </div>

              {current && (
                <CropEditor
                  key={current.id}
                  src={current.url}
                  width={current.width}
                  height={current.height}
                  boxes={current.boxes}
                  numberOffset={offset}
                  onChange={(b) => setBoxes(active, b)}
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
          {drafts.map((d, i) => {
            const lowPlate = d.plateConf < PLATE_CONF_OK;
            const lowProvince = d.provinceConf < PROVINCE_CONF_OK;
            return (
              <article key={d.key} className="card grid gap-3 p-3 sm:grid-cols-[220px_1fr]">
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
                        className={`field mt-1 ${lowPlate || !isValidPrefix(d.prefix) ? "border-warn bg-warn/10" : ""}`}
                        value={d.prefix}
                        maxLength={5}
                        placeholder="เช่น 3ฒน"
                        onChange={(e) => editDraft(d.key, { prefix: e.target.value })}
                      />
                    </label>
                    <label className="text-sm font-medium">
                      เลขทะเบียน
                      <input
                        className={`field mt-1 ${lowPlate || !isValidNumber(d.number) ? "border-warn bg-warn/10" : ""}`}
                        value={d.number}
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="เช่น 5702"
                        onChange={(e) => editDraft(d.key, { number: e.target.value.replace(/\D/g, "") })}
                      />
                    </label>
                  </div>
                  <label className="text-sm font-medium">
                    จังหวัด
                    <ProvinceInput
                      className={`mt-1 ${lowProvince || !d.province ? "[&_input]:border-warn [&_input]:bg-warn/10" : ""}`}
                      value={d.province}
                      onChange={(v) => editDraft(d.key, { province: v })}
                    />
                  </label>
                  <div className="flex items-center gap-2 text-xs text-ink-3">
                    <span>
                      ความมั่นใจ: เลข {Math.round(d.plateConf * 100)}% · จังหวัด {Math.round(d.provinceConf * 100)}%
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-red-400 hover:underline"
                      onClick={() => removeDraft(d.key)}
                    >
                      ลบป้ายนี้
                    </button>
                  </div>
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
                  ? `${drafts.filter(draftValid).length}/${drafts.length} ป้ายพร้อม`
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
            <button type="button" className="btn-primary ml-auto" disabled={!!busy || !location} onClick={submit}>
              ยืนยันและขึ้นแผนที่
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
