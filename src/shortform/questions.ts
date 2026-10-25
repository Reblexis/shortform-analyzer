import { BEATS, FORMATS, LEVERS, PRODUCTIONS, VOICES, type DecisionQuestion, type Question } from "../types.js";
import { BEAT_TEXT, FORMAT_TEXT, HOLD_LEVELS, LEVER_TEXT, PRODUCTION_TEXT, VOICE_TEXT } from "./labels.js";

export const MAX_QUESTIONS = 20;
const NAME = /^[a-z0-9_]+$/;

/** The intro line the short-form preset gives `sceneEvidence`. */
export const SHORTFORM_INTRO = "A short-form social video, {duration} s long, in {scenes} scenes. Each scene: its time, a frame from its middle, and what is said in it.";

/** Throws unless there are at most 20 questions, each with a unique `[a-z0-9_]+` name and a question. */
export function checkQuestions(questions: Question[] = []): void {
  if (questions.length > MAX_QUESTIONS) throw new Error(`questions: ${questions.length} questions; the maximum is ${MAX_QUESTIONS}`);
  const seen = new Set<string>();
  for (const q of questions) {
    if (!NAME.test(q.name ?? "")) throw new Error(`questions: name "${q.name}" must match [a-z0-9_]+`);
    if (seen.has(q.name)) throw new Error(`questions: name "${q.name}" is used twice`);
    if (!q.question?.trim()) throw new Error(`questions: "${q.name}" has no question`);
    seen.add(q.name);
  }
}

/** How the video is made, then one `q_<name>` predicate per caller question. */
export function makingQuestions(options: { questions?: Question[] } = {}): DecisionQuestion[] {
  checkQuestions(options.questions);
  return [
    { type: "choice", name: "production", instructions: "How is this video made?", choices: PRODUCTIONS.map((p) => ({ value: p, description: PRODUCTION_TEXT[p] })) },
    { type: "choice", name: "voice", instructions: "What carries the audio?", choices: VOICES.map((v) => ({ value: v, description: VOICE_TEXT[v] })) },
    ...(options.questions ?? []).map((q): DecisionQuestion => ({ type: "predicate", name: `q_${q.name}`, instructions: q.question })),
  ];
}

/** The short-form preset: beat, lever, hold and text per scene; format, sells, production, voice and the caller's questions. */
export function shortformQuestions(options: { questions?: Question[] } = {}): DecisionQuestion[] {
  return [
    {
      type: "choice", name: "beat", scope: "scene",
      instructions: "Which part of the short-form video structure does scene {scene} play?",
      choices: BEATS.map((b) => ({ value: b, description: BEAT_TEXT[b] })),
    },
    {
      type: "choice", name: "lever", scope: "scene",
      instructions: "What does scene {scene} mainly do to keep the viewer watching or get them to act?",
      choices: LEVERS.map((l) => ({ value: l, description: LEVER_TEXT[l] })),
    },
    { type: "score", name: "hold", scope: "scene", instructions: "How strongly does scene {scene} make the viewer keep watching?", levels: HOLD_LEVELS },
    { type: "predicate", name: "text", scope: "scene", instructions: "Does scene {scene} show text on screen (captions, titles or overlaid words)?" },
    { type: "choice", name: "format", instructions: "What type of short-form video is this?", choices: FORMATS.map((f) => ({ value: f, description: FORMAT_TEXT[f] })) },
    { type: "predicate", name: "sells", instructions: "Does the video try to get the viewer to buy, sign up, download or click a link?" },
    ...makingQuestions(options),
  ];
}
