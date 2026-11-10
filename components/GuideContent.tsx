"use client";

import Image from "next/image";
import Link from "next/link";
import GuideAccordion from "@/components/GuideAccordion";
import { useLanguage } from "@/components/LanguageProvider";
import PageBanner from "@/components/PageBanner";
import plateBroken from "@/image_ref/plate_bro1.png";
import plateFaded from "@/image_ref/plate_bro2.png";
import { guideSections, guideSources, type GuideBlock } from "@/lib/replacement-guide";

const EN: Record<string, string> = {
  "ค้นหาป้ายทะเบียนไม่เจอ ต้องทำอย่างไร?": "What should I do if I cannot find my plate?",
  "A. ตรวจสอบอีกครั้งก่อนดำเนินการ": "A. Check the details again first",
  "ตรวจสอบหมายเลขทะเบียนและหมวดอักษรว่ากรอกถูกต้องหรือไม่": "Check that the plate number and letters were entered correctly.",
  "ตรวจสอบจังหวัดของป้ายทะเบียน": "Check the province shown on the plate.",
  "ทดลองค้นหาอีกครั้ง เพราะอาจมีผู้แจ้งพบป้ายเพิ่มภายหลัง": "Search again later because someone may report the plate after your first search.",
  "ค้นหาและฝากหาป้ายทะเบียน": "Search for a plate or create an alert",
  "ใช้ระบบค้นหาเดิมของเว็บไซต์ เมื่อค้นหาแล้วยังไม่พบ ระบบจะเสนอทางเลือกฝากหาป้ายให้โดยอัตโนมัติ": "Use the website search. If no match is found, it will automatically offer the option to create a missing-plate alert.",
  "B. หากยังไม่พบป้าย สามารถขอป้ายใหม่ได้": "B. If it is still missing, you can request a replacement",
  "เจ้าของรถที่เข้าเกณฑ์สามารถยื่นคำขอแผ่นป้ายทะเบียนทดแทนกับสำนักงานขนส่ง โดยขั้นตอนทั่วไปมีดังนี้": "Eligible vehicle owners can request a replacement plate from a transport office. The general process is:",
  "เตรียมเอกสารสำหรับขอแผ่นป้ายทะเบียนใหม่": "Prepare the documents required for a replacement plate.",
  "ติดต่อสำนักงานขนส่งที่ให้บริการ": "Contact an office of the Department of Land Transport.",
  "ยื่นคำขอออกแผ่นป้ายทะเบียนทดแทน": "Submit a replacement-plate application.",
  "ชำระค่าธรรมเนียม": "Pay the applicable fees.",
  "รับแผ่นป้ายใหม่ตามขั้นตอนและวันที่สำนักงานขนส่งกำหนด": "Collect the new plate as instructed on the date set by the transport office.",
  "เอกสารและหลักฐานที่ควรเตรียม": "Documents and evidence to prepare",
  "ใบคู่มือจดทะเบียนรถฉบับจริง ตามหลักเกณฑ์ปกติ": "The original vehicle registration book, under the standard requirements.",
  "บัตรประจำตัวประชาชน หรือหลักฐานของบุคคล/นิติบุคคลที่เกี่ยวข้อง แล้วแต่กรณี": "An ID card or the relevant personal or legal-entity documents, as applicable.",
  "หนังสือมอบอำนาจ พร้อมหลักฐานของผู้มอบและผู้รับมอบอำนาจ หากให้ผู้อื่นดำเนินการแทน": "A power of attorney and identification for both parties if someone applies on the owner's behalf.",
  "กรณีป้ายสูญหายหรือถูกทำลาย สามารถบันทึกถ้อยคำประกอบคำขอต่อนายทะเบียน หรือใช้หลักฐานแจ้งความสูญหาย อย่างใดอย่างหนึ่งตามแนวทางของหน่วยงาน": "If the plate was lost or destroyed, provide either a statement to the registrar with the application or a police loss report, according to the agency's guidance.",
  "ค่าธรรมเนียมอ้างอิง": "Reference fees",
  "ค่าคำขอ 5 บาท และค่าแผ่นป้ายทะเบียน 100 บาทต่อแผ่น ควรตรวจสอบอัตราและวิธีชำระกับสำนักงานขนส่งอีกครั้งก่อนเดินทาง": "The reference fees are THB 5 for the application and THB 100 per plate. Confirm current rates and payment methods with the transport office before travelling.",
  "รถยนต์นั่งส่วนบุคคล รถยนต์บรรทุกส่วนบุคคล และรถจักรยานยนต์ส่วนบุคคลที่เข้าเกณฑ์ สามารถขอป้ายทดแทนที่สำนักงานขนส่งทั่วประเทศได้ตามแนวทางที่กรมการขนส่งทางบกประกาศ แต่การยื่นต่างสำนักงานใช้ได้กับป้ายปกติและป้ายที่เป็นที่นิยม (กราฟิก) โดยไม่รวมป้ายหมวดอักษรพิเศษ และต้องรับป้าย ณ สำนักงานที่ยื่นคำขอ": "Eligible private passenger cars, private trucks, and private motorcycles may request replacement plates at transport offices nationwide under DLT guidance. Filing outside the original office applies to standard and graphic plates, excludes special-letter plates, and the replacement must be collected from the office where the application was filed.",
  "ตรวจสอบก่อนยื่นคำขอ": "Check before applying",
  "เอกสาร สถานที่ยื่น และเงื่อนไขอาจต่างกันตามประเภทรถ สถานะทางทะเบียน หรือกรณีพิเศษ โปรดสอบถามสำนักงานขนส่งหรือสายด่วนกรมการขนส่งทางบก 1584 ก่อนดำเนินการ": "Documents, filing locations, and conditions may vary by vehicle type, registration status, or special circumstances. Contact a transport office or the DLT hotline at 1584 before proceeding.",
  "ป้ายทะเบียนแบบไหนที่ไม่ควรนำกลับมาใช้งาน?": "Which damaged plates should not be reused?",
  "การได้ป้ายคืนไม่ได้หมายความว่าจะนำกลับมาติดรถได้เสมอ ควรตรวจสอบว่าป้ายยังครบถ้วน ชัดเจน และไม่มีการดัดแปลง โดยเฉพาะกรณีต่อไปนี้": "Recovering a plate does not always mean it is safe or legal to reuse. Check that it is complete, legible, and unaltered, especially in these cases:",
  "ตัวอย่างป้ายทะเบียนที่หักและบิดงอจนเสียรูปทรง": "Example of a broken and severely bent license plate",
  "ทะเบียนหัก / งอ": "Broken or bent plate",
  "ตัวอย่างป้ายทะเบียนที่ตัวเลขและตัวอักษรซีดจางจนอ่านไม่ชัด": "Example of a plate with faded, illegible letters and numbers",
  "ทะเบียนซีด จาง": "Faded plate",
  "ป้ายทะเบียนแตกหรือหัก": "The plate is cracked or broken.",
  "ป้ายทะเบียนบิดงอหรือเสียรูปทรงอย่างรุนแรง": "The plate is severely bent or deformed.",
  "ตัวเลขหรือหมวดอักษรซีดจางจนอ่านไม่ชัด": "The numbers or letters are too faded to read clearly.",
  "สีหรือพื้นผิวป้ายลอกจนข้อมูลสำคัญไม่ชัดเจน": "Paint or surface damage makes important information unclear.",
  "ป้ายทะเบียนถูกดัดแปลง หรือมีส่วนสำคัญไม่ครบถ้วน": "The plate has been altered or important parts are missing.",
  "ป้ายที่ชำรุดยังต้องขอทดแทน": "A damaged plate still requires replacement",
  "ถึงแม้จะตามหาป้ายทะเบียนกลับมาได้ แต่หากป้ายชำรุดจนไม่สามารถใช้งานได้อย่างถูกต้อง ก็ยังจำเป็นต้องดำเนินการขอป้ายใหม่": "Even if a plate is recovered, a replacement is still required when damage prevents it from being used correctly.",
  "ตรวจสอบสภาพป้ายก่อนนำกลับไปติดตั้ง": "Inspect the plate before reinstalling it.",
  "หากป้ายชำรุดหรือลบเลือน ให้ติดต่อสำนักงานขนส่งเพื่อขอป้ายทดแทน": "If it is damaged or illegible, contact a transport office for a replacement.",
  "กรณีขอเปลี่ยนป้ายชำรุด ให้นำแผ่นป้ายเดิมไปคืนตามขั้นตอนและวันที่กำหนดรับป้ายใหม่": "When replacing a damaged plate, return the old plate according to the procedure and collection date provided.",
  "ไม่ควรทาสี เติมตัวอักษร แก้ไขหมายเลข หรือผลิตแผ่นป้ายขึ้นเอง": "Do not repaint, add lettering, alter numbers, or make a plate yourself.",
  "ไม่ติดป้ายทะเบียน มีความผิดอย่างไร?": "What are the consequences of driving without a plate?",
  "พระราชบัญญัติรถยนต์ พ.ศ. 2522 มาตรา 11 และมาตรา 60": "Motor Vehicle Act B.E. 2522 (1979), Sections 11 and 60",
  "มาตรา 11 กำหนดให้รถที่จดทะเบียนแล้วต้องมีและแสดงแผ่นป้ายและเครื่องหมายให้ครบถ้วนถูกต้องตามกฎกระทรวง หากเข้าข่ายฝ่าฝืน บทกำหนดโทษตามมาตรา 60 กำหนดค่าปรับสูงสุดไม่เกิน 2,000 บาท": "Section 11 requires registered vehicles to carry and display the prescribed plates and markings. A violation may be subject to a fine of up to THB 2,000 under Section 60.",
  "การไม่มีหรือแสดงป้ายไม่ถูกต้องทำให้ระบุตัวรถได้ยาก เพิ่มปัญหาเมื่อต้องตรวจสอบรถ ติดต่อเจ้าของ หรือพิสูจน์ข้อเท็จจริงเมื่อเกิดอุบัติเหตุ": "A missing or incorrectly displayed plate makes a vehicle harder to identify and can complicate inspections, contacting the owner, or establishing facts after an accident.",
  "แต่ละกรณีต้องพิจารณาแยกกัน": "Each situation must be considered separately",
  "ป้ายสูญหายโดยไม่ตั้งใจ: เจ้าของควรรีบยื่นคำขอป้ายทดแทนและปฏิบัติตามคำแนะนำของสำนักงานขนส่ง": "Accidental loss: the owner should promptly apply for a replacement and follow the transport office's instructions.",
  "จงใจถอดหรือไม่แสดงป้าย: อาจสะท้อนเจตนาและพฤติการณ์ที่ต่างจากเหตุสูญหายโดยไม่ตั้งใจ": "Intentional removal or concealment: this may show intent and circumstances different from accidental loss.",
  "ใช้แผ่นป้ายที่ไม่ถูกต้อง: อาจเกี่ยวข้องกับบทบัญญัติอื่นเพิ่มเติม ขึ้นอยู่กับว่าเป็นป้ายจริงของรถคันอื่น ป้ายที่ดัดแปลง หรือป้ายปลอม": "Using an incorrect plate: additional laws may apply depending on whether it is another vehicle's genuine plate, an altered plate, or a counterfeit.",
  "ระหว่างรอป้ายทดแทน": "While waiting for a replacement",
  "ใบเสร็จชำระเงินไม่ได้หมายความว่าอนุญาตให้ขับรถโดยไม่มีป้ายได้โดยอัตโนมัติในทุกกรณี ควรสอบถามสำนักงานขนส่งหรือสายด่วน 1584 ถึงแนวทางใช้รถชั่วคราวที่เหมาะกับกรณีของคุณ": "A payment receipt does not automatically authorize driving without a plate in every case. Ask the transport office or hotline 1584 about temporary use appropriate to your situation.",
  "การนำป้ายทะเบียนของผู้อื่นไป มีความผิดอย่างไร?": "What are the consequences of taking someone else's plate?",
  "A. การขโมยแผ่นป้ายทะเบียนของผู้อื่น": "A. Stealing another person's license plate",
  "ประมวลกฎหมายอาญา มาตรา 334": "Criminal Code, Section 334",
  "การเอาป้ายของผู้อื่นไปโดยทุจริตอาจเป็นความผิดฐานลักทรัพย์ มีโทษตามกฎหมายจำคุกไม่เกิน 3 ปี และปรับไม่เกิน 60,000 บาท ทั้งนี้ ความรับผิดจริงขึ้นอยู่กับข้อเท็จจริงและเจตนาในแต่ละคดี": "Dishonestly taking another person's plate may constitute theft, punishable by up to three years' imprisonment and a fine of up to THB 60,000. Actual liability depends on the facts and intent in each case.",
  "B. การเก็บป้ายทะเบียนที่พบได้แล้วไม่คืน": "B. Finding a plate and failing to return it",
  "ผู้ที่เก็บป้ายได้เพื่อแจ้งและส่งคืน ไม่ควรถูกเหมารวมว่าเป็นผู้ขโมย แต่หากรู้อยู่แล้วว่าเป็นทรัพย์ของผู้อื่นและกลับเบียดบังไว้โดยทุจริต อาจเข้าข่ายลักทรัพย์หรือยักยอกทรัพย์สินหายตามประมวลกฎหมายอาญา มาตรา 352 วรรคสอง ขึ้นอยู่กับข้อเท็จจริง การรับรู้ และเจตนา": "A person who finds a plate to report and return it should not be treated as a thief. However, knowingly and dishonestly keeping another person's property may amount to theft or misappropriation of lost property under Section 352, paragraph two, depending on the facts, knowledge, and intent.",
  "ทางที่เหมาะสมคือแจ้งการพบผ่านช่องทางที่ตรวจสอบได้ ประสานส่งคืนเจ้าของ หรือส่งมอบให้เจ้าหน้าที่ตำรวจโดยเร็ว ไม่ควรนำป้ายไปเก็บไว้ใช้เอง": "Report the find through a verifiable channel, arrange its return to the owner, or promptly hand it to the police. Do not keep it for personal use.",
  "C. การนำป้ายทะเบียนของรถคันอื่นมาใช้": "C. Using another vehicle's license plate",
  "พระราชบัญญัติรถยนต์ พ.ศ. 2522 มาตรา 67": "Motor Vehicle Act B.E. 2522 (1979), Section 67",
  "เครื่องหมายที่นายทะเบียนออกให้สำหรับรถคันหนึ่งไม่ควรนำไปใช้กับรถอีกคันหนึ่ง และไม่ควรใช้เครื่องหมายที่ออกให้แก่ผู้อื่น การพิจารณาความผิดและค่าปรับต้องอ้างอิงกฎหมายปัจจุบันและข้อเท็จจริงของกรณีนั้น": "A registration mark issued for one vehicle must not be used on another, and a mark issued to another person must not be used. Any offence and penalty must be assessed under current law and the facts of the case.",
  "การนำป้ายแท้ของรถคันอื่นมาติดรถ เป็นคนละกรณีกับการทำหรือใช้ป้ายปลอม หากเป็นป้ายปลอมอาจเกิดความรับผิดฐานปลอมหรือใช้เอกสารราชการปลอมตามประมวลกฎหมายอาญาเพิ่มเติม จึงไม่ควรรวมทุกกรณีเป็นความผิดแบบเดียวกัน": "Using another vehicle's genuine plate is different from making or using a counterfeit plate. A counterfeit may create additional liability for forging or using a forged official document, so these situations should not be treated as the same offence.",
  "ข้อควรจำ": "Remember",
  "พบป้ายทะเบียนของผู้อื่น ควรดำเนินการส่งคืนอย่างถูกต้อง ไม่ควรนำไปใช้กับรถของตนเองหรือยึดไว้เป็นทรัพย์สินส่วนตัว": "If you find someone else's plate, return it properly. Do not use it on your vehicle or keep it as personal property.",
  "กรมการขนส่งทางบก: แนวทางขอป้ายทดแทนและการยื่นทั่วประเทศ": "Department of Land Transport: replacement plates and nationwide applications",
  "ศูนย์รวมข้อมูลเพื่อติดต่อราชการ: ขั้นตอน เอกสาร และค่าธรรมเนียม": "Government Contact Center: procedure, documents, and fees",
  "สำนักงานกิจการยุติธรรม: รถไม่มีแผ่นป้ายทะเบียน": "Office of Justice Affairs: vehicles without license plates",
  "กรมการขนส่งทางบก: คำเตือนเรื่องป้ายทะเบียนไม่ถูกต้องหรือปลอม": "Department of Land Transport: warning about incorrect or counterfeit plates",
  "สำนักกฎหมาย กรมการขนส่งทางบก": "Legal Affairs Bureau, Department of Land Transport",
  "สำนักงานกิจการยุติธรรม: เก็บของผู้อื่นได้ต้องคืนหรือไม่": "Office of Justice Affairs: duty to return found property",
  "สำนักงานกิจการยุติธรรม: ความผิดฐานลักทรัพย์ มาตรา 334": "Office of Justice Affairs: theft under Section 334",
};

const calloutStyles = {
  info: "border-brand/25 bg-brand/5 text-ink",
  warning: "border-amber-400/40 bg-amber-50 text-amber-950",
  legal: "border-sky/35 bg-sky/10 text-ink",
} as const;

const guideImages = { plate_bro1: plateBroken, plate_bro2: plateFaded } as const;

function Block({ block, translate }: { block: GuideBlock; translate: (text: string) => string }) {
  if (block.type === "heading") return <h3 className="mt-6 text-base font-bold text-ink first:mt-0 sm:text-lg">{translate(block.text)}</h3>;
  if (block.type === "paragraph") return <p className="mt-3 leading-7 text-ink-3">{translate(block.text)}</p>;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return <List className={`mt-3 space-y-2 pl-6 leading-7 text-ink-3 ${block.ordered ? "list-decimal" : "list-disc"}`}>{block.items.map((item) => <li key={item}>{translate(item)}</li>)}</List>;
  }
  if (block.type === "imageGrid") {
    return <div className="mt-5 grid gap-4 sm:grid-cols-2">{block.images.map((item) => <figure key={item.src} className="overflow-hidden rounded-xl border border-line bg-surface-2"><div className="flex aspect-[16/10] items-center justify-center bg-white"><Image src={guideImages[item.src]} alt={translate(item.alt)} className="h-full w-full object-contain" sizes="(min-width: 640px) 384px, calc(100vw - 64px)" /></div><figcaption className="border-t border-line px-4 py-3 text-center text-sm font-semibold text-ink">{translate(item.caption)}</figcaption></figure>)}</div>;
  }
  if (block.type === "homeLink") {
    return <div className="mt-4 rounded-xl border border-brand/25 bg-brand/5 p-4"><p className="text-sm leading-6 text-ink-3">{translate(block.text)}</p><Link href="/" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{translate(block.label)}<span aria-hidden>→</span></Link></div>;
  }
  return <aside className={`mt-4 rounded-xl border-l-4 p-4 ${calloutStyles[block.tone]}`}><h4 className="font-bold">{translate(block.title)}</h4><p className="mt-1.5 leading-7 opacity-90">{translate(block.text)}</p></aside>;
}

export default function GuideContent() {
  const { locale, t } = useLanguage();
  const translate = (text: string) => t(text, EN[text]);

  return (
    <div className="min-h-full">
      <PageBanner title={t("วิธีขอป้ายทะเบียนใหม่", "How to replace a license plate")} subtitle={t("แนวทางเบื้องต้นเมื่อค้นหาป้ายไม่พบ ป้ายชำรุด หรือจำเป็นต้องขอแผ่นป้ายทดแทน", "Initial guidance when a plate cannot be found, is damaged, or needs to be replaced.")} width="max-w-4xl" />
      <div className="mx-auto w-full max-w-4xl px-4 pb-12">
        <section className="card -mt-8 relative z-10 p-5 sm:p-7" aria-labelledby="guide-introduction">
          <h2 id="guide-introduction" className="text-lg font-bold sm:text-xl">{t("เริ่มจากตรวจสอบข้อมูล แล้วเลือกวิธีที่เหมาะกับกรณีของคุณ", "Start by checking the details, then choose the approach that fits your situation")}</h2>
          <p className="mt-2 leading-7 text-ink-3">{t("คู่มือนี้สรุปขั้นตอนและข้อกฎหมายที่เกี่ยวข้องให้อ่านง่าย ไม่ใช่คำปรึกษากฎหมายเฉพาะกรณี เงื่อนไขจริงอาจต่างกันตามประเภทรถและสถานะทางทะเบียน", "This guide summarizes the relevant steps and laws in plain language. It is not case-specific legal advice, and actual requirements may vary by vehicle type and registration status.")}</p>
        </section>
        <section className="mt-5 space-y-3" aria-label={t("หัวข้อความรู้เกี่ยวกับป้ายทะเบียน", "License plate guidance topics")}>
          {guideSections.map((section, index) => <GuideAccordion key={`${locale}-${section.id}`} number={index + 1} title={translate(section.title)} open={index === 0}>{section.blocks.map((block, blockIndex) => <Block key={`${section.id}-${blockIndex}`} block={block} translate={translate} />)}</GuideAccordion>)}
        </section>
        <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5 sm:p-6" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="text-lg font-bold">{t("แหล่งอ้างอิง", "Sources")}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-3">{t("ข้อมูลจากหน่วยงานรัฐและแหล่งกฎหมาย โปรดตรวจสอบประกาศล่าสุดก่อนดำเนินการจริง", "Information is drawn from government agencies and legal sources. Check the latest official notices before taking action.")}</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{guideSources.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer" className="flex h-full items-start gap-2 rounded-lg px-2 py-2 text-brand underline decoration-brand/30 underline-offset-4 transition hover:bg-surface hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><span aria-hidden>↗</span><span>{translate(source.label)}</span><span className="sr-only"> {t("(เปิดในแท็บใหม่)", "(opens in a new tab)")}</span></a></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
