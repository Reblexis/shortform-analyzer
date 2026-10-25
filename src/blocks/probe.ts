import type { FfmpegOptions } from "../types.js";
import { ffprobe, run, stage } from "./run.js";

/** The video's duration in seconds and whether it has an audio track. */
export function probe(video: string, options: FfmpegOptions = {}): Promise<{ duration: number; audio: boolean }> {
  return stage("video", async () => {
    const { stdout } = await run(ffprobe(options), ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", video]);
    const data = JSON.parse(stdout.toString());
    const duration = Number(data.format?.duration);
    if (!(duration > 0)) throw new Error("ffprobe: no duration");
    return { duration, audio: (data.streams ?? []).some((s: { codec_type?: string }) => s.codec_type === "audio") };
  });
}
