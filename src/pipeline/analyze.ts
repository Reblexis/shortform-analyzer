// Layer 3: built only from the primitives exports, so anyone can rebuild it (docs/concepts.md).
import {
  alignWords, checkQuestions, decide, detectScenes, extractAudio, extractFrames, parseShortform, probe, resolveInput, sceneEvidence,
  sectionsOf, SHORTFORM_INTRO, shortformQuestions, THUMB_SIDE, transcribe,
  type Analysis, type Failed, type Options, type Scene, type Transcript,
} from "../primitives.js";

export const fail = (e: unknown): Failed => ({ ok: false, error: (e as Error).message.split("\n")[0] });

/** Checks that need no file and no network: the questions and the OpenAI key. */
export function precheck(options: Options): Failed | undefined {
  try {
    checkQuestions(options.questions);
  } catch (e) {
    return fail(e);
  }
  if (!(options.openaiApiKey ?? process.env.OPENAI_API_KEY)) return { ok: false, error: "OPENAI_API_KEY is not set (set it, or pass openaiApiKey)" };
  return undefined;
}

export type Breakdown = { ok: true; analysis: Analysis; frames: Buffer[] };

/** The analysis plus the 512 px frames the model saw (the CLI writes them out). */
export async function breakdown(input: string | Buffer, options: Options = {}): Promise<Breakdown | Failed> {
  const bad = precheck(options);
  if (bad) return bad;
  const questions = options.questions ?? [];
  const ff = { ffmpegPath: options.ffmpegPath, ffprobePath: options.ffprobePath };
  const oa = { openaiApiKey: options.openaiApiKey, openaiBaseUrl: options.openaiBaseUrl, fetch: options.fetch };

  let resolved;
  try {
    resolved = await resolveInput(input);
  } catch (e) {
    return fail(e);
  }
  try {
    const video = resolved.path;
    const { duration, audio } = await probe(video, ff);
    const spans = await detectScenes(video, { ...ff, duration });
    const [frames, thumbs] = await Promise.all([extractFrames(video, spans, ff), extractFrames(video, spans, { ...ff, side: THUMB_SIDE })]);

    // A video without speech is still analysed from its frames.
    let transcript: Transcript = { text: "", words: [] };
    let transcriptError: string | undefined;
    if (!audio) transcriptError = "no audio track";
    else {
      try {
        transcript = await transcribe(await extractAudio(video, ff), oa);
      } catch (e) {
        transcriptError = (e as Error).message;
      }
    }
    const texts = alignWords(transcript.words, spans);

    const decisions = await decide(sceneEvidence(spans, frames, texts, { duration, intro: SHORTFORM_INTRO }), shortformQuestions({ questions }), oa);
    const labels = parseShortform(decisions, questions);
    const scenes: Scene[] = spans.map((s, i) => ({
      index: i, start: s.start, end: s.end, ...(s.cut === false ? { cut: false as const } : {}),
      thumbnail: `data:image/jpeg;base64,${thumbs[i].toString("base64")}`,
      transcript: texts[i],
      ...labels.scenes[i],
    }));
    const analysis: Analysis = {
      schemaVersion: 1, ok: true, duration, scenes, sections: sectionsOf(scenes),
      format: labels.format, formatProbs: labels.formatProbs, goal: labels.goal, sells: labels.sells,
      production: labels.production, voice: labels.voice, ...(questions.length ? { answers: labels.answers } : {}),
      transcript: transcript.text,
      ...(transcript.language ? { language: transcript.language } : {}),
      ...(transcriptError ? { transcriptError } : {}),
      ...(labels.inputTokens !== undefined ? { inputTokens: labels.inputTokens } : {}),
    };
    return { ok: true, analysis, frames };
  } catch (e) {
    return fail(e);
  } finally {
    await resolved.cleanup();
  }
}

/** One short-form video → scenes with thumbnails, transcripts, beats, levers and hold; the video's format and goal. Never throws. */
export async function analyzeVideo(input: string | Buffer, options: Options = {}): Promise<Analysis | Failed> {
  const r = await breakdown(input, options);
  return r.ok ? r.analysis : r;
}
