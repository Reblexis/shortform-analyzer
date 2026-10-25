import {
  decide, FRAME_SIDE, frameEvidence, grabFrame, makingQuestions, parseMaking, probe, resolveInput,
  type Failed, type Options, type Question, type Screen,
} from "../primitives.js";
import { fail, precheck } from "./analyze.js";

/** Where the lean check looks: early, middle and late in the video, so a face after a product cover is seen. */
export const SCREEN_AT = [0.15, 0.5, 0.85];

/** The lean check: 3 frames and one Decisions request on how the video is made and the caller's questions. Never throws. */
export async function screenVideo(input: string | Buffer, questions: Question[], options: Options = {}): Promise<Screen | Failed> {
  const opts = { ...options, questions };
  const bad = precheck(opts);
  if (bad) return bad;
  const ff = { ffmpegPath: options.ffmpegPath, ffprobePath: options.ffprobePath };
  let resolved;
  try {
    resolved = await resolveInput(input);
  } catch (e) {
    return fail(e);
  }
  try {
    const { duration } = await probe(resolved.path, ff);
    const frames = await Promise.all(SCREEN_AT.map((p) => grabFrame(resolved.path, duration * p, FRAME_SIDE, ff)));
    const d = await decide(frameEvidence(frames, "Frames from a short-form social video, in order."), makingQuestions({ questions }), options);
    return { ok: true, ...parseMaking(d, questions) };
  } catch (e) {
    return fail(e);
  } finally {
    await resolved.cleanup();
  }
}

/** The same check from one cover image, before any download. Never throws. */
export async function screenCover(image: Buffer, questions: Question[], options: Options & { mime?: string } = {}): Promise<Screen | Failed> {
  const bad = precheck({ ...options, questions });
  if (bad) return bad;
  try {
    const d = await decide(frameEvidence([{ image, mime: options.mime }], "The cover frame of a short-form social video."), makingQuestions({ questions }), options);
    return { ok: true, ...parseMaking(d, questions) };
  } catch (e) {
    return fail(e);
  }
}
