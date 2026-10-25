// Ported from the hackathon (commit 282ac87), renamed for the layers: no ffmpeg, no network.
import { describe, expect, it } from "vitest";
import { buildScenes, capScenes, parseCuts } from "../src/blocks/scenes.js";
import { dropHallucinations } from "../src/blocks/transcribe.js";
import { decisionsRequest, parseAnswers } from "../src/blocks/decide.js";
import { alignWords, frameEvidence, makingQuestions, parseMaking, parseShortform, sceneEvidence, sectionsOf, SHORTFORM_INTRO, shortformQuestions, type Scene } from "../src/primitives.js";
import { screenCover } from "../src/index.js";

describe("scenes", () => {
  it("reads cut times from ffmpeg's showinfo log", () => {
    const log = `[Parsed_showinfo_2 @ 0x1] n:   0 pts:  30720 pts_time:2.4     duration:512
[Parsed_showinfo_2 @ 0x1] n:   1 pts:  64000 pts_time:5.0333  duration:512
frame=  9 fps=0.0`;
    expect(parseCuts(log)).toEqual([2.4, 5.0333]);
  });

  it("covers the whole video, one scene when there is no cut", () => {
    expect(buildScenes([], 4)).toEqual([{ start: 0, end: 4 }]);
    expect(buildScenes([2, 5], 7)).toEqual([{ start: 0, end: 2 }, { start: 2, end: 5 }, { start: 5, end: 7 }]);
  });

  it("splits a take over 5 s into equal parts that are not cuts", () => {
    expect(buildScenes([], 11)).toEqual([{ start: 0, end: 11 / 3 }, { start: 11 / 3, end: 22 / 3, cut: false }, { start: 22 / 3, end: 11, cut: false }]);
    expect(buildScenes([1, 6], 7)).toEqual([{ start: 0, end: 1 }, { start: 1, end: 6 }, { start: 6, end: 7 }]);
  });

  it("joins scenes under 0.4 s to the one before, the first to the one after", () => {
    expect(buildScenes([2, 2.2, 5], 7)).toEqual([{ start: 0, end: 2.2 }, { start: 2.2, end: 5 }, { start: 5, end: 7 }]);
    expect(buildScenes([0.2, 3], 6)).toEqual([{ start: 0, end: 3 }, { start: 3, end: 6 }]);
  });

  it("caps the count by merging the shortest scene into its shorter neighbour", () => {
    const spans = [{ start: 0, end: 3 }, { start: 3, end: 3.5 }, { start: 3.5, end: 5 }, { start: 5, end: 9 }];
    expect(capScenes(spans, 3)).toEqual([{ start: 0, end: 3 }, { start: 3, end: 5 }, { start: 5, end: 9 }]);
  });

  it("takes each rule as an option", () => {
    expect(buildScenes([], 11, { maxTake: 3 })).toHaveLength(4);
    expect(buildScenes([2, 2.2, 5], 7, { minScene: 0.1 })).toHaveLength(4);
    expect(buildScenes([1, 2, 3, 4], 5, { maxScenes: 2 })).toHaveLength(2);
  });
});

describe("transcript", () => {
  it("puts each word in the scene its midpoint falls in", () => {
    const words = [
      { word: "Stop", start: 0.1, end: 0.4 }, { word: "scrolling", start: 0.4, end: 1.0 }, { word: ".", start: 1.0, end: 1.0 },
      { word: "Look", start: 1.9, end: 2.3 }, { word: "late", start: 9.0, end: 9.5 },
    ];
    expect(alignWords(words, [{ start: 0, end: 2 }, { start: 2, end: 5 }, { start: 5, end: 8 }])).toEqual(["Stop scrolling.", "Look", "late"]);
  });

  // Example 4. Measured on real reels (2026-10-24).
  it("drops whisper's 'Thanks for watching!' on music, keeps real speech even when no_speech is high", () => {
    const t = dropHallucinations({
      text: "Grab it now. Thanks for watching!",
      language: "english",
      words: [{ word: "Grab", start: 1, end: 1.3 }, { word: "it", start: 1.3, end: 1.5 }, { word: "now.", start: 1.5, end: 2 },
        { word: "Thanks", start: 9.6, end: 10 }, { word: "for", start: 10, end: 10.2 }, { word: "watching!", start: 10.2, end: 11 }],
      segments: [
        { start: 0.5, end: 2.2, text: " Grab it now.", no_speech_prob: 0.54, avg_logprob: -0.22 },
        { start: 9.6, end: 11, text: " Thanks for watching!", no_speech_prob: 0.5, avg_logprob: -0.86 },
      ],
    });
    expect(dropHallucinations({ text: "Thanks for watching", words: [{ word: "Thanks", start: 9, end: 9.5 }],
      segments: [{ start: 9, end: 10, text: " Thanks for watching", no_speech_prob: 0.1, avg_logprob: -0.3 }] }).text).toBe("");
    expect(t).toEqual({ text: "Grab it now.", words: [{ word: "Grab", start: 1, end: 1.3 }, { word: "it", start: 1.3, end: 1.5 }, { word: "now.", start: 1.5, end: 2 }], language: "english" });
  });
});

describe("decisions with the short-form preset", () => {
  const spans = [{ start: 0, end: 2 }, { start: 2, end: 4, cut: false as const }];
  const ev = sceneEvidence(spans, [Buffer.from("jpg"), Buffer.from("jpg")], ["hi", ""], { duration: 4, intro: SHORTFORM_INTRO });

  it("sends every scene's frame and words once, says which continue a take, with beat, lever and hold per scene", () => {
    const req = decisionsRequest(ev, shortformQuestions());
    expect(req.model).toBe("gpt-6-luna");
    const content = req.input[0].content as { type: string; text?: string }[];
    expect(content[0].text).toBe("A short-form social video, 4.0 s long, in 2 scenes. Each scene: its time, a frame from its middle, and what is said in it.");
    expect(content.filter((c) => c.type === "input_image")).toHaveLength(2);
    expect(content[1].text).toContain('Said: "hi"');
    expect(content[3].text).toContain("Nothing said");
    expect(content[3].text).toContain("the same take");
    expect(content[1].text).not.toContain("the same take");
    expect(req.questions.map((q) => `${q.type}:${q.name}`)).toEqual(["choice:beat_0", "choice:lever_0", "score:hold_0", "predicate:text_0", "choice:beat_1", "choice:lever_1", "score:hold_1", "predicate:text_1",
      "choice:format", "predicate:sells", "choice:production", "choice:voice"]);
    expect(req.questions[4].instructions).toBe("Which part of the short-form video structure does scene 2 play?");
  });

  it("asks one predicate per question, about what is in the video", () => {
    const req = decisionsRequest(ev, shortformQuestions({ questions: [{ name: "no_face", question: "Is a person's face shown on camera for more than a brief moment?" }] }));
    expect(req.questions.at(-1)).toEqual({ type: "predicate", name: "q_no_face", instructions: "Is a person's face shown on camera for more than a brief moment?" });
  });

  it("reads how the video is made, text on screen and each question", () => {
    const qs = [{ name: "no_face", question: "q" }];
    const d = parseShortform(parseAnswers({ answers: [
      { type: "choice", name: "production", choice: "hands_only" },
      { type: "choice", name: "voice", choice: "voiceover" },
      { type: "predicate", name: "text_0", probability: 0.9 },
      { type: "predicate", name: "q_no_face", probability: 0.2 },
    ] }, shortformQuestions({ questions: qs }), 1), qs);
    expect(d).toMatchObject({ production: "hands_only", voice: "voiceover", answers: { no_face: 0.2 } });
    expect(d.scenes[0].textOnScreen).toBe(0.9);
  });

  it("screens a cover with only the making questions", async () => {
    let body: { questions: { name: string }[] } | undefined;
    const fake = (async (_u: string, init: { body: string }) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({ answers: [{ type: "choice", name: "production", choice: "on_camera_person" }, { type: "predicate", name: "q_no_face", probability: 0.1 }] }));
    }) as unknown as typeof fetch;
    const m = await screenCover(Buffer.from("jpg"), [{ name: "no_face", question: "q" }], { openaiApiKey: "k", fetch: fake });
    expect(body!.questions.map((q) => q.name)).toEqual(["production", "voice", "q_no_face"]);
    expect(m).toEqual({ ok: true, production: "on_camera_person", voice: "none", answers: { no_face: 0.1 } });
  });

  // Example 5.
  it("reads the answers, falling back when one is missing or refused", () => {
    const d = parseShortform(parseAnswers({
      answers: [
        { type: "choice", name: "beat_0", choice: "hook", probabilities: [{ value: "hook", probability: 0.9 }, { value: "setup", probability: 0.1 }] },
        { type: "choice", name: "lever_0", choice: "curiosity", probabilities: [] },
        { type: "score", name: "hold_0", score: 3.2 },
        { type: "refusal", name: "beat_1" },
        { type: "choice", name: "format", choice: "product_demo", probabilities: [{ value: "product_demo", probability: 0.8 }] },
        { type: "predicate", name: "sells", probability: 0.7 },
      ],
      usage: { input_tokens: 1234 },
    }, shortformQuestions(), 2));
    expect(d.scenes[0]).toMatchObject({ beat: "hook", beatProbs: { hook: 0.9, setup: 0.1 }, lever: "curiosity", hold: 3.2 });
    expect(d.scenes[1]).toMatchObject({ beat: "value", lever: "none", hold: 2 });
    expect(d).toMatchObject({ format: "product_demo", sells: 0.7, goal: "conversion", inputTokens: 1234, production: "mixed", voice: "none" });
  });

  it("frame evidence carries the images and their type, and no scene count", () => {
    const ev2 = frameEvidence([Buffer.from("a"), { image: Buffer.from("b"), mime: "image/png" }], "Frames.");
    const req = decisionsRequest(ev2, makingQuestions());
    expect((req.input[0].content as { image_url?: string }[]).map((c) => c.image_url?.slice(0, 15))).toEqual([undefined, "data:image/jpeg", "data:image/png;"]);
    expect(parseMaking(parseAnswers({}, makingQuestions(), 0))).toEqual({ production: "mixed", voice: "none", answers: {} });
  });
});

describe("sections", () => {
  const scene = (index: number, beat: Scene["beat"], transcript = ""): Scene =>
    ({ index, start: index, end: index + 1, beat, transcript, thumbnail: "", beatProbs: {}, lever: "none", leverProbs: {}, hold: 2 });

  it("joins consecutive scenes with the same beat", () => {
    const s = sectionsOf([scene(0, "hook", "Wait."), scene(1, "value", "Step one"), scene(2, "value"), scene(3, "value", "step two"), scene(4, "cta", "Follow")]);
    expect(s.map((x) => [x.beat, x.start, x.end, x.scenes, x.transcript])).toEqual([
      ["hook", 0, 1, [0], "Wait."], ["value", 1, 4, [1, 2, 3], "Step one step two"], ["cta", 4, 5, [4], "Follow"],
    ]);
  });
});
