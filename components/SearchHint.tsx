/** Annotated plate showing which part goes in which search field. */
export default function SearchHint() {
  return (
    <details className="card group overflow-hidden" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] text-white">?</span>
        วิธีกรอกข้อมูลค้นหา
        <span className="ml-auto text-ink-3 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-line px-4 pt-3 pb-4">
        <div className="flex justify-center py-2">
          <div className="relative">
            <div className="flex flex-col items-center rounded-lg border-[3px] border-plate bg-white text-plate px-5 pt-1.5 pb-1 leading-tight">
              <div className="flex gap-2.5 text-3xl font-bold">
                <span className="rounded bg-violet/25 px-1 text-[#5b3fe0]">3ฒน</span>
                <span className="rounded bg-cyan/25 px-1 text-[#0b7fb0]">5702</span>
              </div>
              <span className="mt-0.5 rounded bg-warn/25 px-1 text-sm text-[#a86500]">กรุงเทพมหานคร</span>
            </div>
          </div>
        </div>
        <ol className="mt-2 space-y-1.5 text-sm">
          <li className="flex gap-2">
            <b className="w-4 text-violet">1</b>
            <span>
              <b>หมวดอักษร</b> — ตัวอักษรหน้าป้าย ถ้ามีเลขนำหน้าให้ใส่ด้วย เช่น <code>3ฒน</code>, <code>กพ</code>
            </span>
          </li>
          <li className="flex gap-2">
            <b className="w-4 text-cyan">2</b>
            <span>
              <b>เลขทะเบียน</b> — ตัวเลข 1–4 หลักท้ายป้าย เช่น <code>5702</code>
            </span>
          </li>
          <li className="flex gap-2">
            <b className="w-4 text-warn">3</b>
            <span>
              <b>จังหวัด</b> — บรรทัดล่างของป้าย พิมพ์บางส่วนได้ เช่น <code>กทม</code>
            </span>
          </li>
        </ol>
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-3">
          💡 ไม่ต้องเว้นวรรคหรือใส่ขีด · ถ้าไม่เจอ ระบบจะแนะนำป้ายที่ต่างกัน 1 ตัวอักษร (เผื่ออ่านผิด) ·
          บนแผนที่ซูมเข้าไปดูจุดที่มีคนพบป้ายใกล้คุณได้
        </p>
      </div>
    </details>
  );
}
