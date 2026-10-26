import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stage } from "./run.js";

export type ResolvedInput = { path: string; cleanup: () => Promise<void> };

const keep = async () => {};

async function tempFile(bytes: Buffer): Promise<ResolvedInput> {
  const dir = await mkdtemp(join(tmpdir(), "shortform-analyzer-"));
  const path = join(dir, "video.mp4");
  await writeFile(path, bytes);
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** A path or the video's bytes → a local file. Bytes go to a temp file that `cleanup` removes; a path is used as it is. Any URL is refused. */
export function resolveInput(input: string | Buffer): Promise<ResolvedInput> {
  return stage("input", async () => {
    if (Buffer.isBuffer(input)) return tempFile(input);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) throw new Error("URLs are not supported; download the video first and pass the file");
    return { path: input, cleanup: keep };
  });
}
