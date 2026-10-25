// Inputs and the checks that come before any work: Examples 9 and 10.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeVideo, screenVideo } from "../src/index.js";
import { resolveInput } from "../src/primitives.js";
import { fakeOpenAI } from "./helpers.js";

const many = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `q${i}`, question: "Is it red?" }));

describe("inputs", () => {
  it("refuses a URL and says to download the video first (Example 9)", async () => {
    const r = await analyzeVideo("https://example.com/video.mp4", { openaiApiKey: "k" });
    expect(r).toEqual({ ok: false, error: "input: URLs are not supported; download the video first and pass the file" });
  });

  it("refuses more than 20 questions (Example 10), and bad names", async () => {
    const { fetchFn, calls } = fakeOpenAI();
    expect(await analyzeVideo("clip.mp4", { openaiApiKey: "k", fetch: fetchFn, questions: many(25) }))
      .toEqual({ ok: false, error: "questions: 25 questions; the maximum is 20" });
    expect((await screenVideo("clip.mp4", many(21), { openaiApiKey: "k" })).ok).toBe(false);
    const bad = await analyzeVideo("clip.mp4", { openaiApiKey: "k", questions: [{ name: "Face!", question: "?" }] });
    expect(!bad.ok && bad.error).toMatch(/must match/);
    expect(calls).toHaveLength(0);
  });

  it("writes a Buffer to a temp file that cleanup removes, and leaves a path alone", async () => {
    const r = await resolveInput(Buffer.from("bytes"));
    expect(existsSync(r.path)).toBe(true);
    await r.cleanup();
    expect(existsSync(r.path)).toBe(false);
    const p = await resolveInput("/some/clip.mp4");
    expect(p.path).toBe("/some/clip.mp4");
    await p.cleanup();
  });
});
