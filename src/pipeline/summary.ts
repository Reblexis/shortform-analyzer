import type { Analysis, Lever } from "../primitives.js";

const words = (s: string) => s.replace(/_/g, " ");

function topLever(a: Analysis, scenes: number[]): Lever {
  const n = new Map<Lever, number>();
  for (const i of scenes) { const l = a.scenes[i].lever; if (l !== "none") n.set(l, (n.get(l) ?? 0) + 1); }
  return [...n].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "none";
}

/** What an agent reads about one analysed video: format, goal, scene count, production, then one line per section. */
export function summarize(a: Analysis): string {
  const parts = a.sections.map((s) => {
    const lever = topLever(a, s.scenes);
    const said = s.transcript ? `: "${s.transcript.length > 140 ? s.transcript.slice(0, 140) + "..." : s.transcript}"` : " (nothing said)";
    return `${s.beat} ${s.start.toFixed(1)}-${s.end.toFixed(1)} s${lever !== "none" ? ` (${words(lever)})` : ""}${said}`;
  });
  const text = a.scenes.filter((x) => (x.textOnScreen ?? 0) >= 0.5).length;
  const answers = Object.entries(a.answers ?? {}).map(([n, p]) => `${n} ${p >= 0.5 ? "yes" : "no"} (${p.toFixed(2)})`);
  return `${words(a.format)}, ${a.goal}, ${a.duration.toFixed(0)} s, ${a.scenes.length} scenes, ${text} with text on screen.` +
    ` Made as ${words(a.production)}, audio: ${words(a.voice)}.` +
    `${answers.length ? ` Answers: ${answers.join(", ")}.` : ""}` +
    `${a.transcriptError ? ` No transcript: ${a.transcriptError}.` : ""}\n  ${parts.join("\n  ")}`;
}
