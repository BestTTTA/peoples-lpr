import type { Metadata } from "next";
import ReportFlow from "@/components/ReportFlow";

export const metadata: Metadata = {
  title: "แจ้งพบป้ายทะเบียน — Peoples LPR",
};

export default function ReportPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <ReportFlow />
    </div>
  );
}
