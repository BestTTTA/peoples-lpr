import { getFile } from "@/lib/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[name]">) {
  const { name } = await ctx.params;
  if (!/^[0-9a-f-]{36}\.jpg$/.test(name)) return new Response("Not found", { status: 404 });
  const data = await getFile(name);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
