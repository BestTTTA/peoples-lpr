"use client";

/**
 * POST a form to one of our API routes and return its JSON.
 *
 * Between the browser and the app sit Cloudflare and the tunnel; when an upload
 * drops (slow mobile data, a flaky connection) they answer with an HTML error
 * page, not our JSON. Those failures, and network errors, are retried; anything
 * else becomes an Error with a message fit to show the user.
 */
export async function postForm<T>(url: string, form: FormData, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", body: form });
    } catch {
      if (i < attempts) {
        await pause(i);
        continue;
      }
      throw new Error("เชื่อมต่อไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    }

    const isJson = res.headers.get("content-type")?.includes("application/json");
    if (isJson) {
      // Our own 502/503 means an upstream (e.g. the OCR API) hiccuped: retry too.
      if (res.status >= 502 && i < attempts) {
        await pause(i);
        continue;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      return data as T;
    }
    // Not from our API: a gateway error page. Worth another try.
    if (i < attempts && (res.status >= 500 || res.status === 408)) {
      await pause(i);
      continue;
    }
    throw new Error(
      res.status === 413
        ? "รูปใหญ่เกินไป ลองตีกรอบให้พอดีป้าย"
        : `อัปโหลดไม่สำเร็จ (${res.status}) สัญญาณอาจไม่เสถียร ลองใหม่อีกครั้ง`,
    );
  }
}

const pause = (attempt: number) => new Promise((r) => setTimeout(r, 1000 * attempt));
