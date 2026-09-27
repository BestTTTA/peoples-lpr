/** Strip spaces, dashes and dots so "3ฒน-5702" and "3ฒน 5702" compare equal. */
export function clean(s: string): string {
  return s.replace(/[\s\-.]/g, "");
}

/** Split an OCR reading like "กพ8800" into prefix "กพ" and number "8800". */
export function splitPlate(raw: string): { prefix: string; number: string } {
  const s = clean(raw);
  const m = s.match(/^(.*?)(\d{1,4})$/);
  if (!m || !m[1]) return { prefix: s, number: "" };
  return { prefix: m[1], number: m[2] };
}

export function isValidPrefix(p: string): boolean {
  return /^\d?[ก-ฮ]{1,2}$/.test(clean(p));
}

export function isValidNumber(n: string): boolean {
  return /^\d{1,4}$/.test(clean(n));
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
