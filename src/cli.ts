#!/usr/bin/env node
// npx shortform-analyzer analyze <file> | screen <file> | mcp
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Question } from "./types.js";
import { VERSION } from "./version.js";

const USAGE = `Usage:
  shortform-analyzer analyze <file> [--out <dir>] [--question name="question"]... [--json]
  shortform-analyzer screen  <file> --question name="question"...
  shortform-analyzer mcp

Key: OPENAI_API_KEY.
Docs: https://github.com/trevkang/shortform-analyzer`;


class Usage extends Error {}

export function parseQuestion(arg: string): Question {
  const i = arg.indexOf("=");
  if (i <= 0) throw new Usage(`--question takes name="question", got: ${arg}`);
  return { name: arg.slice(0, i).trim(), question: arg.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, "$2") };
}

/** Where `analyze` writes by default: next to the file. */
export function defaultOut(input: string): string {
  return resolve(`${input}.analysis`);
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

  const { analyzeWithFrames } = await import("./pipeline/analyze.js");
  const { writeOutput } = await import("./pipeline/files.js");
  const { summarize } = await import("./pipeline/summary.js");
  const r = await analyzeWithFrames(input, { questions });
  if (!r.ok) { console.error(r.error); return 1; }
  const dir = values.out ? resolve(values.out) : defaultOut(input);
  try {
    await writeOutput(dir, r.analysis, r.frames, { title: basename(input) });
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
