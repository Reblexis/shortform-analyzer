import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Analysis, FfmpegOptions } from "../primitives.js";
import { reportHtml } from "./report.js";

const exec = promisify(execFile);
export const SHEET_COLUMNS = 4;
const SHEET_TILE = 256; // px, width of one frame in sheet.jpg

const two = (i: number) => String(i + 1).padStart(2, "0");

/** Writes analysis.json, report.html, frames/01.jpg… and sheet.jpg (every frame tiled 4 wide) into `dir`. */
export async function writeOutput(dir: string, analysis: Analysis, frames: Buffer[], options: FfmpegOptions & { title?: string } = {}) {
  const framesDir = join(dir, "frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await writeFile(join(dir, "analysis.json"), JSON.stringify(analysis, null, 2) + "\n");
  await writeFile(join(dir, "report.html"), reportHtml(analysis, options.title));
  await Promise.all(frames.map((f, i) => writeFile(join(framesDir, `${two(i)}.jpg`), f)));
  const rows = Math.max(1, Math.ceil(frames.length / SHEET_COLUMNS));
  const cols = Math.min(SHEET_COLUMNS, Math.max(1, frames.length));
  // Every frame scaled to one size and padded, so frames of any shape tile; tile flushes a last, partly empty row.
  await exec(options.ffmpegPath ?? "ffmpeg", [
    "-v", "error", "-y", "-start_number", "1", "-i", join(framesDir, "%02d.jpg"),
    "-vf", `scale=${SHEET_TILE}:${SHEET_TILE}:force_original_aspect_ratio=decrease,pad=${SHEET_TILE}:${SHEET_TILE}:(ow-iw)/2:(oh-ih)/2,tile=${cols}x${rows}`,
    "-frames:v", "1", "-q:v", "3", join(dir, "sheet.jpg"),
  ]);
  return { dir, files: ["analysis.json", "report.html", ...frames.map((_, i) => `frames/${two(i)}.jpg`), "sheet.jpg"] };
}
