import type { Metadata } from "next";
import PrivacyContent from "@/components/PrivacyContent";
import { PRIVACY_PATH, href } from "@/lib/urls";

export const metadata: Metadata = {
  title: "นโยบายการเก็บข้อมูล — ป้ายทะเบียนหาย.com",
  description: "ข้อมูลทั้งหมดที่ระบบเก็บ ใครเห็นได้ และเก็บไว้เพื่ออะไร",
  // Served at /นโยบายข้อมูล (see next.config.ts).
  alternates: { canonical: href(PRIVACY_PATH) },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
