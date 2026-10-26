// The MCP server through a real MCP client over an in-memory transport, with OpenAI faked at fetch.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/mcp.js";
import { fakeOpenAI, hasFfmpeg, makeCuts, tmp } from "./helpers.js";

async function connect(options: Parameters<typeof createServer>[0]) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(options).connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);
  return client;
}

const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0].text);

describe("mcp", () => {
  it("lists analyze_video and screen_video", async () => {
    const client = await connect({});
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["analyze_video", "screen_video"]);
    expect(Object.keys(tools.find((t) => t.name === "analyze_video")!.inputSchema.properties!)).toEqual(["input", "questions"]);
  });

  it("states the time the README's benchmark measured, as the skill does", async () => {
    const client = await connect({});
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "analyze_video")!.description).toMatch(/under 10 seconds/);
    expect(readFileSync("skills/shortform-analyzer/SKILL.md", "utf8")).toMatch(/under 10 seconds/);
  });

  it("returns a tool error, not a crash, on a bad input", async () => {
    const client = await connect({ openaiApiKey: "k" });
    const r = await client.callTool({ name: "analyze_video", arguments: { input: "https://example.com/v.mp4" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/download the video first/);
  });

  it.skipIf(!hasFfmpeg)("analyze_video returns the summary, the folder and the analysis without thumbnails", async () => {
    const outDir = tmp();
    const client = await connect({ openaiApiKey: "k", fetch: fakeOpenAI().fetchFn, outDir });
    const r = await client.callTool({ name: "analyze_video", arguments: { input: makeCuts(true), questions: [{ name: "red", question: "Is it red?" }] } });
    expect(r.isError).toBeFalsy();
    const t = text(r);
    expect(t).toMatch(/^meme, awareness/);
    const folder = t.match(/Folder: (\S+)/)![1];
    expect(folder.startsWith(outDir)).toBe(true);
    expect(existsSync(join(folder, "sheet.jpg"))).toBe(true);
    const json = JSON.parse(t.slice(t.lastIndexOf("\n\n") + 2));
    expect(json.scenes).toHaveLength(3);
    expect(json.scenes[0].thumbnail).toBeUndefined();
    expect(t).not.toContain("base64");
    expect(json.answers).toEqual({ red: 0.9 });
  });

  it.skipIf(!hasFfmpeg)("screen_video returns production, voice and answers", async () => {
    const client = await connect({ openaiApiKey: "k", fetch: fakeOpenAI().fetchFn });
    const r = await client.callTool({ name: "screen_video", arguments: { input: makeCuts(false), questions: [{ name: "red", question: "Is it red?" }] } });
    expect(JSON.parse(text(r))).toEqual({ production: "text_only", voice: "music_only", answers: { red: 0.9 } });
  });
});
