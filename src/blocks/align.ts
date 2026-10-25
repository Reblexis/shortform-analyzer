import type { Span, Word } from "../types.js";

/** One string per span: the words whose midpoint falls in it. A word past the last span goes to the last span. */
export function alignWords(words: Word[], spans: Span[]): string[] {
  const out: string[][] = spans.map(() => []);
  if (!spans.length) return [];
  for (const w of words) {
    const mid = (w.start + w.end) / 2;
    let i = spans.findIndex((s) => mid < s.end);
    if (i < 0) i = spans.length - 1;
    out[i].push(w.word.trim());
  }
  return out.map((ws) => ws.join(" ").replace(/\s+([,.!?;:])/g, "$1"));
}
