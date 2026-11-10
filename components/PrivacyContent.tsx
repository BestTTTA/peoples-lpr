"use client";

import Link from "next/link";
import DevCredit from "@/components/DevCredit";
import { useLanguage } from "@/components/LanguageProvider";
import PageBanner from "@/components/PageBanner";

type Copy = { th: string; en: string };
type PrivacySection = Copy & { items: Copy[] };

const sections: PrivacySection[] = [
  {
    th: "ข้อมูลที่ทุกคนเห็นได้ (รายการป้ายที่พบและแผนที่)",
    en: "Information visible to everyone (found-plate list and map)",
    items: [
      { th: "เลขป้ายทะเบียน: หมวดอักษร เลขทะเบียน และจังหวัด", en: "License plate letters, number, and province." },
      { th: "จุดที่พบ (ชื่อสถานที่และตำแหน่งที่ผู้แจ้งปักหมุด) และเวลาที่แจ้ง ถ้าผู้แจ้งเลือกไม่ปักหมุด รายงานนั้นจะไม่มีตำแหน่งและไม่ขึ้นบนแผนที่", en: "The found location (place name and marker selected by the reporter) and report time. A report submitted without a marker has no coordinates and does not appear on the map." },
      { th: "รายการนี้ไม่แสดงรูปถ่ายและไม่แสดงช่องทางติดต่อของผู้แจ้ง", en: "The public list does not show photos or the reporter's contact details." },
    ],
  },
  {
    th: "ข้อมูลที่เห็นเมื่อค้นเจอป้ายตรงกัน",
    en: "Information shown for an exact plate match",
    items: [
      { th: "รูปป้ายที่ตัดแล้วและรูปเต็มที่ผู้แจ้งถ่าย จุดรับคืนหรือหมายเหตุ", en: "The cropped plate image, full submitted photo, and collection note." },
      { th: "ช่องทางติดต่อของผู้แจ้ง (เบอร์โทรหรือ LINE ID) ถ้าผู้แจ้งเลือกกรอก — ไม่บังคับ", en: "The reporter's phone number or LINE ID, when provided. This is optional." },
      { th: "ลิงก์โพสต์ต้นทาง (เช่น โพสต์ Facebook ที่ประกาศเจอป้าย) ถ้าผู้แจ้งเลือกกรอก — ไม่บังคับ ระบบรับเฉพาะลิงก์เว็บ และเปิดในแท็บใหม่เมื่อมีผู้กด", en: "An optional source-post link, such as a Facebook post announcing the plate. Only web links are accepted and they open in a new tab." },
      { th: "ผู้ที่ค้นเลขป้ายนั้นเจอจะเห็นข้อมูลชุดนี้ ผู้แจ้งจึงไม่ควรกรอกข้อมูลที่ไม่ต้องการให้เปิดเผย", en: "Anyone who finds that exact plate number can see this information. Reporters should not enter information they do not want disclosed." },
    ],
  },
  {
    th: "รูปภาพ",
    en: "Images",
    items: [
      { th: "ระบบย่อและเข้ารหัสรูปใหม่ในเครื่องของคุณก่อนอัปโหลด ซึ่งตัดข้อมูลแฝงในรูป (EXIF) รวมถึงพิกัด GPS ออก ตำแหน่งที่แสดงมาจากหมุดที่ผู้แจ้งปักเองเท่านั้น", en: "Images are resized and re-encoded on your device before upload. This removes embedded EXIF data, including GPS coordinates. Displayed locations come only from markers selected by reporters." },
      { th: "เก็บรูปเต็มและรูปป้ายที่ตัดแล้ว ใครมีลิงก์ของรูปก็เปิดดูได้", en: "Full photos and cropped plate images are stored. Anyone with an image link can open it." },
      { th: "รูปเต็มถูกส่งให้บริการตรวจจับป้ายบนเซิร์ฟเวอร์ของเรา และรูปป้ายที่ตัดแล้วถูกส่งให้บริการอ่านตัวอักษร (OCR)", en: "Full photos are sent to our plate-detection service, and cropped plate images are sent to the optical character recognition (OCR) service." },
      { th: "เก็บตำแหน่งกรอบป้ายและค่าที่ AI อ่านได้ไว้กับรายงาน เพื่อใช้ปรับปรุงการตรวจจับและการอ่านป้าย", en: "Plate-box coordinates and AI readings are stored with reports to improve plate detection and recognition." },
    ],
  },
  {
    th: "ฝากตามหา (สำหรับเจ้าของป้าย)",
    en: "Missing-plate alerts (for plate owners)",
    items: [
      { th: "เก็บชื่อ เบอร์โทร เลขป้ายที่ตามหา และเวลาที่ยินยอม", en: "We store the owner's name, phone number, plate details, and consent time." },
      { th: "ข้อมูลนี้ไม่แสดงบนเว็บและค้นหาไม่ได้ จะแสดงชื่อและเบอร์ให้เฉพาะผู้ที่แจ้งพบป้ายตรงกัน ในหน้าสรุปหลังส่งรายงานเท่านั้น", en: "This information is not publicly listed or searchable. The name and phone number are shown only to someone who reports the exact matching plate, on the post-submission summary." },
      { th: "รหัสจัดการรายการและโทเค็นสำหรับยกเลิก เก็บบนเซิร์ฟเวอร์เป็นค่า hash เท่านั้น", en: "Management codes and cancellation tokens are stored on the server only as hashes." },
      { th: "เมื่อยกเลิก ระบบจะไม่นำไปจับคู่อีก แต่ข้อมูลยังคงอยู่ในฐานข้อมูลในสถานะยกเลิก จนกว่าผู้ดูแลลบตามคำขอ", en: "Cancelled alerts are no longer matched, but remain in the database with a cancelled status until an administrator deletes them on request." },
      { th: "“ฝากตามหาแบบเตือนในเบราว์เซอร์นี้” เก็บไว้ในเครื่องคุณเท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์", en: "Browser-only alerts are stored only on your device and are not sent to the server." },
    ],
  },
  {
    th: "คำขอแจ้งปรับปรุงข้อมูลและแก้ไขเลขป้าย",
    en: "Information-update and plate-correction requests",
    items: [
      { th: "เก็บประเภทคำขอ ค่าที่ขอแก้ เวลา และผลการตรวจสอบของผู้ดูแล", en: "We store the request type, requested value, time, and administrator review result." },
      { th: "คำขอเหล่านี้ไม่เก็บชื่อหรือเบอร์ของผู้ส่งคำขอ", en: "These requests do not store the requester's name or phone number." },
      { th: "คำขอรีเซ็ตรหัสจัดการ เก็บชื่อและเบอร์โทรที่ผู้ขอกรอก เพื่อให้ผู้ดูแลตรวจสอบความถูกต้อง", en: "Management-code reset requests store the submitted name and phone number so an administrator can verify the request." },
    ],
  },
  {
    th: "หมายเลข IP",
    en: "IP addresses",
    items: [
      { th: "ไม่บันทึกหมายเลข IP ลงฐานข้อมูล", en: "IP addresses are not stored in the database." },
      { th: "เซิร์ฟเวอร์ใช้ IP ชั่วคราวในหน่วยความจำ เพื่อจำกัดจำนวนครั้งการใช้งานและกันการส่งซ้ำรัวๆ ค่านี้หายเมื่อหมดช่วงเวลาหรือเมื่อระบบรีสตาร์ท", en: "The server temporarily uses IP addresses in memory for rate limiting and duplicate-submission protection. They expire after the rate-limit period or when the service restarts." },
      { th: "ผู้ให้บริการเครือข่ายที่เว็บใช้ (Cloudflare) อาจบันทึกข้อมูลการเชื่อมต่อตามปกติของบริการ", en: "Cloudflare, our network provider, may retain connection data as part of its normal service." },
    ],
  },
  {
    th: "ข้อมูลที่เก็บในเครื่องของคุณ (localStorage)",
    en: "Information stored on your device (localStorage)",
    items: [
      { th: "รายการที่ฝากตามหา: ชื่อ เลขป้าย และรหัสสำหรับยกเลิกหรือจัดการ ใช้แสดงและยกเลิกรายการของคุณ", en: "Your alerts: name, plate details, and cancellation or management credentials used to display and manage your alerts." },
      { th: "การปิดแถบเตือนมิจฉาชีพ และการเปิดหน้าต้อนรับแล้วในรอบการเข้าชมนี้", en: "Whether the scam-warning banner was dismissed and whether the welcome dialog was shown during this visit." },
      { th: "ล้างได้ด้วยการลบข้อมูลเว็บไซต์ในการตั้งค่าเบราว์เซอร์", en: "You can clear this information by deleting the site's data in your browser settings." },
    ],
  },
  {
    th: "โฆษณาและการติดตามผู้ใช้",
    en: "Advertising and user tracking",
    items: [
      { th: "เว็บนี้ไม่มีโฆษณา", en: "This website has no advertising." },
      { th: "ไม่ติดตั้งเครื่องมือวิเคราะห์หรือติดตามพฤติกรรมผู้ใช้", en: "We do not install analytics or user-behavior tracking tools." },
    ],
  },
  {
    th: "ผู้ดูแลระบบ",
    en: "Administrators",
    items: [
      { th: "ผู้ดูแลเข้าสู่ระบบด้วยรหัสผ่านและ cookie เฉพาะผู้ดูแล ผู้ใช้ทั่วไปไม่ต้องสมัครหรือเข้าสู่ระบบ", en: "Administrators sign in with a password and administrator-only cookie. General users do not need an account or sign-in." },
      { th: "ผู้ดูแลเห็นข้อมูลทั้งหมดที่ระบบเก็บ รวมช่องทางติดต่อ เพื่อตรวจสอบคำขอและลบข้อมูลที่ไม่เหมาะสม", en: "Administrators can view all stored data, including contact details, to review requests and remove inappropriate content." },
    ],
  },
  {
    th: "บริการภายนอกที่ใช้",
    en: "External services",
    items: [
      { th: "ฐานข้อมูลและรูปภาพเก็บบนเซิร์ฟเวอร์ที่ผู้ดูแลเว็บเป็นผู้ดูแล", en: "The database and images are stored on servers managed by the website administrator." },
      { th: "Cloudflare: เส้นทางเข้าถึงเว็บไซต์", en: "Cloudflare routes access to the website." },
      { th: "OpenStreetMap (Nominatim): แปลงตำแหน่งที่ปักหมุดและคำค้นสถานที่เป็นชื่อสถานที่ โดยส่งพิกัดหรือคำค้นนั้นไป", en: "OpenStreetMap (Nominatim) converts selected coordinates and place searches into place names by receiving those coordinates or search terms." },
      { th: "OpenFreeMap: เบราว์เซอร์ของคุณดึงภาพแผนที่จากบริการนี้โดยตรงเมื่อเปิดแผนที่", en: "OpenFreeMap supplies map tiles directly to your browser when a map is opened." },
      { th: "บริการอ่านป้ายทะเบียน (OCR): รับเฉพาะรูปป้ายที่ตัดแล้ว", en: "The license-plate OCR service receives only cropped plate images." },
      { th: "Google Maps: เปิดก็ต่อเมื่อคุณกด “นำทาง” ซึ่งจะออกจากเว็บนี้ไปยังบริการของ Google", en: "Google Maps opens only when you select Directions, taking you away from this website to Google's service." },
      { th: "ลิงก์โพสต์ต้นทาง: เว็บของผู้อื่นที่ผู้แจ้งใส่ไว้ เมื่อคุณกดจะออกจากเว็บนี้ไป เราไม่ได้ควบคุมเนื้อหาและความเป็นส่วนตัวของเว็บนั้น", en: "Source-post links lead to third-party websites supplied by reporters. We do not control their content or privacy practices." },
    ],
  },
  {
    th: "ระยะเวลาเก็บและการลบข้อมูล",
    en: "Retention and deletion",
    items: [
      { th: "ระบบไม่ลบข้อมูลอัตโนมัติ รายงานและรูปจะอยู่จนกว่าผู้ดูแลลบ", en: "Data is not deleted automatically. Reports and images remain until an administrator deletes them." },
      { th: "เมื่อผู้ดูแลลบรายงาน รายการป้าย รูปเต็ม รูปป้าย และคำขอแก้ไขที่เกี่ยวข้องจะถูกลบด้วย", en: "Deleting a report also deletes its plate records, full photos, cropped images, and related correction requests." },
      { th: "ต้องการให้ลบรายงานหรือรายการฝากตามหาของคุณ ติดต่อเราได้ตามช่องทางด้านล่าง", en: "To request deletion of your report or missing-plate alert, contact us using the channels below." },
    ],
  },
];

export default function PrivacyContent() {
  const { t } = useLanguage();
  return (
    <div className="min-h-full">
      <PageBanner
        title={t("นโยบายการเก็บข้อมูล", "Privacy policy")}
        subtitle={t("รายการข้อมูลทั้งหมดที่ระบบเก็บ ใครเห็นได้ และเก็บไว้เพื่ออะไร", "All information the system stores, who can see it, and why it is retained")}
        width="max-w-4xl"
      />
      <div className="mx-auto w-full max-w-4xl px-4 pb-10">
        <div className="-mt-8 relative z-10 flex flex-col gap-3">
          {sections.map((section) => (
            <section key={section.th} className="card p-5 shadow-sm">
              <h2 className="text-base font-bold sm:text-lg">{t(section.th, section.en)}</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-7 text-ink-3">
                {section.items.map((item) => <li key={item.th}>{t(item.th, item.en)}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-5 text-center text-sm text-ink-3">
          {t("ปรับปรุงล่าสุด 20 ตุลาคม 2569 · ย้อนกลับไป", "Last updated October 20, 2026 · Return to")} {" "}
          <Link href="/" className="font-semibold text-brand underline">{t("หน้าแรก", "Home")}</Link>
        </p>
        <DevCredit className="pt-6" />
      </div>
    </div>
  );
}
