import { BEATS, FORMATS, LEVERS, PRODUCTIONS, VOICES, type Beat, type DecisionAnswer, type Decisions, type Format, type Goal, type Lever,
  type Making, type Probs, type Question } from "../types.js";

export type SceneLabels = { beat: Beat; beatProbs: Probs; lever: Lever; leverProbs: Probs; hold: number; textOnScreen?: number };
export type ShortformLabels = Making & {
  scenes: SceneLabels[];
  format: Format;
  formatProbs: Probs;
  sells: number;
  goal: Goal;
  inputTokens?: number;
};

function pick<T extends string>(a: DecisionAnswer | undefined, options: readonly T[], fallback: T): { value: T; probs: Probs } {
  const value = options.includes(a?.choice as T) ? (a!.choice as T) : fallback;
  return { value, probs: a?.probs ?? {} };
}

/** Production, voice and the caller's questions, with the fallbacks: mixed, none, 0.5. */
export function parseMaking(decisions: Decisions, questions: Question[] = []): Making {
  const v = decisions.video;
  return {
    production: pick(v.production, PRODUCTIONS, "mixed").value,
    voice: pick(v.voice, VOICES, "none").value,
    answers: Object.fromEntries(questions.map((q) => [q.name, v[`q_${q.name}`]?.probability ?? 0.5])),
  };
}

/** The short-form preset's answers with its fallbacks: beat value, lever none, hold 2, format other, sells 0. */
export function parseShortform(decisions: Decisions, questions: Question[] = []): ShortformLabels {
  const scenes = decisions.scenes.map((s): SceneLabels => {
    const beat = pick(s.beat, BEATS, "value");
    const lever = pick(s.lever, LEVERS, "none");
    return {
      beat: beat.value, beatProbs: beat.probs, lever: lever.value, leverProbs: lever.probs, hold: s.hold?.score ?? 2,
      ...(s.text?.probability !== undefined ? { textOnScreen: s.text.probability } : {}),
    };
  });
  const format = pick(decisions.video.format, FORMATS, "other");
  const sells = decisions.video.sells?.probability ?? 0;
  return {
    scenes, format: format.value, formatProbs: format.probs, sells, goal: sells >= 0.5 ? "conversion" : "awareness",
    ...parseMaking(decisions, questions),
    ...(decisions.inputTokens !== undefined ? { inputTokens: decisions.inputTokens } : {}),
  };
}
