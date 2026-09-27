import FindView from "@/components/FindView";

export default async function Home({ searchParams }: PageProps<"/">) {
  // After a report is submitted we land here with ?report=&lat=&lng= to show it.
  const q = await searchParams;
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const id = typeof q.report === "string" ? q.report : null;
  const focus = id && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, reportIds: [id] } : null;
  return <FindView initialFocus={focus} />;
}
