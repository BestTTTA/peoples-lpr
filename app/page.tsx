import type { Metadata } from "next";
import FindView from "@/components/FindView";
import { href, parsePlateSlug, reportPath, searchPath } from "@/lib/urls";

// Also serves /ค้นหา/<plate> (?plate=) and /จุดพบ/<id> (?report=), see next.config.ts.

const UUID = /^[0-9a-f-]{36}$/;

async function readParams(searchParams: PageProps<"/">["searchParams"]) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const plate = parsePlateSlug(one(q.plate));
  const report = one(q.report);
  return { q, plate, reportId: report && UUID.test(report) ? report : null };
}

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const { plate, reportId } = await readParams(searchParams);
  if (plate)
    return {
      title: `ตามหาป้าย ${plate.prefix} ${plate.number} ${plate.province || "ทุกจังหวัด"} — ป้ายทะเบียนหาย.com`,
      alternates: { canonical: href(searchPath(plate.prefix, plate.number, plate.province)) },
    };
  if (reportId)
    return {
      title: "จุดพบป้ายทะเบียน — ป้ายทะเบียนหาย.com",
      alternates: { canonical: href(reportPath(reportId)) },
    };
  return { alternates: { canonical: "/" } };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q, plate, reportId } = await readParams(searchParams);
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const focus = reportId
    ? { reportId, at: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null }
    : null;
  return <FindView initialReport={focus} initialSearch={plate} />;
}
