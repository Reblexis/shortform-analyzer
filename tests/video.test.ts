// On real ffmpeg output (lavfi), with a fake OpenAI. Examples 1, 2, 3, 6, 7 and 18; ported from the hackathon.
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { analyzeVideo, reportHtml, screenVideo } from "../src/index.js";
import { detectScenes, extractFrames, grabFrame, probe } from "../src/primitives.js";
import { fakeOpenAI, hasFfmpeg, makeCuts, makeLongTake, withEnv } from "./helpers.js";

describe.skipIf(!hasFfmpeg)("on a real video file", () => {
  let video: string, silent: string, take: string;
  beforeAll(() => { video = makeCuts(true); silent = makeCuts(false); take = makeLongTake(); });

  it("finds the cuts and grabs a small JPEG per scene (Example 1)", async () => {
    const { duration, audio } = await probe(video);
    expect(audio).toBe(true);
    const scenes = await detectScenes(video, { duration });
    expect(scenes).toHaveLength(3);
    expect(scenes[0].start).toBe(0);
    expect(scenes[1].start).toBeCloseTo(1.5, 1);
    expect(scenes[2].start).toBeCloseTo(3, 1);
    expect(scenes[2].end).toBe(duration);
    const jpeg = await grabFrame(video, 0.75);
    expect(jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(await detectScenes(video)).toEqual(scenes); // probes the duration itself
    const frames = await extractFrames(video, scenes, { side: 64 });
    expect(frames).toHaveLength(3);
    expect(frames[0].length).toBeLessThan(jpeg.length);
  });

  it("returns scene-by-scene transcript, thumbnail, beat and the format", async () => {
    const { fetchFn, calls, path } = fakeOpenAI();
    const a = await analyzeVideo(video, { openaiApiKey: "k", fetch: fetchFn });
    if (!a.ok) throw new Error(a.error);
    expect(a.schemaVersion).toBe(1);
    expect(a.scenes.map((s) => [s.beat, s.transcript])).toEqual([["hook", "Wait"], ["value", ""], ["cta", "Follow!"]]);
    expect(a.scenes.every((s) => s.thumbnail.startsWith("data:image/jpeg;base64,"))).toBe(true);
    const thumb = Buffer.from(a.scenes[0].thumbnail.split(",")[1], "base64");
    const sent = (calls[1].body as { input: { content: { type: string; image_url?: string }[] }[] }).input[0].content.find((c) => c.type === "input_image")!;
    expect(thumb.length).toBeLessThan(Buffer.from(sent.image_url!.split(",")[1], "base64").length);
    expect(a.sections.map((s) => s.beat)).toEqual(["hook", "value", "cta"]);
    expect(a).toMatchObject({ format: "meme", goal: "awareness", transcript: "Wait for it. Follow!", language: "english", inputTokens: 900, production: "text_only", voice: "music_only" });
    expect(a.answers).toBeUndefined();
    expect(calls.map(path)).toEqual(["audio/transcriptions", "decisions"]);
    expect(reportHtml(a)).toContain("Scene 3");
  });

  it("still analyses a video without audio, from its frames (Example 2)", async () => {
    const { fetchFn, calls, path } = fakeOpenAI();
    const a = await analyzeVideo(silent, { openaiApiKey: "k", fetch: fetchFn });
    if (!a.ok) throw new Error(a.error);
    expect(a.transcriptError).toBe("no audio track");
    expect(a.scenes.every((s) => s.transcript === "")).toBe(true);
    expect(calls.map(path)).toEqual(["decisions"]);
  });

  it("keeps going on a failed transcription, and says why", async () => {
    const { fetchFn } = fakeOpenAI({ transcriptionStatus: 500 });
    const a = await analyzeVideo(video, { openaiApiKey: "k", fetch: fetchFn });
    if (!a.ok) throw new Error(a.error);
    expect(a.transcript).toBe("");
    expect(a.transcriptError).toBe("transcribe: transcription 500: bad audio");
  });

  it("splits one long take into equal scenes that are not cuts (Examples 3 and 18)", async () => {
    const { fetchFn } = fakeOpenAI();
    const a = await analyzeVideo(take, { openaiApiKey: "k", fetch: fetchFn });
    if (!a.ok) throw new Error(a.error);
    expect(a.scenes).toHaveLength(3);
    const lens = a.scenes.map((s) => s.end - s.start);
    for (const l of lens) expect(l).toBeCloseTo(lens[0], 5);
    expect(a.scenes.map((s) => s.cut)).toEqual([undefined, false, false]);
    const four = await detectScenes(take, { maxTake: 3 });
    expect(four).toHaveLength(4);
    for (const s of four) expect(s.end - s.start).toBeCloseTo(2.75, 1);
    expect(four.map((s) => s.cut)).toEqual([undefined, false, false, false]);
  });

  it("reads the key from openaiApiKey, then OPENAI_API_KEY, and sends every call to openaiBaseUrl", async () => {
    const { fetchFn, calls } = fakeOpenAI();
    await withEnv({ OPENAI_API_KEY: "env-key", OPENAI_BASE_URL: undefined }, async () => {
      expect((await analyzeVideo(video, { fetch: fetchFn })).ok).toBe(true);
      expect((await analyzeVideo(video, { fetch: fetchFn, openaiApiKey: "option-key", openaiBaseUrl: "https://example.azure.com/openai/v1/" })).ok).toBe(true);
    });
    expect(calls.map((c) => c.auth)).toEqual(["Bearer env-key", "Bearer env-key", "Bearer option-key", "Bearer option-key"]);
    expect(calls.slice(0, 2).every((c) => c.url.startsWith("https://api.openai.com/v1/"))).toBe(true);
    expect(calls.slice(2).map((c) => c.url)).toEqual(["https://example.azure.com/openai/v1/audio/transcriptions", "https://example.azure.com/openai/v1/decisions"]);
  });

  it("fails clearly without a key (Example 6) or a readable video (Example 7)", async () => {
    const { fetchFn, calls } = fakeOpenAI();
    await withEnv({ OPENAI_API_KEY: undefined }, async () => {
      const r = await analyzeVideo(video, { openaiApiKey: "", fetch: fetchFn });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain("OPENAI_API_KEY");
    });
    expect(calls).toHaveLength(0);
    const bad = await analyzeVideo("/nope.mp4", { openaiApiKey: "k", fetch: fetchFn });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatch(/^video:/);
  });

  it("takes the video's bytes as a Buffer", async () => {
    const { fetchFn } = fakeOpenAI();
    const a = await analyzeVideo(await readFile(silent), { openaiApiKey: "k", fetch: fetchFn });
    expect(a.ok && a.scenes.length).toBe(3);
  });
});

describe.skipIf(!hasFfmpeg)("screenVideo (the lean check)", () => {
  it("sends 3 frames from early, middle and late in the video and asks only how it is made and the questions", async () => {
    const video = makeCuts(false);
    let body: { input: { content: { type: string }[] }[]; questions: { name: string }[] } | undefined;
    const fetchFn = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return Response.json({ answers: [{ type: "choice", name: "production", choice: "on_camera_person" }, { type: "predicate", name: "q_no_face", probability: 0.97 }] });
    }) as typeof fetch;
    const m = await screenVideo(video, [{ name: "no_face", question: "Is a person's face shown on camera for more than a brief moment?" }], { openaiApiKey: "k", fetch: fetchFn });
    expect(body!.input[0].content.filter((c) => c.type === "input_image")).toHaveLength(3);
    expect(body!.questions.map((q) => q.name)).toEqual(["production", "voice", "q_no_face"]);
    expect(m).toEqual({ ok: true, production: "on_camera_person", voice: "none", answers: { no_face: 0.97 } });
  });

  it("returns ok false without a key instead of throwing", async () => {
    await withEnv({ OPENAI_API_KEY: undefined }, async () => {
      const r = await screenVideo(makeCuts(false), [], { openaiApiKey: "" });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain("OPENAI_API_KEY");
    });
  });
});
