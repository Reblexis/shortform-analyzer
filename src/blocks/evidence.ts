import type { Evidence, EvidenceItem, Span } from "../types.js";

export const SCENE_INTRO = "A video, {duration} s long, in {scenes} scenes. Each scene: its time, a frame from its middle, and what is said in it.";

const pct = (t: number, d: number) => Math.round((t / d) * 100);

/**
 * Per scene, its time and share of the video, whether it continues the take before it, its frame and what is said in it.
 * `{duration}` and `{scenes}` in `intro` become the video's length and scene count.
 */
export function sceneEvidence(spans: Span[], frames: Buffer[], texts: string[], options: { duration: number; intro?: string }): Evidence {
  const { duration } = options;
  if (frames.length !== spans.length || texts.length !== spans.length) {
    throw new Error(`decide: ${spans.length} scenes need as many frames and texts (got ${frames.length} and ${texts.length})`);
  }
  const intro = (options.intro ?? SCENE_INTRO).replaceAll("{duration}", duration.toFixed(1)).replaceAll("{scenes}", String(spans.length));
  const items: EvidenceItem[] = spans.flatMap((s, i): EvidenceItem[] => {
    const said = texts[i] ? `Said: "${texts[i]}"` : "Nothing said.";
    return [
      { type: "text", text: `Scene ${i + 1} (${s.start.toFixed(1)}-${s.end.toFixed(1)} s, ${pct(s.start, duration)}% to ${pct(s.end, duration)}% of the video${s.cut === false ? ", the same take as the scene before" : ""}). ${said}` },
      { type: "image", image: frames[i] },
    ];
  });
  return { intro, items, scenes: spans.length };
}

/** Frames only, in order: no time and no words. Scene-scope questions can't be asked of it. */
export function frameEvidence(frames: (Buffer | { image: Buffer; mime?: string })[], intro: string): Evidence {
  return {
    intro,
    items: frames.map((f) => (Buffer.isBuffer(f) ? { type: "image", image: f } : { type: "image", image: f.image, mime: f.mime })),
    scenes: 0,
  };
}
