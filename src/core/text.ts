// Answer normalisation and comparison for typed answers.

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?;:"]+/g, '')
    .replace(/\s+/g, ' ');
}

export function answersMatch(given: string, expected: string): boolean {
  return normalizeAnswer(given) === normalizeAnswer(expected) && normalizeAnswer(expected) !== '';
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** "Almost" feedback: one or two letters off. Does not change grading. */
export function isNearMiss(given: string, expected: string): boolean {
  const g = normalizeAnswer(given), e = normalizeAnswer(expected);
  return g !== e && g.length > 0 && levenshtein(g, e) <= (e.length > 6 ? 2 : 1);
}

/** Split a sentence into word tokens and the separators between them. */
export function tokenize(sentence: string): string[] {
  return sentence.match(/[A-Za-z][A-Za-z'-]*|[0-9]+|[^A-Za-z0-9\s]+|\s+/g) ?? [];
}

export const isWordToken = (t: string) => /^[A-Za-z0-9]/.test(t);

/** Replace the first whole-word occurrence of `form` with `blank`. */
export function blankOut(sentence: string, form: string, blank = '_____'): string {
  const esc = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.replace(new RegExp(`(^|[^A-Za-z])${esc}(?=$|[^A-Za-z])`, 'i'), (_m, pre) => `${pre}${blank}`);
}

/** Find the surface form of the target in its example sentence, preserving case. */
export function surfaceForm(sentence: string, form: string): string | undefined {
  const esc = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^A-Za-z])(${esc})(?=$|[^A-Za-z])`, 'i').exec(sentence);
  return m?.[2];
}
