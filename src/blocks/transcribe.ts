import type { FfmpegOptions, OpenAIOptions, Transcript, Word } from "../types.js";
import { ffmpeg, openai, run, stage } from "./run.js";

export const TRANSCRIBE_MODEL = "whisper-1"; // the OpenAI model that gives word timestamps

/** The video's audio as a small mono MP3. */
export function extractAudio(video: string, options: FfmpegOptions = {}): Promise<Buffer> {
  return stage("video", async () => {
    const { stdout } = await run(ffmpeg(options), ["-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "mp3", "-"]);
    return stdout;
  });
}

/** OpenAI transcription with word timestamps, without what whisper writes on music-only audio. */
export function transcribe(audio: Buffer, options: OpenAIOptions = {}): Promise<Transcript> {
  return stage("transcribe", async () => {
    const api = openai(options, "transcribe");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "audio.mp3");
    form.append("model", TRANSCRIBE_MODEL);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
    const res = await api.fetch(`${api.base}/audio/transcriptions`, {
      method: "POST", headers: { Authorization: `Bearer ${api.key}` }, body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`transcription ${res.status}: ${data?.error?.message ?? "no body"}`);
    return dropHallucinations(data);
  });
}

// whisper's stock line on music-only audio; dropped whatever its numbers say.
const OUTRO = /^(thanks|thank you)( so much)? for watching[.!]*$/i;

type Segment = { start: number; end: number; text: string; no_speech_prob?: number; avg_logprob?: number };

/** whisper's verbose_json → the transcript without segments that are likely not speech and unsure (docs/video-analysis.md). */
export function dropHallucinations(data: { text?: string; words?: Word[]; segments?: Segment[]; language?: string }): Transcript {
  const words: Word[] = (data.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end }));
  const segments = data.segments ?? [];
  const bad = segments.filter((s) => ((s.no_speech_prob ?? 0) > 0.4 && (s.avg_logprob ?? 0) < -0.6) || OUTRO.test(s.text.trim()));
  if (!bad.length) return { text: (data.text ?? "").trim(), words, ...(data.language ? { language: data.language } : {}) };
  const inBad = (w: Word) => bad.some((s) => (w.start + w.end) / 2 >= s.start && (w.start + w.end) / 2 <= s.end);
  return {
    text: segments.filter((s) => !bad.includes(s)).map((s) => s.text.trim()).join(" "),
    words: words.filter((w) => !inBad(w)),
    ...(data.language ? { language: data.language } : {}),
  };
}
