import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import GuideAccordion from "@/components/GuideAccordion";
import PageBanner from "@/components/PageBanner";
import plateBroken from "@/image_ref/plate_bro1.png";
import plateFaded from "@/image_ref/plate_bro2.png";
import { guideSections, guideSources, type GuideBlock } from "@/lib/replacement-guide";
import { REPLACEMENT_GUIDE_PATH, href } from "@/lib/urls";

export const metadata: Metadata = {
  title: "วิธีขอป้ายทะเบียนใหม่ — ป้ายทะเบียนหาย.com",
  description: "ขั้นตอนขอแผ่นป้ายทะเบียนทดแทน เอกสาร ค่าธรรมเนียม และข้อควรรู้เมื่อป้ายสูญหายหรือชำรุด",
  alternates: { canonical: href(REPLACEMENT_GUIDE_PATH) },
};

const calloutStyles = {
  info: "border-brand/25 bg-brand/5 text-ink",
  warning: "border-amber-400/40 bg-amber-50 text-amber-950",
  legal: "border-sky/35 bg-sky/10 text-ink",
} as const;

const guideImages = {
  plate_bro1: plateBroken,
  plate_bro2: plateFaded,
} as const;

function Block({ block }: { block: GuideBlock }) {
  if (block.type === "heading") return <h3 className="mt-6 text-base font-bold text-ink first:mt-0 sm:text-lg">{block.text}</h3>;
  if (block.type === "paragraph") return <p className="mt-3 leading-7 text-ink-3">{block.text}</p>;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List className={`mt-3 space-y-2 pl-6 leading-7 text-ink-3 ${block.ordered ? "list-decimal" : "list-disc"}`}>
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </List>
    );
  }
  if (block.type === "imageGrid") {
    return (
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {block.images.map((item) => (
          <figure key={item.src} className="overflow-hidden rounded-xl border border-line bg-surface-2">
            <div className="flex aspect-[16/10] items-center justify-center bg-white">
              <Image
                src={guideImages[item.src]}
                alt={item.alt}
                className="h-full w-full object-contain"
                sizes="(min-width: 640px) 384px, calc(100vw - 64px)"
              />
            </div>
            <figcaption className="border-t border-line px-4 py-3 text-center text-sm font-semibold text-ink">
              {item.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }
  if (block.type === "homeLink") {
    return (
      <div className="mt-4 rounded-xl border border-brand/25 bg-brand/5 p-4">
        <p className="text-sm leading-6 text-ink-3">{block.text}</p>
        <Link href="/" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {block.label}
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }
  return (
    <aside className={`mt-4 rounded-xl border-l-4 p-4 ${calloutStyles[block.tone]}`}>
      <h4 className="font-bold">{block.title}</h4>
      <p className="mt-1.5 leading-7 opacity-90">{block.text}</p>
    </aside>
  );
}

export default function ReplacementGuidePage() {
  return (
    <div className="min-h-full">
      <PageBanner
        title="วิธีขอป้ายทะเบียนใหม่"
        subtitle="แนวทางเบื้องต้นเมื่อค้นหาป้ายไม่พบ ป้ายชำรุด หรือจำเป็นต้องขอแผ่นป้ายทดแทน"
        width="max-w-4xl"
      />

      <div className="mx-auto w-full max-w-4xl px-4 pb-12">
        <section className="card -mt-8 relative z-10 p-5 sm:p-7" aria-labelledby="guide-introduction">
          <h2 id="guide-introduction" className="text-lg font-bold sm:text-xl">เริ่มจากตรวจสอบข้อมูล แล้วเลือกวิธีที่เหมาะกับกรณีของคุณ</h2>
          <p className="mt-2 leading-7 text-ink-3">
            คู่มือนี้สรุปขั้นตอนและข้อกฎหมายที่เกี่ยวข้องให้อ่านง่าย ไม่ใช่คำปรึกษากฎหมายเฉพาะกรณี เงื่อนไขจริงอาจต่างกันตามประเภทรถและสถานะทางทะเบียน
          </p>
        </section>

        <section className="mt-5 space-y-3" aria-label="หัวข้อความรู้เกี่ยวกับป้ายทะเบียน">
          {guideSections.map((section, index) => (
            <GuideAccordion key={section.id} number={index + 1} title={section.title} open={index === 0}>
              {section.blocks.map((block, blockIndex) => <Block key={`${section.id}-${blockIndex}`} block={block} />)}
            </GuideAccordion>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5 sm:p-6" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="text-lg font-bold">แหล่งอ้างอิง</h2>
          <p className="mt-1 text-sm leading-6 text-ink-3">ข้อมูลจากหน่วยงานรัฐและแหล่งกฎหมาย โปรดตรวจสอบประกาศล่าสุดก่อนดำเนินการจริง</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {guideSources.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full items-start gap-2 rounded-lg px-2 py-2 text-brand underline decoration-brand/30 underline-offset-4 transition hover:bg-surface hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span aria-hidden>↗</span>
                  <span>{source.label}</span>
                  <span className="sr-only"> (เปิดในแท็บใหม่)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
