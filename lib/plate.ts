/** Strip spaces, dashes and dots so "3ฒน-5702" and "3ฒน 5702" compare equal. */
export function clean(s: string): string {
  return s.replace(/[\s\-.]/g, "");
}

/**
 * Split an OCR reading into prefix and number: "กพ8800" -> กพ / 8800.
 *
 * The prefix is an optional leading digit plus the Thai letters; the number is
 * the digits after them. OCR often reads a bolt or the frame as an extra digit
 * ("4กน01020", "7ขญ24260"): digits never belong to the prefix after its letters,
 * and plate numbers never start with 0, so those are sorted out here instead of
 * producing a prefix like "4กน0" that nobody can accept without retyping.
 *
 * A reading that needed any of that is still likely wrong somewhere, whatever
 * the OCR confidence says (measured: such readings came with 0.86-1.00), so it
 * comes back `suspect` for the finder to check against the photo.
 */
export function splitPlate(raw: string): { prefix: string; number: string; suspect: boolean } {
  const s = clean(raw);
  const suspect = !/^\d?[ก-ฮ]{1,2}[1-9]\d{0,3}$/.test(s);
  const m = s.match(/^(\d*)([ก-ฮ]+)(.*)$/);
  if (m) {
    const lead = m[1].slice(-1); // at most one leading digit
    const digits = m[3].replace(/\D/g, "").replace(/^0+/, "");
    return { prefix: lead + m[2], number: digits.slice(-4), suspect };
  }
  // Digits only: a commercial plate like 70-1234, or a reading that lost its letters.
  const d = s.replace(/\D/g, "");
  if (d.length > 4) return { prefix: d.slice(0, -4).slice(-2), number: d.slice(-4), suspect };
  return { prefix: "", number: d, suspect };
}

/** Private plates: optional digit + 1–2 Thai letters (กข, 1กข). Commercial: 1–2 digits (70-1234). */
export function isValidPrefix(p: string): boolean {
  return /^(\d?[ก-ฮ]{1,2}|\d{1,2})$/.test(clean(p));
}

export function isValidNumber(n: string): boolean {
  return /^\d{1,4}$/.test(clean(n));
}

/** Why a prefix is not accepted, in words a finder can act on; "" when it is fine. */
export function prefixProblem(p: string): string {
  const s = clean(p);
  if (!s) return "ใส่หมวดอักษร";
  if (isValidPrefix(s)) return "";
  if (/[ก-ฮ]\d/.test(s)) return "มีตัวเลขต่อท้ายตัวอักษร — ตัวเลขชุดหลังให้ใส่ช่องเลขทะเบียน";
  if (/[ก-ฮ]{3,}/.test(s)) return "ตัวอักษรเกิน 2 ตัว";
  if (/^\d{2,}[ก-ฮ]/.test(s)) return "มีเลขนำหน้าได้แค่ 1 ตัว";
  return "หมวดอักษร เช่น กข, 1กข หรือเลข 2 หลักของรถบรรทุก/รถตู้";
}

export function numberProblem(n: string): string {
  const s = clean(n);
  if (!s) return "ใส่เลขทะเบียน";
  return isValidNumber(s) ? "" : "เลขทะเบียน 1–4 หลัก";
}

/** Levenshtein distance; plates are short, so the simple DP is fine. */
export function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
