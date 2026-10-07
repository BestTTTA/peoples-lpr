import { denyUnlessAdmin } from "@/lib/admin";
import { clean } from "@/lib/plate";
import { listReports } from "@/lib/store";

const PAGE = 20;

/**
 * Admin: reports with everything (note, contact, photos, plates), newest first.
 * q matches plate text ("บว4617", "บว 4617", "4617"), province, place, note or contact.
 */
export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
  const plateQ = clean(q);

  const all = await listReports(true); // newest first, including reviewed inactive plates
  const hits = q
    ? all.filter(
        (r) =>
          r.plates.some((p) => (plateQ && `${p.prefix}${p.number}`.includes(plateQ)) || (p.province && p.province.includes(q))) ||
          [r.place ?? "", r.note, r.contact].some((t) => t.includes(q)),
      )
    : all;
  return Response.json({
    total: hits.length,
    page,
    pageSize: PAGE,
    reports: hits.slice(page * PAGE, (page + 1) * PAGE),
  });
}
