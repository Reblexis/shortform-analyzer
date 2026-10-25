// The types every layer shares (docs/concepts.md, docs/reference.md "Output").

export const BEATS = ["hook", "setup", "value", "proof", "payoff", "cta"] as const;
export type Beat = (typeof BEATS)[number];

export const LEVERS = ["curiosity", "pattern_interrupt", "relatable", "demonstration", "social_proof", "emotion", "direct_ask", "none"] as const;
export type Lever = (typeof LEVERS)[number];

export const FORMATS = [
  "meme", "skit", "product_demo", "tutorial", "review", "storytime",
  "before_after", "unboxing", "behind_the_scenes", "talking_head", "other",
] as const;
export type Format = (typeof FORMATS)[number];

export type Goal = "conversion" | "awareness";

/** How the video is made: what someone would need to make one like it. */
export const PRODUCTIONS = ["on_camera_person", "screen_recording", "hands_only", "broll_voiceover", "text_only", "animation", "mixed"] as const;
export type Production = (typeof PRODUCTIONS)[number];

export const VOICES = ["on_camera_speech", "voiceover", "none", "music_only"] as const;
export type Voice = (typeof VOICES)[number];

/** A caller's own yes/no question about what is in the video; it becomes the `q_<name>` predicate. */
export type Question = { name: string; question: string };

/** A scene's span in seconds; `cut: false` when it continues the take before it (a long take split up). */
export type Span = { start: number; end: number; cut?: false };

/** One transcribed word with its time in seconds. */
export type Word = { word: string; start: number; end: number };

export type Transcript = { text: string; words: Word[]; language?: string };

/** A probability per option, as Decisions returns them. */
export type Probs = Record<string, number>;

// ---- Layer 1: evidence and decisions ----

export type EvidenceItem = { type: "text"; text: string } | { type: "image"; image: Buffer; mime?: string };

/** What the decision model reads, in order. `scenes` is how many scenes it covers (0 for frames only). */
export type Evidence = { intro: string; items: EvidenceItem[]; scenes: number };

type QuestionBase = { name: string; instructions: string; scope?: "video" | "scene" };
export type DecisionQuestion =
  | (QuestionBase & { type: "predicate" })
  | (QuestionBase & { type: "choice"; choices: { value: string; description?: string }[] })
  | (QuestionBase & { type: "score"; levels: { label: string; description?: string }[] });

/** One answer as the model gave it: `probability` for a predicate, `choice` and `probs` for a choice, `score` for a score. */
export type DecisionAnswer = { probability?: number; choice?: string; probs?: Probs; score?: number };

/** What `decide` returns: only what the model answered. A refused or missing answer is absent. */
export type Decisions = {
  video: Record<string, DecisionAnswer>;
  scenes: Record<string, DecisionAnswer>[];
  inputTokens?: number;
};

// ---- Options ----

export type OpenAIOptions = {
  /** Default: env OPENAI_API_KEY. */
  openaiApiKey?: string;
  /** Default: env OPENAI_BASE_URL, else https://api.openai.com/v1. */
  openaiBaseUrl?: string;
  fetch?: typeof fetch;
};

export type FfmpegOptions = {
  /** Default: ffmpeg. */
  ffmpegPath?: string;
  /** Default: ffprobe. */
  ffprobePath?: string;
};

export type Options = OpenAIOptions & FfmpegOptions & {
  /** Up to 20 yes/no questions about the video. */
  questions?: Question[];
};

// ---- Layer 2 and 3: the short-form analysis ----

export type Scene = Span & {
  index: number;
  /** The scene's middle frame, a JPEG data URL (at most 160 px; the model sees 512 px). */
  thumbnail: string;
  transcript: string;
  beat: Beat;
  beatProbs: Probs;
  lever: Lever;
  leverProbs: Probs;
  /** 0 (viewers scroll away) to 4 (nearly impossible to scroll away), probability-weighted. */
  hold: number;
  /** Probability the scene shows text on screen. */
  textOnScreen?: number;
};

/** Consecutive scenes with the same beat. */
export type Section = { beat: Beat; start: number; end: number; scenes: number[]; transcript: string };

export type Analysis = {
  schemaVersion: 1;
  ok: true;
  duration: number;
  scenes: Scene[];
  sections: Section[];
  format: Format;
  formatProbs: Probs;
  goal: Goal;
  /** Probability the video tries to get the viewer to buy, sign up or click. */
  sells: number;
  production: Production;
  voice: Voice;
  /** Per question asked, the probability the answer is yes. */
  answers?: Record<string, number>;
  transcript: string;
  language?: string;
  /** Why the transcript is empty, when it is. */
  transcriptError?: string;
  inputTokens?: number;
};

/** How the video is made, and the caller's questions: what the screen check returns. */
export type Making = { production: Production; voice: Voice; answers: Record<string, number> };

export type Screen = { ok: true } & Making;

export type Failed = { ok: false; error: string };
