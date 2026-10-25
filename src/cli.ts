#!/usr/bin/env node
// npx shortform-breakdown analyze <file-or-tiktok-url> | screen <file-or-tiktok-url> | mcp
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Question } from "./types.js";
import { VERSION } from "./version.js";

const USAGE = `Usage:
  shortform-breakdown analyze <file-or-tiktok-url> [--out <dir>] [--question name="question"]... [--json]
  shortform-breakdown screen  <file-or-tiktok-url> --question name="question"...
  shortform-breakdown mcp

Keys: OPENAI_API_KEY (always), APINOA_API_KEY (TikTok URLs only).
Docs: https://github.com/trevkang/shortform-breakdown`;


class Usage extends Error {}

export function parseQuestion(arg: string): Question {
  const i = arg.indexOf("=");
  if (i <= 0) throw new Usage(`--question takes name="question", got: ${arg}`);
  return { name: arg.slice(0, i).trim(), question: arg.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, "$2") };
}

/** Where `analyze` writes by default: next to the file, or ./<post id>.breakdown/ for a URL. */
export function defaultOut(input: string, postId?: string): string {
  return postId ? resolve(`${postId}.breakdown`) : resolve(`${input}.breakdown`);
}

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        out: { type: "string" }, question: { type: "string", multiple: true }, json: { type: "boolean" },
        help: { type: "boolean", short: "h" }, version: { type: "boolean", short: "v" },
      },
    });
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.version) { console.log(VERSION); return 0; }
  const [cmd, input, ...rest] = positionals;
  if (values.help || !cmd) { (values.help ? console.log : console.error)(USAGE); return values.help ? 0 : 2; }

  if (cmd === "mcp") {
    const { runStdio } = await import("./mcp.js");
    await runStdio();
    return -1; // keep running
  }
  if ((cmd !== "analyze" && cmd !== "screen") || !input || rest.length) {
    console.error(USAGE);
    return 2;
  }
  let questions: Question[];
  try {
    questions = (values.question ?? []).map(parseQuestion);
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }

  if (cmd === "screen") {
    if (!questions.length) { console.error(`screen needs at least one --question\n\n${USAGE}`); return 2; }
    const { screenVideo } = await import("./pipeline/screen.js");
    const r = await screenVideo(input, questions);
    if (!r.ok) { console.error(r.error); return 1; }
    console.log(JSON.stringify(r, null, 2));
    return 0;
  }

  const { breakdown } = await import("./pipeline/analyze.js");
  const { writeBreakdown } = await import("./pipeline/files.js");
  const { summarize } = await import("./pipeline/summary.js");
  const r = await breakdown(input, { questions });
  if (!r.ok) { console.error(r.error); return 1; }
  const dir = values.out ? resolve(values.out) : defaultOut(input, r.postId);
  try {
    await writeBreakdown(dir, r.analysis, r.frames, { title: r.postId ?? basename(input) });
  } catch (e) {
    console.error(`writing ${dir}: ${(e as Error).message}`);
    return 1;
  }
  if (values.json) console.log(JSON.stringify(r.analysis, null, 2));
  else console.log(`${summarize(r.analysis)}\n\nWrote ${dir}/ (analysis.json, report.html, frames/, sheet.jpg)`);
  return 0;
}

const code = await main(process.argv.slice(2));
if (code >= 0) process.exitCode = code;
