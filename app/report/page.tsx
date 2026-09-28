import type { Metadata } from "next";
import ReportFlow from "@/components/ReportFlow";
import { REPORT_PATH, href } from "@/lib/urls";

export const metadata: Metadata = {
  title: "แจ้งพบป้ายทะเบียน — ป้ายทะเบียนหาย.com",
  // Served at /แจ้งพบป้าย (see next.config.ts).
  alternates: { canonical: href(REPORT_PATH) },
};

export default function ReportPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <ReportFlow />
    </div>
  );
}
