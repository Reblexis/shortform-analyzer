// Inputs and the checks that come before any work: Examples 8, 9 and 10, and TikTok URLs through apinoa.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeVideo, screenVideo } from "../src/index.js";
import { resolveInput } from "../src/primitives.js";
import { fakeOpenAI, hasFfmpeg, makeCuts, withEnv } from "./helpers.js";

const POST = "https://www.tiktok.com/@someone/video/7400000000000000001";
const many = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `q${i}`, question: "Is it red?" }));

describe("inputs", () => {
  it("fails on a TikTok URL without APINOA_API_KEY, before any request (Example 8)", async () => {
    const { fetchFn, calls } = fakeOpenAI();
    await withEnv({ APINOA_API_KEY: undefined }, async () => {
      const r = await analyzeVideo(POST, { openaiApiKey: "k", fetch: fetchFn });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(/^input: APINOA_API_KEY is not set/);
    });
    expect(calls).toHaveLength(0);
  });

  it("refuses any other URL and says to download the video first (Example 9)", async () => {
    const r = await analyzeVideo("https://example.com/video.mp4", { openaiApiKey: "k" });
    expect(r).toEqual({ ok: false, error: "input: only TikTok post URLs are supported; download the video first and pass the file" });
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

  it.skipIf(!hasFfmpeg)("downloads a TikTok URL through apinoa, then analyses it", async () => {
    const bytes = await readFile(makeCuts(true));
    const openai = fakeOpenAI();
    const seen: string[] = [];
    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/v1/tiktok/media")) {
        seen.push(url);
        return Response.json({ success: true, data: { platform: "tiktok", postId: "7400000000000000001", contentType: "video/mp4", bytes: bytes.length, encoding: "base64", data: bytes.toString("base64") } });
      }
      return openai.fetchFn(url, init);
    }) as typeof fetch;
    const r = await analyzeVideo(POST, { openaiApiKey: "k", apinoaApiKey: "ak", fetch: fetchFn });
    if (!r.ok) throw new Error(r.error);
    expect(r.scenes).toHaveLength(3);
    expect(seen).toHaveLength(1);
    expect(new URL(seen[0]).searchParams.get("post")).toBe(POST);
  });
});
