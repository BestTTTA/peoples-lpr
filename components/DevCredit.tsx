import Image from "next/image";

/** "Developed by" credit for Thetigerteam Foundation Technology. */
export default function DevCredit({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-xs text-ink-3 ${className}`}>
      <span>พัฒนาโดย</span>
      <Image src="/thetigerteam.svg" alt="" width={22} height={23} className="rounded-sm" />
      <span className="font-semibold text-ink">Thetigerteam Foundation Technology</span>
    </div>
  );
}
