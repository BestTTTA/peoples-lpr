import type { Metadata } from "next";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminPanel from "@/components/admin/AdminPanel";
import { adminEnabled, isAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "ตั้งค่าระบบ — ป้ายทะเบียนหาย.com",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const body = !adminEnabled() ? (
    <div className="card mx-auto mt-10 max-w-md p-5 text-sm">
      <h1 className="mb-2 text-lg font-bold">หน้าตั้งค่ายังไม่เปิดใช้งาน</h1>
      <p className="text-ink-3">
        ตั้ง <code>ADMIN_PASSWORD</code> (อย่างน้อย 8 ตัวอักษร) ในไฟล์ <code>.env</code> ของเซิร์ฟเวอร์ แล้วรีสตาร์ตเว็บ
      </p>
    </div>
  ) : (await isAdmin()) ? (
    <AdminPanel />
  ) : (
    <AdminLogin />
  );
  return <div className="flex-1 overflow-y-auto">{body}</div>;
}
