"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Locale = "th" | "en";

const STORAGE_KEY = "peoples-lpr-language";

const ENGLISH: Record<string, string> = {
  "ป้ายของฉันหาย": "My plate is missing",
  "ป้ายหาย": "Missing plate",
  "รายการป้ายที่พบ": "Found plates",
  "รายการ": "Found",
  "ฉันเก็บป้ายได้": "I found a plate",
  "แจ้งพบ": "Report found",
  "วิธีขอป้ายทะเบียนใหม่": "Replace a plate",
  "ขอป้ายใหม่": "Replacement",
  "แนวทางเบื้องต้นเมื่อค้นหาป้ายไม่พบ ป้ายชำรุด หรือจำเป็นต้องขอแผ่นป้ายทดแทน": "Initial guidance when a plate cannot be found, is damaged, or needs to be replaced.",
  "ตามหาป้ายทะเบียนหาย": "Find a missing license plate",
  "เมนูหลัก": "Main menu",
  "เปลี่ยนภาษา": "Change language",
  "เว็บนี้ให้ใช้ฟรี": "This website is free",
  "ห้ามโอนเงินเด็ดขาด": "Never transfer money",
  "ดูรายละเอียด": "Details",
  "ซ่อน": "Hide",
  "ปิดคำเตือน": "Close warning",
  "ต้องการทำอะไร?": "What would you like to do?",
  "เลือกสิ่งที่ต้องการ ระบบจะพาไปขั้นตอนนั้นเลย": "Choose an option and we will take you straight to it.",
  "ค้นหาป้ายของฉัน": "Find my plate",
  "ป้ายหาย ดูว่ามีคนเก็บได้แล้วหรือยัง": "Check whether someone has found your missing plate.",
  "เก็บป้ายได้ ถ่ายรูปแจ้งให้เจ้าของมารับคืน": "Photograph a plate you found so its owner can collect it.",
  "หรือดูรายการป้ายที่มีคนแจ้งพบทั้งหมด": "Or browse all reported plates",
  "สำหรับเจ้าของป้ายที่ทำหล่นหรือสูญหาย": "For owners of lost or missing plates",
  "ค้นหาฟรี · ไม่เรียกเก็บเงิน": "Free search · no fees",
  "ป้ายของคุณหายใช่ไหม?": "Is your license plate missing?",
  "กรอกเลขทะเบียนเพื่อเช็กว่ามีผู้แจ้งพบแล้วหรือยัง ดูตำแหน่งบนแผนที่ และฝากตามหาไว้ได้": "Enter the plate number to see whether it has been reported, view the location, or leave a missing-plate alert.",
  "ทะเบียนรถ": "License plate",
  "จังหวัด": "Province",
  "หมวดอักษร": "Plate letters",
  "เลขทะเบียน": "Plate number",
  "ไม่บังคับ": "optional",
  "ทุกจังหวัด": "All provinces",
  "ไม่ระบุจังหวัด": "Province not specified",
  "ค้นหา": "Search",
  "กำลังค้นหา…": "Searching…",
  "กำลังโหลด…": "Loading…",
  "ค้นหาไม่สำเร็จ": "Search failed",
  "พิมพ์ติดกัน เว้นวรรค หรือใช้ขีดได้ เช่น 3ฒน5702, 3ฒน 5702": "Type continuously, with a space, or with a dash, e.g. 3ฒน5702 or 3ฒน 5702.",
  "กรอกทะเบียนให้ครบ: หมวดอักษรไทย 1–2 ตัว (มีเลขนำหน้าได้) แล้วตามด้วยเลข 1–4 หลัก เช่น 3ฒน 5702": "Enter a complete Thai plate: 1–2 Thai letters (an initial digit is allowed), followed by 1–4 digits, e.g. 3ฒน 5702.",
  "ส่วนนี้ใช้เมื่อป้ายของคุณหาย · พบหรือเก็บป้ายของผู้อื่นได้?": "This section is for your own missing plate · Found someone else’s plate?",
  "ไปแจ้งป้ายที่พบ →": "Report a found plate →",
  "ยังไม่พบป้ายนี้": "This plate has not been found yet",
  "ลองตรวจสอบหมวดอักษรและจังหวัดอีกครั้ง หรือฝากตามหาไว้ — มีผู้แจ้งพบป้ายเพิ่มขึ้นทุกวัน": "Check the letters and province again, or leave an alert — new plates are reported every day.",
  "ฝากตามหาป้ายนี้": "Create a missing-plate alert",
  "ป้ายที่ใกล้เคียง": "Similar plates",
  "อาจอ่านผิด 1 ตัว หรือจังหวัดคลาดเคลื่อน": "One character or the province may differ",
  "จุดพบ / จุดรับคืน": "Found / collection point",
  "นำทางด้วย Google Maps": "Directions with Google Maps",
  "ยังไม่มีข้อมูลป้ายทะเบียนนี้": "No information for this plate yet",
  "ยังไม่มีผู้แจ้งพบป้ายนี้ในระบบ": "No one has reported this plate yet.",
  "ค้นหาป้ายอื่น": "Search another plate",
  "คัดลอก": "Copy",
  "คัดลอกลิงก์ไว้ค้นหาอีกครั้ง": "Copy search link",
  "คัดลอกลิงก์แล้ว": "Link copied",
  "เลิกตามหา": "Stop alert",
  "ยกเลิก": "Cancel",
  "ปิด": "Close",
  "บันทึกรูป": "Save image",
  "แจ้งพบป้ายทะเบียน": "Report a found license plate",
  "ช่วยให้เจ้าของป้ายตามหาเจอ — ใช้เวลาไม่ถึง 2 นาที": "Help its owner find it — takes less than 2 minutes.",
  "เลือกรูป & ตีกรอบ": "Select & crop",
  "ตรวจสอบเลขป้าย": "Check plate number",
  "ปักหมุด & ยืนยัน": "Location & confirm",
  "AI ครอปให้": "AI crop",
  "หาป้ายในรูปอัตโนมัติ": "Automatically find plates in the photo",
  "ตีกรอบเอง": "Crop manually",
  "ลากครอบทีละป้าย": "Draw a box around each plate",
  "ถ่ายรูปหรือเลือกรูปป้ายทะเบียนที่พบ": "Take or select photos of the plates you found",
  "ถ่ายรูป": "Take photo",
  "เลือกจากเครื่อง": "Choose from device",
  "เพิ่มรูป": "Add photo",
  "ให้ AI หาใหม่": "Run AI again",
  "หมุนรูป": "Rotate photo",
  "ทั้งรูปคือ 1 ป้าย": "Use full photo as one plate",
  "ล้างกรอบในรูปนี้": "Clear boxes in this photo",
  "สีเหลือง": "yellow",
  "คือระบบไม่แน่ใจ": "means the system is uncertain.",
  "แสดงทุกป้าย": "Show all plates",
  "ตรวจแก้ทีละป้าย": "Review uncertain plates",
  "ข้ามทั้งหมดแล้วไปต่อ": "Skip all and continue",
  "นำกลับมา": "Restore",
  "ลบป้ายนี้": "Remove this plate",
  "ถูกต้องแล้ว": "Looks correct",
  "ข้ามป้ายนี้": "Skip this plate",
  "ตรวจแล้ว": "Reviewed",
  "แก้อีกครั้ง": "Edit again",
  "ตำแหน่งที่พบป้าย / จุดรับคืน": "Found location / collection point",
  "ผู้ค้นหาจะเห็นหมุดนี้บนแผนที่": "People searching for the plate will see this marker on the map.",
  "ไม่ปักหมุด": "No map marker",
  "จุดรับคืน / หมายเหตุ": "Collection point / note",
  "แนะนำ": "recommended",
  "ช่องทางติดต่อ": "Contact details",
  "ลิงก์โพสต์ต้นทาง": "Original post link",
  "ความยินยอมในการเก็บและเผยแพร่ข้อมูล": "Consent to store and publish information",
  "ย้อนกลับ": "Back",
  "ถัดไป": "Next",
  "ยืนยันและบันทึก": "Confirm and save",
  "ยืนยันและขึ้นแผนที่": "Confirm and add to map",
  "ข้ามและยืนยัน": "Skip and confirm",
  "เพิ่มเบอร์": "Add contact",
  "ป้ายทะเบียนที่แจ้งพบ": "Reported license plates",
  "ป้ายที่แจ้งพบ": "Reported plates",
  "จุดที่พบ": "Locations",
  "แจ้งใหม่ ≤ 3 วัน": "New ≤ 3 days",
  "จังหวัดบนป้ายที่พบมากที่สุด": "Provinces with the most found plates",
  "ล่าสุด": "Newest",
  "ป้ายมากสุด": "Most plates",
  "ล้างตัวกรอง": "Clear filters",
  "ดูจุดรับคืนและช่องทางติดต่อ": "View collection point and contact details",
  "ดูบนแผนที่": "View on map",
  "นำทาง": "Directions",
  "ย่อ": "Collapse",
  "ไม่พบป้ายที่ตรงกับตัวกรอง": "No plates match these filters.",
  "ยังไม่มีผู้แจ้งพบป้าย": "No plates have been reported yet.",
  "จุดรับคืน:": "Collection point:",
  "ติดต่อ:": "Contact:",
  "โพสต์ต้นทาง:": "Original post:",
  "ดูโพสต์ต้นทาง ↗": "View original post ↗",
  "รูปเต็ม": "Full photo",
  "แจ้งปรับปรุงข้อมูล": "Request an information update",
  "ขอแก้ไขหมายเลขป้าย": "Correct plate number",
  "ข้อมูลที่ต้องการแจ้ง": "Update type",
  "เลือกสถานะ": "Select status",
  "เจ้าของป้ายได้รับคืนแล้ว": "The owner has collected the plate",
  "ไม่พบป้าย ตามพิกัดที่แจ้ง": "Plate not found at the reported location",
  "ส่งคำขอปรับปรุง": "Submit update request",
  "ค่าปัจจุบัน:": "Current value:",
  "ส่งคำขอแก้ไข": "Submit correction",
  "กำลังส่งคำขอ…": "Submitting…",
  "แจ้งปรับปรุงข้อมูลไม่สำเร็จ": "Could not submit the information update",
  "ส่งคำขอปรับปรุงข้อมูลเรียบร้อยแล้ว กรุณารอผู้ดูแลตรวจสอบ": "Your information update was submitted. Please wait for an administrator to review it.",
  "ข้อมูลที่แก้ไขยังเหมือนเดิม": "The corrected details are unchanged",
  "แก้ไขหมายเลขป้ายไม่สำเร็จ": "Could not submit the plate-number correction",
  "ส่งคำขอแก้ไขหมายเลขป้ายเรียบร้อยแล้ว กรุณารอผู้ดูแลตรวจสอบ": "Your plate-number correction was submitted. Please wait for an administrator to review it.",
  "AI อ่านเดิม:": "Original AI reading:",
  "ข้อมูลก่อนแก้ล่าสุด:": "Previous value before correction:",
  "รูปที่ผู้แจ้งถ่ายไว้": "Photo provided by the reporter",
  "จัดการรายการฝากหาป้าย": "Manage missing-plate alerts",
  "ตรวจสอบรายการ": "Check alert",
  "ชื่อผู้ฝากตามหา": "Owner name",
  "เบอร์โทรติดต่อ": "Contact phone",
  "บันทึกการแก้ไข": "Save changes",
  "ใช้ข้อมูลป้ายอื่น": "Use another plate",
  "ติดต่อ Admin": "Contact admin",
  "ยื่นเรื่องขอเปลี่ยนรหัส": "Request a new code",
  "พบป้ายที่คุณฝากตามหาแล้ว!": "A plate from your alerts has been found!",
  "ได้คืนแล้ว / เลิกตามหา": "Collected / stop alert",
  "ปิด (เตือนอีกครั้งเมื่อกลับมา)": "Close (remind me next time)",
  "แหล่งอ้างอิง": "Sources",
  "นโยบายการเก็บข้อมูล": "Privacy policy",
  "หน้าแรก": "Home",
  "ปิดหน้าต่าง": "Close dialog",
  "เลือกรูป": "Choose image",
  "กำลังบันทึก…": "Saving…",
  "บันทึกไม่สำเร็จ": "Could not save",
  "ใส่หมวดอักษร": "Enter the plate letters",
  "มีตัวเลขต่อท้ายตัวอักษร — ตัวเลขชุดหลังให้ใส่ช่องเลขทะเบียน": "A number follows the letters — enter the trailing digits in the plate-number field",
  "ตัวอักษรเกิน 2 ตัว": "Use no more than 2 letters",
  "มีเลขนำหน้าได้แค่ 1 ตัว": "Only 1 leading digit is allowed",
  "หมวดอักษร เช่น กข, 1กข หรือเลข 2 หลักของรถบรรทุก/รถตู้": "Use letters such as กข or 1กข, or the 2-digit category for a truck or van",
  "ใส่เลขทะเบียน": "Enter the plate number",
  "เลขทะเบียน 1–4 หลัก": "Enter a 1–4 digit plate number",
  "กำลังเตรียมรูป…": "Preparing images…",
  "เปิดรูปไม่สำเร็จ ลองใช้ไฟล์ JPG หรือ PNG": "Could not open the image. Try a JPG or PNG file.",
  "กำลังหมุนรูป…": "Rotating image…",
  "หมุนรูปไม่สำเร็จ": "Could not rotate the image.",
  "รอ AI หาป้ายให้เสร็จก่อน": "Wait for AI plate detection to finish.",
  "ลากกรอบครอบป้ายอย่างน้อย 1 ป้าย": "Draw a box around at least one plate.",
  "กำลังตัดรูปป้าย…": "Cropping plates…",
  "อ่านป้ายไม่สำเร็จ": "Could not read the plate.",
  "อ่านป้ายไม่สำเร็จ ลองใหม่อีกครั้ง": "Could not read the plate. Please try again.",
  "ไม่มีป้ายที่อ่านได้ครบ — แก้อย่างน้อย 1 ป้ายก่อน": "No complete plate remains. Fix at least one plate before continuing.",
  "กรุณายินยอมให้เก็บและเผยแพร่ข้อมูลก่อนยืนยัน": "Consent to storing and publishing the information before confirming.",
  "กรุณาระบุจุดรับคืนเป็นข้อความ (อย่างน้อย 5 ตัวอักษร)": "Describe the collection point using at least 5 characters.",
  "กรุณาปักหมุดตำแหน่งที่พบป้าย": "Select the location where the plate was found.",
  "ลิงก์โพสต์ต้นทางต้องเป็นลิงก์เว็บ เช่น https://facebook.com/…": "The source post must be a web link, e.g. https://facebook.com/…",
  "ยกเลิกรายการไม่สำเร็จ": "Could not cancel the alert.",
  "ฝากตามหาไม่สำเร็จ": "Could not create the alert.",
  "ดำเนินการไม่สำเร็จ": "The operation could not be completed.",
  "ยกเลิกการตามหาป้ายเรียบร้อยแล้ว": "The missing-plate alert was cancelled.",
  "บันทึกการแก้ไขเรียบร้อยแล้ว": "Changes saved.",
  "ส่งคำขอเปลี่ยนรหัสไม่สำเร็จ": "Could not submit the code-change request.",
  "รายการนี้มีคำขอรออนุมัติอยู่แล้ว กรุณารอ Admin ตรวจสอบ": "This alert already has a pending request. Please wait for administrator review.",
  "ส่งคำขอเรียบร้อยแล้ว รหัสจะเปลี่ยนเมื่อ Admin อนุมัติ": "Request submitted. The code will change after administrator approval.",
  "พิมพ์ชื่อสถานที่อย่างน้อย 2 ตัวอักษร": "Enter at least 2 characters for the place name.",
  "ค้นหาสถานที่ไม่สำเร็จ ลองใหม่อีกครั้ง": "Place search failed. Please try again.",
  "ค้นหาสถานที่ไม่สำเร็จ": "Place search failed.",
  "อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง": "This device does not support location services.",
  "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — แตะบนแผนที่เพื่อเลือกเองได้": "Location access was denied — select a location on the map instead.",
};

const RULES: Array<[RegExp, string]> = [
  [/^พบป้ายของคุณ (\d+) รายการ$/, "Found $1 matching plate(s)"],
  [/^พบ (\d+) ป้าย จาก (\d+) จุด$/, "Found $1 plate(s) at $2 location(s)"],
  [/^ทั้งหมด (\d+) ป้าย จาก (\d+) จุด$/, "$1 plate(s) at $2 location(s) in total"],
  [/^แสดงทั้งหมด \((\d+) ป้าย\)$/, "Show all ($1 plates)"],
  [/^พบ (.+)$/, "Found $1"],
  [/^ฝากไว้ (.+)$/, "Created $1"],
  [/^(\d+) นาทีที่แล้ว$/, "$1 minutes ago"],
  [/^(\d+) ชั่วโมงที่แล้ว$/, "$1 hours ago"],
  [/^(\d+) วันที่แล้ว$/, "$1 days ago"],
  [/^รูปที่ (\d+)$/, "Photo $1"],
  [/^ป้ายที่ (\d+)$/, "Plate $1"],
  [/^(\d+) ป้าย$/, "$1 plate(s)"],
  [/^ลบรูปที่ (\d+)$/, "Remove photo $1"],
  [/^ลบกรอบที่ (\d+)$/, "Remove box $1"],
  [/^อัปโหลดได้สูงสุด (\d+) รูปต่อครั้ง$/, "You can upload up to $1 photos at a time."],
  [/^รับไว้ (\d+) รูปแรก \(สูงสุด (\d+) รูป\)$/, "Accepted the first $1 images (maximum $2)."],
  [/^ส่งได้สูงสุด (\d+) ป้ายต่อครั้ง$/, "You can submit up to $1 plates at a time."],
  [/^กำลังอ่านป้ายทะเบียน (\d+) ป้าย…$/, "Reading $1 plate(s)…"],
  [/^เหลือ (\d+) ป้ายที่ต้องตรวจ$/, "$1 plate(s) still need review"],
  [/^มี (\d+) ป้ายที่ระบบไม่แน่ใจ \(สีเหลือง\)$/, "$1 uncertain plate(s) (yellow)"],
  [/^อ่านไม่สำเร็จ (\d+) จาก (\d+) ป้าย \(.+\) — กรอกป้ายที่ว่างเองได้ด้านล่าง$/, "Could not read $1 of $2 plates. Fill in the blank plate details below."],
];

function englishFor(source: string) {
  const trimmed = source.trim();
  const direct = ENGLISH[trimmed];
  if (direct) return source.replace(trimmed, direct);
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(trimmed)) return source.replace(trimmed, trimmed.replace(pattern, replacement));
  }
  return source;
}

type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (thai: string, english?: string) => string };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("th");
  const textOriginals = useRef(new WeakMap<Node, string>());
  const textTranslations = useRef(new WeakMap<Node, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());
  const attributeTranslations = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial: Locale = saved === "en" || saved === "th" ? saved : navigator.language.toLowerCase().startsWith("th") ? "th" : "en";
    const timer = window.setTimeout(() => setLocaleState(initial), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  // This must be a layout effect. When the locale changes, React updates the
  // text rendered by t() during the same commit. A passive effect leaves the
  // previous locale's MutationObserver alive long enough to see those updates
  // and save them as source text, which produces a mixed-language page until
  // the next reload. Layout-effect cleanup disconnects the stale observer
  // before mutation callbacks run, then translates server-rendered text before
  // the browser paints the new locale.
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;

    const originals = textOriginals.current;
    const renderedTranslations = textTranslations.current;
    const savedAttributes = attributeOriginals.current;
    const renderedAttributeTranslations = attributeTranslations.current;
    const attributes = ["aria-label", "placeholder", "title", "alt"];

    const translateElement = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let current: Node | null = root;
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          const parent = current.parentElement;
          if (parent && !parent.closest("[data-no-translate]") && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
            const currentText = current.nodeValue ?? "";
            if (locale === "en") {
              // A value that is not our last translation came from React/API.
              // Keep it as the new source of truth even when it is only a
              // number, plate code, coordinate or other non-Thai text.
              if (renderedTranslations.get(current) !== currentText) {
                originals.set(current, currentText);
                const translated = englishFor(currentText);
                if (translated !== currentText) {
                  renderedTranslations.set(current, translated);
                  current.nodeValue = translated;
                } else {
                  renderedTranslations.delete(current);
                }
              }
            } else {
              const original = originals.get(current);
              if (renderedTranslations.get(current) === currentText && original !== undefined) {
                current.nodeValue = original;
              }
              renderedTranslations.delete(current);
            }
          }
        } else if (current instanceof Element && !current.closest("[data-no-translate]")) {
          let saved = savedAttributes.get(current);
          if (!saved) {
            saved = new Map();
            savedAttributes.set(current, saved);
          }
          let rendered = renderedAttributeTranslations.get(current);
          if (!rendered) {
            rendered = new Map();
            renderedAttributeTranslations.set(current, rendered);
          }
          for (const attr of attributes) {
            const value = current.getAttribute(attr);
            if (value === null) continue;
            if (locale === "en") {
              // React may already have rendered an English value through t().
              // Only remember/replace attributes that were not produced by
              // this observer, otherwise English can become the saved source.
              if (rendered.get(attr) !== value) {
                saved.set(attr, value);
                const translated = englishFor(value);
                if (translated !== value) {
                  rendered.set(attr, translated);
                  current.setAttribute(attr, translated);
                } else {
                  rendered.delete(attr);
                }
              }
            } else {
              const original = saved.get(attr);
              // Restore only values that the observer itself translated. If
              // React just rendered Thai, leave that newer value untouched.
              if (rendered.get(attr) === value && original !== undefined) current.setAttribute(attr, original);
              rendered.delete(attr);
            }
          }
        }
        current = walker.nextNode();
      }
    };

    translateElement(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateElement(mutation.target);
        } else {
          mutation.addedNodes.forEach(translateElement);
        }
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  const t = useCallback((thai: string, english?: string) => (locale === "en" ? english ?? englishFor(thai).trim() : thai), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
