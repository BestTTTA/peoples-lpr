"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) return router.refresh();
    const data = await res?.json().catch(() => ({}));
    setError(data?.error ?? "เข้าสู่ระบบไม่สำเร็จ");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-10 flex max-w-sm flex-col gap-3 p-5">
      <h1 className="text-lg font-bold">เข้าสู่ระบบผู้ดูแล</h1>
      <input
        className="field"
        type="password"
        autoComplete="current-password"
        placeholder="รหัสผ่าน"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary" disabled={busy || !password}>
        {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
