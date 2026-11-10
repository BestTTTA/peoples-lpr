import type { Metadata } from "next";
import GuideContent from "@/components/GuideContent";
import { REPLACEMENT_GUIDE_PATH, href } from "@/lib/urls";

export const metadata: Metadata = {
  title: "วิธีขอป้ายทะเบียนใหม่ — ป้ายทะเบียนหาย.com",
  description: "ขั้นตอนขอแผ่นป้ายทะเบียนทดแทน เอกสาร ค่าธรรมเนียม และข้อควรรู้เมื่อป้ายสูญหายหรือชำรุด",
  alternates: { canonical: href(REPLACEMENT_GUIDE_PATH) },
};

export default function ReplacementGuidePage() {
  return <GuideContent />;
}
