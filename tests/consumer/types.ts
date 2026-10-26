import { analyzeVideo, type Analysis, type Beat, type Question } from "shortform-analyzer";
import { decide, sceneEvidence, shortformQuestions, type DecisionQuestion, type Decisions, type Span } from "shortform-analyzer/primitives";

const q: Question[] = [{ name: "face", question: "Is a face on camera?" }];
const qs: DecisionQuestion[] = [...shortformQuestions({ questions: q }), { type: "predicate", name: "logo", scope: "scene", instructions: "Logo in scene {scene}?" }];
const spans: Span[] = [{ start: 0, end: 1 }];

export async function check(): Promise<Beat | undefined> {
  const r = await analyzeVideo("clip.mp4", { questions: q });
  const a: Analysis | undefined = r.ok ? r : undefined;
  const d: Decisions = await decide(sceneEvidence(spans, [Buffer.from("")], [""], { duration: 1 }), qs);
  void d.scenes[0]?.logo?.probability;
  return a?.scenes[0]?.beat;
}
