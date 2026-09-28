import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";
import { FOUND_PATH, href } from "@/lib/urls";

export const metadata: Metadata = {
  title: "ป้ายทะเบียนที่แจ้งพบ — ป้ายทะเบียนหาย.com",
  description: "รายการป้ายทะเบียนรถที่มีผู้แจ้งพบ แยกตามจุดที่พบ พร้อมจุดรับคืนและช่องทางติดต่อ",
  // Served at /ป้ายที่พบ (see next.config.ts).
  alternates: { canonical: href(FOUND_PATH) },
};

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <Dashboard />
    </div>
  );
}
