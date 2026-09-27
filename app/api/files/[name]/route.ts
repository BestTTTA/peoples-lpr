import { readFile } from "node:fs/promises";
import path from "node:path";
import { FILES_DIR } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[name]">) {
  const { name } = await ctx.params;
  if (!/^[0-9a-f-]{36}\.jpg$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(FILES_DIR, name));
    return new Response(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
