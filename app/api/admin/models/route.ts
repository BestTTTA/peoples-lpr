import { denyUnlessAdmin } from "@/lib/admin";
import { cropFetch, relay } from "@/lib/crop-service";
import { sanitizeModels } from "@/lib/detect-config";
import { getModelChoice, saveModelChoice } from "@/lib/detect-settings";

// Cloudflare (free plan) refuses request bodies over 100 MB.
const MAX_BYTES = 95 * 1024 * 1024;

/** Models on the crop service, plus which ones the settings use. */
export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const res = await cropFetch("/models", { admin: true }).catch(() => null);
  if (!res?.ok) return res ? relay(res) : Response.json({ error: "เรียก crop service ไม่สำเร็จ" }, { status: 502 });
  const { models } = (await res.json()) as { models: { id: string }[] };
  return Response.json({ models, choice: await getModelChoice() });
}

export async function POST(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pt"))
    return Response.json({ error: "เลือกไฟล์โมเดล .pt" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "ไฟล์ใหญ่เกิน 95MB" }, { status: 413 });

  const upstream = new FormData();
  upstream.append("file", file, file.name);
  upstream.append("name", String(form.get("name") ?? ""));
  // Loading and test-running the model can take a while.
  const res = await cropFetch("/models", {
    method: "POST",
    body: upstream,
    admin: true,
    signal: AbortSignal.timeout(180_000),
  }).catch(() => null);
  return res ? relay(res) : Response.json({ error: "อัปโหลดไป crop service ไม่สำเร็จ" }, { status: 502 });
}

/** Set mode (single / compare) and the models. Each is loaded first, so a bad pick never goes live. */
export async function PUT(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const choice = sanitizeModels(await request.json().catch(() => null));
  if (!choice)
    return Response.json({ error: "เลือกโมเดลไม่ถูกต้อง (โหมดเปรียบเทียบต้องมี 2 โมเดลที่ต่างกัน)" }, { status: 400 });
  for (const id of [choice.primary, choice.compare].filter((x): x is string => !!x)) {
    const res = await cropFetch(`/models/${encodeURIComponent(id)}/load`, {
      method: "POST",
      admin: true,
      signal: AbortSignal.timeout(120_000),
    }).catch(() => null);
    if (!res?.ok) return res ? relay(res) : Response.json({ error: `โหลดโมเดล ${id} ไม่สำเร็จ` }, { status: 502 });
  }
  await saveModelChoice(choice);
  return Response.json({ choice });
}
