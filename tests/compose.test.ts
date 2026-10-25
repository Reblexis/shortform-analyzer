// Success criterion 6 and Example 17: the parts rebuild the whole, and Layer 3 reaches the parts only through primitives.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { analyzeVideo } from "../src/index.js";
import * as P from "../src/primitives.js";
import { fakeOpenAI, hasFfmpeg, makeCuts, makeLongTake } from "./helpers.js";

/** analyzeVideo written in the test from the primitives exports alone. */
async function rebuilt(video: string, options: P.Options): Promise<P.Analysis> {
  const { duration, audio } = await P.probe(video);
  const spans = await P.detectScenes(video, { duration });
  const frames = await P.extractFrames(video, spans);
  const thumbs = await P.extractFrames(video, spans, { side: P.THUMB_SIDE });
  const transcript = audio ? await P.transcribe(await P.extractAudio(video), options) : { text: "", words: [] as P.Word[] };
  const texts = P.alignWords(transcript.words, spans);
  const d = await P.decide(P.sceneEvidence(spans, frames, texts, { duration, intro: P.SHORTFORM_INTRO }), P.shortformQuestions(), options);
  const labels = P.parseShortform(d);
  const scenes: P.Scene[] = spans.map((s, i) => ({
    index: i, start: s.start, end: s.end, ...(s.cut === false ? { cut: false as const } : {}),
    thumbnail: `data:image/jpeg;base64,${thumbs[i].toString("base64")}`, transcript: texts[i], ...labels.scenes[i],
  }));
  return {
    schemaVersion: 1, ok: true, duration, scenes, sections: P.sectionsOf(scenes),
    format: labels.format, formatProbs: labels.formatProbs, goal: labels.goal, sells: labels.sells,
    production: labels.production, voice: labels.voice, transcript: transcript.text,
    ...(transcript.language ? { language: transcript.language } : {}),
    ...(audio ? {} : { transcriptError: "no audio track" }),
    ...(labels.inputTokens !== undefined ? { inputTokens: labels.inputTokens } : {}),
  };
}

describe.skipIf(!hasFfmpeg)("composition (Example 17)", () => {
  const videos: Record<string, string> = {};
  beforeAll(() => { videos.cuts = makeCuts(true); videos.silent = makeCuts(false); videos.take = makeLongTake(); });

  for (const name of ["cuts", "silent", "take"]) {
    it(`a pipeline made from primitives equals analyzeVideo on ${name}`, async () => {
      const options = { openaiApiKey: "k", fetch: fakeOpenAI().fetchFn };
      const whole = await analyzeVideo(videos[name], options);
      expect(whole.ok).toBe(true);
      expect(await rebuilt(videos[name], options)).toEqual(whole);
    });
  }
});

describe("layer rules", () => {
  const files = (dir: string) => readdirSync(join("src", dir)).filter((f) => f.endsWith(".ts")).map((f) => [f, readFileSync(join("src", dir, f), "utf8")] as const);

  it("pipeline/ imports blocks/ and shortform/ only through primitives.ts", () => {
    for (const [f, src] of files("pipeline")) expect(src, f).not.toMatch(/from "\.\.\/(blocks|shortform)\//);
  });

  it("shortform/ (Layer 2) runs no programs and makes no requests", () => {
    for (const [f, src] of files("shortform")) {
      expect(src, f).not.toMatch(/node:child_process|fetch\(|from "\.\.\/blocks\//);
    }
  });

  it("only blocks/ runs ffmpeg or calls fetch, except pipeline/files.ts writing the sheet", () => {
    for (const [f, src] of files("pipeline")) {
      if (f === "files.ts") continue;
      expect(src, f).not.toMatch(/node:child_process|\bfetch\(/);
    }
  });

  it("the main entry does not load the MCP SDK or the apinoa SDK", () => {
    for (const f of ["index.ts", "primitives.ts"]) expect(readFileSync(join("src", f), "utf8"), f).not.toMatch(/modelcontextprotocol|@apinoa/);
    expect(readFileSync("src/blocks/input.ts", "utf8")).toMatch(/await import\("\.\/fetch\.js"\)/);
  });
});
