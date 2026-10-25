import type { Scene, Section } from "../types.js";

/** Consecutive scenes with the same beat, as one section. */
export function sectionsOf(scenes: Pick<Scene, "index" | "start" | "end" | "beat" | "transcript">[]): Section[] {
  const out: Section[] = [];
  for (const s of scenes) {
    const last = out[out.length - 1];
    if (last && last.beat === s.beat) {
      last.end = s.end;
      last.scenes.push(s.index);
      if (s.transcript) last.transcript = [last.transcript, s.transcript].filter(Boolean).join(" ");
    } else out.push({ beat: s.beat, start: s.start, end: s.end, scenes: [s.index], transcript: s.transcript });
  }
  return out;
}
