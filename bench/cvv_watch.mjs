// Calls claude-video-vision's video_watch over MCP the way Claude Code would, and saves what it returns:
// the frames as JPEGs + frames.json, and its text (transcript included) as transcript.txt.
// Usage: node cvv_watch.mjs <cvv dist/index.js> <video> <out dir>
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [server, video, out] = process.argv.slice(2);
mkdirSync(join(out, "frames"), { recursive: true });
const client = new Client({ name: "bench", version: "0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [server], env: process.env }));
const r = await client.callTool({ name: "video_watch", arguments: { path: video } }, undefined, { timeout: 600000 });
const texts = [], frames = [];
let lastT = 0;
for (const c of r.content) {
  if (c.type === "text") {
    texts.push(c.text);
    const m = c.text.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) lastT = +m[1] * 3600 + +m[2] * 60 + +m[3];
  } else if (c.type === "image") {
    const p = join(out, "frames", `${String(frames.length + 1).padStart(3, "0")}.jpg`);
    writeFileSync(p, Buffer.from(c.data, "base64"));
    frames.push({ path: p, t: lastT });
  }
}
writeFileSync(join(out, "frames.json"), JSON.stringify(frames));
writeFileSync(join(out, "transcript.txt"), texts.join("\n\n"));
console.log("frames", frames.length);
await client.close();
