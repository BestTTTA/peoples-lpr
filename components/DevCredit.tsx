import Image from "next/image";

/** Footer credits: powered by Solutionmania and Ray of Light, developed by Thetigerteam Foundation Technology. */
export default function DevCredit({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 text-xs text-ink-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span>powered by</span>
        <Image src="/solutionmania.png" alt="" width={20} height={20} className="rounded-full" />
        <span className="font-semibold text-cyan">Solutionmania</span>
        <span className="text-line">|</span>
        <Image src="/ray-of-light.png" alt="Ray of Light" width={84} height={36} />
      </div>
      <div className="flex items-center gap-2">
        <span>พัฒนาโดย</span>
        <Image src="/thetigerteam.svg" alt="" width={22} height={23} className="rounded-sm" />
        <span className="font-semibold text-ink">Thetigerteam Foundation Technology</span>
      </div>
    </div>
  );
}
