// shortform-breakdown/primitives: Layers 1 and 2 (docs/concepts.md). Experimental: a minor version may change these.

// Layer 1 · building blocks
export { resolveInput, TIKTOK_URL, type ResolvedInput } from "./blocks/input.js";
export { probe } from "./blocks/probe.js";
export { detectScenes, MAX_SCENES, MAX_TAKE, MIN_SCENE, SCENE_THRESHOLD, type SceneOptions, type SceneRules } from "./blocks/scenes.js";
export { extractFrames, FRAME_SIDE, grabFrame, THUMB_SIDE, type FrameOptions } from "./blocks/frames.js";
export { extractAudio, transcribe, TRANSCRIBE_MODEL } from "./blocks/transcribe.js";
export { alignWords } from "./blocks/align.js";
export { frameEvidence, SCENE_INTRO, sceneEvidence } from "./blocks/evidence.js";
export { decide, DECISIONS_MODEL, MAX_DECISION_QUESTIONS } from "./blocks/decide.js";

// Layer 2 · short-form preset
export { checkQuestions, makingQuestions, MAX_QUESTIONS, SHORTFORM_INTRO, shortformQuestions } from "./shortform/questions.js";
export { parseMaking, parseShortform, type SceneLabels, type ShortformLabels } from "./shortform/parse.js";
export { sectionsOf } from "./shortform/sections.js";
export { BEAT_TEXT, FORMAT_TEXT, HOLD_LEVELS, LEVER_TEXT, PRODUCTION_TEXT, VOICE_TEXT } from "./shortform/labels.js";

export * from "./types.js";
