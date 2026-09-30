/** How-to for finders: photograph, box each plate, check the reading, pin. */

const PLATES = [
  ["บล 2124", "พระนครศรีอยุธยา"],
  ["3ฒน 5702", "กรุงเทพมหานคร"],
  ["4ขฌ 8580", "กรุงเทพมหานคร"],
  ["ผข 3372", "ราชบุรี"],
  ["2ฒท 5089", "กรุงเทพมหานคร"],
  ["กบ 2736", "เพชรบุรี"],
];

function Illustration() {
  // Photo of plates laid on a table, two already boxed, a third being drawn.
  return (
    <svg viewBox="0 0 300 170" className="w-full" role="img" aria-label="ตัวอย่างการตีกรอบป้ายทะเบียนในรูป">
      <rect width="300" height="170" rx="10" fill="#c62a2a" />
      <rect x="0" y="0" width="300" height="18" fill="#8b5a3c" opacity=".5" />
      {PLATES.map(([t, p], i) => {
        const x = 14 + (i % 3) * 94;
        const y = 34 + Math.floor(i / 3) * 64;
        return (
          <g key={i} transform={`rotate(${i % 2 ? 2 : -2} ${x + 42} ${y + 22})`}>
            <rect x={x} y={y} width="84" height="44" rx="4" fill="#f5f5f2" stroke="#222" strokeWidth="1.5" />
            <text x={x + 42} y={y + 22} textAnchor="middle" fontSize="13" fontWeight="700" fill={i % 3 === 0 ? "#1a7a3a" : "#1a5f3a"}>
              {t}
            </text>
            <text x={x + 42} y={y + 36} textAnchor="middle" fontSize="7" fill="#1a5f3a">
              {p}
            </text>
          </g>
        );
      })}
      {/* finished boxes */}
      {[
        [10, 29, 1],
        [104, 29, 2],
      ].map(([x, y, n]) => (
        <g key={n}>
          <rect x={x} y={y} width="92" height="54" rx="3" fill="#22b8f0" fillOpacity=".15" stroke="#22b8f0" strokeWidth="2.5" />
          <rect x={x} y={y} width="16" height="14" rx="2" fill="#2f8fe6" />
          <text x={x + 8} y={y + 11} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
            {n}
          </text>
        </g>
      ))}
      {/* box in progress */}
      <rect x="198" y="29" width="70" height="42" rx="3" fill="#fff" fillOpacity=".12" stroke="#fff" strokeWidth="2" strokeDasharray="5 3" />
      <path d="M268 71 l0 17 l5 -5 l4 8 l3 -1.5 l-4 -8 l7 0 z" fill="#fff" stroke="#2b3336" strokeWidth="1.2" />
    </svg>
  );
}

const STEPS = [
  {
    t: "ถ่ายรูปป้าย",
    d: "วางป้ายบนพื้นเรียบ ถ่ายจากด้านบนตรงๆ ให้ตัวอักษรชัด ไม่มีแสงสะท้อน — รูปเดียวหลายป้ายได้ หรือเลือกหลายรูปพร้อมกันก็ได้",
  },
  {
    t: "ครอบป้าย: AI อัตโนมัติ หรือลากเอง",
    d: "โหมด “AI ครอปให้” จะตีกรอบป้ายให้เอง ตรวจดูแล้วกด × ลบกรอบที่ผิด หรือลากเพิ่มป้ายที่ AI หาไม่เจอ · โหมด “ตีกรอบเอง” ลากนิ้ว/เมาส์ครอบทีละป้ายให้ติดทั้งเลขทะเบียนและชื่อจังหวัด ถ้ารูปมีป้ายเดียวเต็มรูป กด “ทั้งรูปคือ 1 ป้าย”",
  },
  {
    t: "ตรวจสอบผลการอ่าน",
    d: "ระบบอ่านเลขให้อัตโนมัติ แก้หมวดอักษร เลข และจังหวัดให้ตรงกับป้ายจริง ช่องที่ขึ้นสีเหลือง = ระบบไม่แน่ใจ ควรเช็คให้ดี",
  },
  {
    t: "ปักหมุดแล้วยืนยัน",
    d: "ใช้ตำแหน่งปัจจุบันหรือแตะแผนที่เลือกจุดที่ป้ายอยู่ ใส่จุดรับคืน/ช่องทางติดต่อ แล้วกดยืนยันเพื่อขึ้นแผนที่",
  },
];

export default function UploadGuide() {
  return (
    // Closed by default: the steps below already guide; this is for whoever wants more.
    <details className="group overflow-hidden rounded-xl open:border open:border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-1.5 text-sm text-ink-3 hover:text-ink group-open:px-4 group-open:py-3 group-open:font-semibold group-open:text-ink">
        <span className="grid h-5 w-5 place-items-center rounded-full border border-current text-[11px]">?</span>
        ดูวิธีถ่ายรูปและตีกรอบให้ได้ผลดี
        <span className="ml-auto text-ink-3 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="grid gap-4 border-t border-line p-4 md:grid-cols-[minmax(0,300px)_1fr]">
        <div className="flex flex-col gap-2">
          <Illustration />
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-emerald-300">
              <svg viewBox="0 0 100 50" className="mx-auto h-10">
                <rect x="14" y="10" width="72" height="32" rx="3" fill="#f5f5f2" stroke="#222" />
                <text x="50" y="27" textAnchor="middle" fontSize="11" fontWeight="700">กพ 8800</text>
                <text x="50" y="37" textAnchor="middle" fontSize="6">เชียงใหม่</text>
                <rect x="10" y="6" width="80" height="40" fill="none" stroke="#10b981" strokeWidth="2.5" />
              </svg>
              ✓ กรอบพอดีป้าย เห็นจังหวัด
            </div>
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-red-300">
              <svg viewBox="0 0 100 50" className="mx-auto h-10">
                <rect x="4" y="12" width="50" height="30" rx="3" fill="#f5f5f2" stroke="#222" />
                <rect x="58" y="12" width="50" height="30" rx="3" fill="#f5f5f2" stroke="#222" />
                <text x="29" y="28" textAnchor="middle" fontSize="9" fontWeight="700">กพ 88</text>
                <text x="80" y="28" textAnchor="middle" fontSize="9" fontWeight="700">บล 21</text>
                <rect x="20" y="4" width="62" height="24" fill="none" stroke="#ef4444" strokeWidth="2.5" />
              </svg>
              ✗ กรอบคร่อม 2 ป้าย / ตัดจังหวัด
            </div>
          </div>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold">{s.t}</div>
                <p className="text-sm text-ink-3">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
