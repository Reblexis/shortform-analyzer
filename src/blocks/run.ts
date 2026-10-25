import { execFile } from "node:child_process";
import type { FfmpegOptions, OpenAIOptions } from "../types.js";

/** Runs a program and resolves its stdout and stderr; rejects with the last line of stderr. */
export function run(cmd: string, args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd}: ${stderr.toString().trim().split("\n").pop() || err.message}`));
      else resolve({ stdout, stderr: stderr.toString() });
    });
  });
}

export const ffmpeg = (o: FfmpegOptions = {}) => o.ffmpegPath ?? "ffmpeg";
export const ffprobe = (o: FfmpegOptions = {}) => o.ffprobePath ?? "ffprobe";

/** Throws with the stage in front, so a composed pipeline's error says where it broke. */
export async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = (e as Error).message;
    throw new Error(msg.startsWith(`${name}:`) ? msg : `${name}: ${msg}`);
  }
}

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

/** The key, the base URL (no trailing slash) and fetch for an OpenAI call; throws `<stage>: OPENAI_API_KEY is not set`. */
export function openai(o: OpenAIOptions, stageName: string) {
  const key = o.openaiApiKey ?? process.env.OPENAI_API_KEY ?? "";
  if (!key) throw new Error(`${stageName}: OPENAI_API_KEY is not set (set it, or pass openaiApiKey)`);
  const base = (o.openaiBaseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  return { key, base, fetch: o.fetch ?? fetch };
}
