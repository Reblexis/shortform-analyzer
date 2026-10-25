import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InputOptions } from "../types.js";
import { stage } from "./run.js";

export const TIKTOK_URL = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([^/?#]+)\/video\/(\d+)/;

export type ResolvedInput = { path: string; cleanup: () => Promise<void>; postId?: string };

const keep = async () => {};

async function tempFile(bytes: Buffer): Promise<ResolvedInput & { path: string }> {
  const dir = await mkdtemp(join(tmpdir(), "shortform-breakdown-"));
  const path = join(dir, "video.mp4");
  await writeFile(path, bytes);
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/**
 * A path, the video's bytes or a TikTok post URL → a local file. Bytes and downloads go to a temp file that `cleanup`
 * removes; a path is used as it is. Any other URL is refused.
 */
export function resolveInput(input: string | Buffer, options: InputOptions = {}): Promise<ResolvedInput> {
  return stage("input", async () => {
    if (Buffer.isBuffer(input)) return tempFile(input);
    const tiktok = input.match(TIKTOK_URL);
    if (tiktok) {
      const apiKey = options.apinoaApiKey ?? process.env.APINOA_API_KEY ?? "";
      if (!apiKey) throw new Error("APINOA_API_KEY is not set; a TikTok URL is downloaded through apinoa (https://apinoa.com)");
      const { fetchTikTok } = await import("./fetch.js");
      return { ...(await tempFile(await fetchTikTok(input, { ...options, apiKey }))), postId: tiktok[2] };
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) throw new Error("only TikTok post URLs are supported; download the video first and pass the file");
    return { path: input, cleanup: keep };
  });
}
