"use client";
import { useRouter } from "next/navigation";
import ContactSettings from "@/components/admin/ContactSettings";
import LogoEditor from "@/components/admin/LogoEditor";
import ReportManager from "@/components/admin/ReportManager";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Candidate,
  DETECT_KEYS,
  DETECT_LIMITS,
  type DetectSettings,
  type ModelChoice,
  sanitizeDetect,
} from "@/lib/detect-config";

type Model = {
  id: string;
  name: string;
  uploadedAt: string | null;
  classes: Record<string, string> | null;
  size: number;
  loaded: boolean;
  builtin: boolean;
};

type TestResult = { ms: number; chosen: string | null; candidates: Candidate[] };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `ผิดพลาด (${res.status})`);
  return data as T;
}

/** Admin page: detector models (single or compare), settings, and live testing. */
export default function AdminPanel() {
  const router = useRouter();
  const [models, setModels] = useState<Model[] | null>(null);
  const [choice, setChoice] = useState<ModelChoice | null>(null);
  const [modelsError, setModelsError] = useState("");
  const [tab, setTab] = useState<"reports" | "ai" | "contact" | "brand">("reports");

  const loadModels = useCallback(() => {
    api<{ models: Model[]; choice: ModelChoice }>("/api/admin/models")
      .then((d) => {
        setModels(d.models);
        setChoice(d.choice);
        setModelsError("");
      })
      .catch((e) => setModelsError(e.message));
  }, []);
  useEffect(loadModels, [loadModels]);

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
  }

  const nameOf = (id: string) => models?.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ตั้งค่าระบบ</h1>
          <p className="text-sm text-ink-3">สำหรับผู้ดูแลเว็บเท่านั้น</p>
        </div>
        <button type="button" className="btn-ghost shrink-0 px-3 py-1.5 text-sm" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 sm:grid-cols-4" role="tablist">
        {(
          [
            ["reports", "เคสที่แจ้ง"],
            ["ai", "AI ครอปป้าย"],
            ["contact", "ช่องทางติดต่อ"],
            ["brand", "โลโก้"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-brand text-white" : "text-ink-3 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "reports" && <ReportManager />}
      {tab === "ai" && (
        <>
          <p className="text-sm text-ink-3">ค่าที่บันทึกมีผลกับการครอปอัตโนมัติของทุกคนภายใน ~10 วินาที</p>
          <Models models={models} choice={choice} error={modelsError} onChanged={loadModels} onChoice={setChoice} />
          <SettingsAndTest choice={choice} nameOf={nameOf} />
        </>
      )}
      {tab === "contact" && <ContactSettings />}
      {tab === "brand" && <LogoEditor />}
    </div>
  );
}

function Models({
  models,
  choice,
  error: loadError,
  onChanged,
  onChoice,
}: {
  models: Model[] | null;
  choice: ModelChoice | null;
  error: string;
  onChanged: () => void;
  onChoice: (c: ModelChoice) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function saveChoice(next: ModelChoice, label: string) {
    setBusy(label);
    setError("");
    try {
      const { choice } = await api<{ choice: ModelChoice }>("/api/admin/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      onChoice(choice);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function setMode(mode: ModelChoice["mode"]) {
    if (!choice || !models) return;
    if (mode === "single") return saveChoice({ ...choice, mode }, "mode");
    // Compare needs a second model: keep the old one, else the first other model.
    const exists = (id: string | null) => !!id && id !== choice.primary && models.some((m) => m.id === id);
    const second = exists(choice.compare) ? choice.compare : models.find((m) => m.id !== choice.primary)?.id;
    if (!second) return setError("ต้องมีอย่างน้อย 2 โมเดล — อัปโหลดโมเดลที่ 2 ก่อน");
    saveChoice({ ...choice, mode, compare: second }, "mode");
  }

  function setRole(id: string, role: "primary" | "compare") {
    if (!choice) return;
    let { primary, compare } = choice;
    if (role === "primary") {
      if (compare === id) compare = primary; // swap
      primary = id;
    } else {
      if (primary === id) primary = compare ?? primary; // swap
      compare = id;
    }
    saveChoice({ ...choice, primary, compare }, id);
  }

  async function remove(id: string) {
    if (!confirm("ลบโมเดลนี้?")) return;
    setBusy(id);
    setError("");
    try {
      await api(`/api/admin/models/${id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // XHR for upload progress; fetch has none.
  function upload() {
    if (!file) return;
    setError("");
    setProgress(0);
    const form = new FormData();
    form.append("file", file);
    form.append("name", name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/models");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
    xhr.onload = () => {
      setProgress(null);
      let data: { error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setFile(null);
        setName("");
        if (input.current) input.current.value = "";
        onChanged();
      } else setError(data.error ?? `อัปโหลดไม่สำเร็จ (${xhr.status})`);
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("อัปโหลดไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต");
    };
    xhr.send(form);
  }

  const compare = choice?.mode === "compare";

  return (
    <section className="card flex flex-col gap-3 p-4">
      <h2 className="font-bold">โมเดลตรวจจับป้าย</h2>

      {choice && (
        <div className="grid grid-cols-1 gap-1 rounded-xl bg-surface-2 p-1 sm:grid-cols-2" role="radiogroup">
          {(
            [
              ["single", "ใช้โมเดลเดียว", "ใช้ผลจากโมเดลหลักอย่างเดียว"],
              ["compare", "เปรียบเทียบ 2 โมเดล", "รันทั้งคู่ทุกรูป แล้วใช้ผลของโมเดลที่เจอป้ายมากกว่า"],
            ] as const
          ).map(([m, label, sub]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={choice.mode === m}
              disabled={!!busy}
              onClick={() => choice.mode !== m && setMode(m)}
              className={`rounded-lg px-3 py-2 text-left ${choice.mode === m ? "bg-brand text-white" : "text-ink-3 hover:text-ink"}`}
            >
              <span className="block text-sm font-semibold">{label}</span>
              <span className={`block text-xs ${choice.mode === m ? "text-white/80" : ""}`}>{sub}</span>
            </button>
          ))}
        </div>
      )}

      {(error || loadError) && <p className="text-sm text-red-400">{error || loadError}</p>}
      {!models && !loadError && <p className="text-sm text-ink-3">กำลังโหลด…</p>}

      <ul className="flex flex-col divide-y divide-line">
        {models?.map((m) => {
          const isPrimary = choice?.primary === m.id;
          const isCompare = compare && choice?.compare === m.id;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{m.name}</span>
                  {isPrimary && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
                      {compare ? "โมเดล A (หลัก)" : "ใช้งานอยู่"}
                    </span>
                  )}
                  {isCompare && (
                    <span className="rounded bg-cyan/20 px-1.5 py-0.5 text-xs text-cyan">โมเดล B (เปรียบเทียบ)</span>
                  )}
                </div>
                <div className="text-xs text-ink-3">
                  {m.id} · {mb(m.size)}
                  {m.uploadedAt && ` · อัปโหลด ${dateFmt.format(new Date(m.uploadedAt))}`}
                  {m.classes && ` · คลาส: ${Object.values(m.classes).join(", ")}`}
                </div>
              </div>
              {busy === m.id ? (
                <span className="text-sm text-ink-3">กำลังโหลดโมเดล…</span>
              ) : (
                <>
                  {!isPrimary && (
                    <button
                      type="button"
                      className="btn-primary px-3 py-1.5 text-sm"
                      disabled={!!busy}
                      onClick={() => setRole(m.id, "primary")}
                    >
                      {compare ? "ตั้งเป็น A" : "ใช้โมเดลนี้"}
                    </button>
                  )}
                  {compare && !isCompare && (
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-sm"
                      disabled={!!busy}
                      onClick={() => setRole(m.id, "compare")}
                    >
                      ตั้งเป็น B
                    </button>
                  )}
                  {!isPrimary && !isCompare && !m.builtin && (
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-sm"
                      disabled={!!busy}
                      onClick={() => remove(m.id)}
                    >
                      ลบ
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <h3 className="text-sm font-semibold">อัปโหลดโมเดลใหม่</h3>
        <p className="text-xs text-ink-3">
          ไฟล์ <code>.pt</code> ของ YOLO (ultralytics) แบบ detect ไม่เกิน 95 MB · ระบบจะทดลองโหลดก่อนเก็บ และยังไม่ใช้งานจนกว่าจะเลือก ·
          ⚠️ ไฟล์ .pt รันโค้ดได้ ใช้เฉพาะโมเดลจากแหล่งที่เชื่อถือได้
        </p>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            ref={input}
            type="file"
            accept=".pt"
            className="field md:flex-1"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <input
            className="field md:w-64"
            placeholder="ชื่อโมเดล (ไม่บังคับ)"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="btn-primary" disabled={!file || progress !== null} onClick={upload}>
            {progress === null ? "อัปโหลด" : progress < 1 ? `${Math.round(progress * 100)}%` : "กำลังตรวจโมเดล…"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SettingsAndTest({ choice, nameOf }: { choice: ModelChoice | null; nameOf: (id: string) => string }) {
  const [saved, setSaved] = useState<DetectSettings | null>(null);
  const [defaults, setDefaults] = useState<DetectSettings | null>(null);
  const [draft, setDraft] = useState<DetectSettings | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ settings: DetectSettings; defaults: DetectSettings }>("/api/admin/settings")
      .then(({ settings, defaults }) => {
        setSaved(settings);
        setDraft(settings);
        setDefaults(defaults);
      })
      .catch((e) => setError(e.message));
  }, []);

  const valid = draft ? sanitizeDetect(draft) : null;
  const dirty = !!draft && !!saved && DETECT_KEYS.some((k) => draft[k] !== saved[k]);

  async function save() {
    if (!valid) return;
    setError("");
    try {
      const { settings } = await api<{ settings: DetectSettings }>("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valid),
      });
      setSaved(settings);
      setDraft(settings);
      setStatus("บันทึกแล้ว");
      setTimeout(() => setStatus(""), 2500);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!draft) return <div className="card p-4 text-sm text-ink-3">{error || "กำลังโหลด…"}</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="card flex flex-col gap-4 p-4">
        <h2 className="font-bold">ค่าการตรวจจับ</h2>
        {DETECT_KEYS.map((k) => {
          const l = DETECT_LIMITS[k];
          return (
            <label key={k} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{l.label}</span>
                <input
                  type="number"
                  className="field w-24 px-2 py-1 text-right tabular-nums"
                  min={l.min}
                  max={l.max}
                  step={l.step}
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                />
              </span>
              <input
                type="range"
                min={l.min}
                max={l.max}
                step={l.step}
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                className="accent-[var(--color-brand)]"
              />
              <span className="text-xs text-ink-3">
                {l.hint}
                {defaults && ` · ค่าเริ่มต้น ${defaults[k]}`}
              </span>
            </label>
          );
        })}
        {!valid && <p className="text-sm text-warn">สัดส่วนต่ำสุดต้องน้อยกว่าสูงสุด</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={!valid || !dirty} onClick={save}>
            บันทึก
          </button>
          <button type="button" className="btn-ghost" disabled={!dirty} onClick={() => saved && setDraft(saved)}>
            ยกเลิก
          </button>
          {defaults && (
            <button type="button" className="btn-ghost" onClick={() => setDraft(defaults)}>
              ค่าเริ่มต้น
            </button>
          )}
          <span className="text-sm text-emerald-400">{status}</span>
          {dirty && !status && <span className="text-sm text-warn">ยังไม่ได้บันทึก</span>}
        </div>
      </section>
      <TestPanel settings={valid} choice={choice} nameOf={nameOf} />
    </div>
  );
}

/** Upload a photo and see what the model(s) find with the settings on screen. */
function TestPanel({
  settings,
  choice,
  nameOf,
}: {
  settings: DetectSettings | null;
  choice: ModelChoice | null;
  nameOf: (id: string) => string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const key = settings && choice ? JSON.stringify({ settings, choice }) : "";

  const run = useCallback(async (f: File, k: string) => {
    const { settings, choice } = JSON.parse(k);
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", f);
    form.append("settings", JSON.stringify(settings));
    form.append("models", JSON.stringify(choice));
    try {
      const r = await api<TestResult>("/api/admin/test", { method: "POST", body: form });
      setResult(r);
      setView(r.chosen);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  // Re-test as the settings or models change (debounced), so tuning is interactive.
  useEffect(() => {
    if (!file || !key) return;
    const t = setTimeout(() => run(file, key), 500);
    return () => clearTimeout(t);
  }, [file, key, run]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    setFile(f);
    setUrl(URL.createObjectURL(f));
    setSize(null);
    setResult(null);
  }

  const shown = result?.candidates.find((c) => c.model === view) ?? null;

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">ทดสอบกับรูป</h2>
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => input.current?.click()}>
          {file ? "เปลี่ยนรูป" : "เลือกรูป"}
        </button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {!file && (
        <p className="text-sm text-ink-3">
          เลือกรูปป้ายทะเบียน ระบบจะตีกรอบด้วยค่าทางซ้าย (ยังไม่ต้องบันทึก) และรันใหม่ทุกครั้งที่ปรับค่า
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-1.5">
          {result.candidates.map((c) => {
            const chosen = c.model === result.chosen;
            const dropped = c.raw.length - c.boxes.length;
            return (
              <button
                key={c.model}
                type="button"
                onClick={() => setView(c.model)}
                className={`flex flex-wrap items-center gap-x-2 rounded-lg border px-3 py-2 text-left text-sm ${
                  view === c.model ? "border-brand bg-brand/10" : "border-line"
                }`}
              >
                <span className="font-semibold">{nameOf(c.model)}</span>
                {c.error ? (
                  <span className="text-red-400">ผิดพลาด: {c.error}</span>
                ) : (
                  <>
                    <span className="text-emerald-400">ใช้ได้ {c.boxes.length} กรอบ</span>
                    {dropped > 0 && <span className="text-red-400">กรองทิ้ง {dropped}</span>}
                  </>
                )}
                {chosen && result.candidates.length > 1 && (
                  <span className="ml-auto rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
                    ✓ ระบบเลือกผลนี้
                  </span>
                )}
              </button>
            );
          })}
          <p className="text-xs text-ink-3">{result.ms} ms · แตะรายการเพื่อดูกรอบของแต่ละโมเดล</p>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {url && (
        <div className="relative self-start overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img
            src={url}
            alt="รูปทดสอบ"
            className={`block max-h-[70vh] max-w-full ${busy ? "opacity-60" : ""}`}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
          {size &&
            shown?.raw.map((b, i) => {
              const [x1, y1, x2, y2] = b.box;
              const kept = shown.boxes.some((k) => k.box.join() === b.box.join());
              return (
                <div
                  key={i}
                  className={`absolute border-2 ${kept ? "border-emerald-400" : "border-dashed border-red-500"}`}
                  style={{
                    left: `${(x1 / size.w) * 100}%`,
                    top: `${(y1 / size.h) * 100}%`,
                    width: `${((x2 - x1) / size.w) * 100}%`,
                    height: `${((y2 - y1) / size.h) * 100}%`,
                  }}
                >
                  <span
                    className={`absolute top-0 left-0 px-1 text-[10px] font-bold text-black ${
                      kept ? "bg-emerald-400" : "bg-red-500"
                    }`}
                  >
                    {b.conf.toFixed(2)}
                  </span>
                </div>
              );
            })}
        </div>
      )}
      {result && (
        <p className="text-xs text-ink-3">
          กรอบเขียว = ใช้ได้ · กรอบแดงประ = ถูกกรองทิ้งเพราะสัดส่วนไม่ใช่ป้าย · ตัวเลข = ความมั่นใจ
        </p>
      )}
    </section>
  );
}
