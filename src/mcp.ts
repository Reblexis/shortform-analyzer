// shortform-analyzer mcp: analyze_video and screen_video over stdio.
import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { analyzeWithFrames } from "./pipeline/analyze.js";
import { writeOutput } from "./pipeline/files.js";
import { screenVideo } from "./pipeline/screen.js";
import { summarize } from "./pipeline/summary.js";
import type { Options } from "./types.js";

const question = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/).describe("A short id, e.g. face_on_camera"),
  question: z.string().describe("A yes/no question about what is in the video"),
});

const error = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

/** The MCP server. `options` go to every analysis (tests pass a fake fetch and a key); `outDir` is where folders go. */
export function createServer(options: Options & { outDir?: string; version?: string } = {}): McpServer {
  const server = new McpServer({ name: "shortform-analyzer", version: options.version ?? "0.0.0" });

  server.registerTool("analyze_video", {
    title: "Analyze a short-form video",
    description: "Split one short-form video (a local file path) into scenes, transcribe it, and label each scene's beat " +
      "(hook, setup, value, proof, payoff, cta), lever (what keeps viewers watching) and hold (0-4); also the video's format, goal, production and voice. " +
      "Writes analysis.json, report.html, frames/ and sheet.jpg (all frames on one image) to a folder and returns its path. Takes under 10 seconds.",
    inputSchema: {
      input: z.string().describe("A local video file path"),
      questions: z.array(question).max(20).optional().describe("Up to 20 yes/no questions; each answer is a probability"),
    },
  }, async ({ input, questions }) => {
    const r = await analyzeWithFrames(input, { ...options, questions });
    if (!r.ok) return error(r.error);
    const dir = options.outDir
      ? join(options.outDir, `video-${Date.now()}.analysis`)
      : resolve(`${input}.analysis`);
    await writeOutput(dir, r.analysis, r.frames, options);
    // Thumbnails are base64 and would only fill the model's context; the frames are in the folder.
    const lean = { ...r.analysis, scenes: r.analysis.scenes.map(({ thumbnail: _t, ...s }) => s) };
    return { content: [{ type: "text", text: `${summarize(r.analysis)}\n\nFolder: ${dir} (open sheet.jpg to see every frame)\n\n${JSON.stringify(lean)}` }] };
  });

  server.registerTool("screen_video", {
    title: "Screen a short-form video",
    description: "A quick check of one video from 3 frames: how it is made (production), what carries the audio (voice), and a probability for each yes/no question.",
    inputSchema: {
      input: z.string().describe("A local video file path"),
      questions: z.array(question).min(1).max(20),
    },
  }, async ({ input, questions }) => {
    const r = await screenVideo(input, questions, options);
    if (!r.ok) return error(r.error);
    return { content: [{ type: "text", text: JSON.stringify({ production: r.production, voice: r.voice, answers: r.answers }) }] };
  });

  return server;
}

export async function runStdio(): Promise<void> {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { VERSION } = await import("./version.js");
  await createServer({ version: VERSION }).connect(new StdioServerTransport());
  if (!process.env.OPENAI_API_KEY) console.error("shortform-analyzer mcp: OPENAI_API_KEY is not set; every call will fail until it is.");
}
