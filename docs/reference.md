# Reference

> The public contract of shortform-breakdown 0.1: entry points, inputs, outputs, CLI, MCP server and skill. The layers are explained in [concepts.md](concepts.md); labels and thresholds in [video-analysis.md](video-analysis.md).


### Layers

[concepts.md](concepts.md) defines them. In short:

| Layer | What | Import from | Stability |
| --- | --- | --- | --- |
| 3 · Pipeline & output | `analyzeVideo`, `screenVideo`, `screenCover`, `summarize`, `reportHtml`, CLI, MCP, skill | `shortform-breakdown` | Stable, semver |
| 2 · Short-form preset | `shortformQuestions`, `parseShortform`, `makingQuestions`, `parseMaking`, `sectionsOf` | `shortform-breakdown/primitives` | Experimental |
| 1 · Building blocks | `resolveInput`, `probe`, `detectScenes`, `grabFrame`, `extractFrames`, `extractAudio`, `transcribe`, `alignWords`, `sceneEvidence`, `frameEvidence`, `decide` | `shortform-breakdown/primitives` | Experimental |

Rules the code keeps:

- Each layer uses only what the layer below **exports**. `analyzeVideo` is written only from the `primitives` exports, so a caller can rebuild it (`tests/compose.test.ts`).
- ffmpeg runs and network calls happen only in Layer 1. Layer 2 is pure functions.
- Fallbacks for missing answers live in Layer 2. `decide` returns only what the model answered.
- "Experimental" means a minor version may change a `primitives` signature. Each change goes in the changelog. The subpath becomes stable in a later release.

### Import

```ts
import { analyzeVideo, reportHtml, summarize } from "shortform-breakdown";

const a = await analyzeVideo("clip.mp4", {
  questions: [{ name: "face_on_camera", question: "Is a person's face on camera at any point?" }],
});
if (!a.ok) throw new Error(a.error);
console.log(summarize(a));        // agent-readable text
await writeFile("report.html", reportHtml(a));
```

The building blocks, here scenes and words per scene with no model call:

```ts
import { probe, detectScenes, extractAudio, transcribe, alignWords } from "shortform-breakdown/primitives";

const { duration } = await probe("talk.mp4");
const spans = await detectScenes("talk.mp4", { duration, maxTake: 30 });
const texts = alignWords((await transcribe(await extractAudio("talk.mp4"))).words, spans);
```

### Exports from `shortform-breakdown`

| Export | Does |
| --- | --- |
| `analyzeVideo(input, options?)` | The full analysis. Returns `Analysis`, or `{ ok: false, error }` |
| `screenVideo(input, questions, options?)` | Frames at 15, 50 and 85 percent of the video, one Decisions request: production, voice, answers |
| `screenCover(image, questions, options?)` | The same from one cover image, before any download |
| `reportHtml(analysis, title?)` | A self-contained HTML page: the beat strip, then one row per scene |
| `summarize(analysis)` | Format, goal, scene count, production, then one line per section with its lever and what is said |
| `BEATS`, `LEVERS`, `FORMATS`, `PRODUCTIONS`, `VOICES` and the types | The label sets and output types |

**One error rule:** no export from `shortform-breakdown` throws for a bad video, a missing key or an API error. Each one returns `{ ok: false, error }`.

### Exports from `shortform-breakdown/primitives`

| Export | Layer | Does |
| --- | --- | --- |
| `resolveInput(input, options?)` | 1 | Path, Buffer or TikTok URL → `{ path, cleanup() }`. Buffers and downloads go to a temp file that `cleanup` removes |
| `probe(video, options?)` | 1 | `{ duration, audio }` |
| `detectScenes(video, options?)` | 1 | `Span[]`. Options: `duration`, `threshold` 0.3, `minScene` 0.4, `maxTake` 5, `maxScenes` 40 |
| `grabFrame(video, t, side?)` | 1 | One JPEG Buffer at `t` seconds, long side at most `side` px (512) |
| `extractFrames(video, spans, options?)` | 1 | One JPEG per span. Options: `at` 0.5 (the middle), `side` 512 |
| `extractAudio(video, options?)` | 1 | Mono 16 kHz MP3 Buffer |
| `transcribe(audio, options?)` | 1 | `{ text, words, language? }` from `whisper-1`, whisper's music lines dropped |
| `alignWords(words, spans)` | 1 | One string per span: the words whose midpoint falls in it. |
| `sceneEvidence(spans, frames, texts, { duration, intro? })` | 1 | `Evidence`: per scene, its time, frame and words. `{duration}` and `{scenes}` in `intro` are filled in |
| `frameEvidence(frames, intro)` | 1 | `Evidence` of frames only |
| `decide(evidence, questions, options?)` | 1 | One Decisions request → `Decisions { video, scenes[], inputTokens? }`. No fallbacks |
| `shortformQuestions({ questions? })` | 2 | The beat, lever, hold, text, format, sells, production and voice questions, plus `q_<name>` per caller question |
| `parseShortform(decisions, questions?)` | 2 | Labels per scene and for the video, with the fallbacks |
| `makingQuestions({ questions? })`, `parseMaking(decisions, questions?)` | 2 | Production, voice and the caller's questions only, for the screen check |
| `sectionsOf(scenes)` | 2 | Consecutive scenes with the same beat → `Section[]` |
| `BEAT_TEXT`, `LEVER_TEXT`, `FORMAT_TEXT`, `PRODUCTION_TEXT`, `VOICE_TEXT`, `HOLD_LEVELS` | 2 | The label descriptions the model reads |
| Types: `Span`, `Word`, `Transcript`, `Evidence`, `DecisionQuestion`, `Decisions`, `DecisionAnswer` | 1 | |

`DecisionQuestion` is `{ type: "predicate" | "choice" | "score", name, instructions, scope?: "video" | "scene", choices? | levels? }`. A `scene` question is sent once per scene as `<name>_<i>`, with `{scene}` in `instructions` replaced by the scene number from 1. After that expansion a request holds 1 to 400 questions, or `decide` throws before sending. Names match `[a-z0-9_]+` and are unique. The `q_` prefix keeps a caller's question from colliding with a preset name.

**Errors in `primitives`:** these functions **throw** an `Error` whose message starts with its stage (`input:`, `video:`, `transcribe:`, `decide:`; `questions:` from `checkQuestions`). A missing key throws `decide: OPENAI_API_KEY is not set …` (or `transcribe:`) before any request. The Layer 3 functions catch these and return `{ ok: false, error }` with the same message.

Internal helpers (`run`, `parseCuts`, `buildScenes`, `splitLong`, `capScenes`, `dropHallucinations`, request building) stay unexported. Tests import them from the `src/` files directly.

### Input

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `input` | string or Buffer | yes | A local file path, the video's bytes, or a TikTok post URL (`https://www.tiktok.com/@<user>/video/<id>`). Any other URL fails with "download the video first and pass the file" |
| `options.openaiApiKey` | string | no | Default: env `OPENAI_API_KEY`. |
| `options.openaiBaseUrl` | string | no | Default: env `OPENAI_BASE_URL`, else `https://api.openai.com/v1` |
| `options.apinoaApiKey` | string | no | Default: env `APINOA_API_KEY`. Needed only for URL input |
| `options.questions` | Question[] | no | Up to 20. |
| `options.ffmpegPath` | string | no | Default: `ffmpeg` |
| `options.ffprobePath` | string | no | Default: `ffprobe` |
| `options.fetch` | typeof fetch | no | Default: global fetch. Tests inject a fake |

`Question` is `{ name, question }`. `name` is unique and matches `[a-z0-9_]+`. `question` is a yes/no question about what is in the video. Layer 2 turns each one into the video-scope predicate `q_<name>`. A caller who wants a question per scene, or a choice or score question, uses `decide` from `primitives` instead.

The `primitives` functions take the same `openaiApiKey`, `openaiBaseUrl`, `apinoaApiKey`, `ffmpegPath`, `ffprobePath` and `fetch` options, with the same defaults, wherever they apply.

```json
{
  "input": "clip.mp4",
  "options": {
    "questions": [{ "name": "face_on_camera", "question": "Is a person's face on camera at any point?" }]
  }
}
```

### Output

`Analysis`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | 1 | yes | Raised on any breaking change |
| `ok` | true | yes | |
| `duration` | number | yes | Seconds |
| `scenes` | Scene[] | yes | In order. Together they cover 0 to `duration`; at most 40 |
| `sections` | Section[] | yes | Consecutive scenes with the same beat |
| `format` | string | yes | meme, skit, product_demo, tutorial, review, storytime, before_after, unboxing, behind_the_scenes, talking_head, other |
| `formatProbs` | object of number | yes | Probability per format |
| `goal` | string | yes | conversion when `sells` is 0.5 or more, else awareness |
| `sells` | number | yes | Probability the video asks the viewer to buy, sign up or click |
| `production` | string | yes | on_camera_person, screen_recording, hands_only, broll_voiceover, text_only, animation, mixed |
| `voice` | string | yes | on_camera_speech, voiceover, none, music_only |
| `answers` | object of number | no | Probability of yes per question name. Present only when questions were asked. |
| `transcript` | string | yes | The whole video. Empty when nothing is said |
| `language` | string | no | As whisper names it, e.g. english |
| `transcriptError` | string | no | Why the transcript is empty, when it is |
| `inputTokens` | number | no | Decisions usage |

`Scene`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `index` | number | yes | From 0 |
| `start` | number | yes | Seconds |
| `end` | number | yes | Seconds |
| `cut` | false | no | Present only when the scene continues the take before it (a take over 5 s split up) |
| `thumbnail` | string | yes | JPEG data URL, at most 160 px. The model saw 512 px |
| `transcript` | string | yes | The words whose midpoint falls in the scene |
| `beat` | string | yes | hook, setup, value, proof, payoff, cta |
| `beatProbs` | object of number | yes | |
| `lever` | string | yes | curiosity, pattern_interrupt, relatable, demonstration, social_proof, emotion, direct_ask, none |
| `leverProbs` | object of number | yes | |
| `hold` | number | yes | 0 (viewers scroll away) to 4 (nearly impossible to scroll away), probability-weighted |
| `textOnScreen` | number | no | Probability the scene shows text on screen |

`Section`: `beat`, `start`, `end`, `scenes` (scene indexes), `transcript`.

Failure: `{ "ok": false, "error": "<one line a person can act on>" }`.

Illustrative values, not a real video:

```json
{
  "schemaVersion": 1,
  "ok": true,
  "duration": 6.0,
  "scenes": [
    {
      "index": 0, "start": 0, "end": 2.1,
      "thumbnail": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
      "transcript": "I tried the cheapest one first.",
      "beat": "hook", "beatProbs": { "hook": 0.86, "setup": 0.09, "value": 0.05 },
      "lever": "curiosity", "leverProbs": { "curiosity": 0.71, "relatable": 0.2, "none": 0.09 },
      "hold": 3.1, "textOnScreen": 0.92
    },
    {
      "index": 1, "start": 2.1, "end": 6.0,
      "thumbnail": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
      "transcript": "It lasted two days. This one is still going.",
      "beat": "payoff", "beatProbs": { "payoff": 0.62, "proof": 0.3, "value": 0.08 },
      "lever": "demonstration", "leverProbs": { "demonstration": 0.8, "social_proof": 0.12, "none": 0.08 },
      "hold": 2.6, "textOnScreen": 0.4
    }
  ],
  "sections": [
    { "beat": "hook", "start": 0, "end": 2.1, "scenes": [0], "transcript": "I tried the cheapest one first." },
    { "beat": "payoff", "start": 2.1, "end": 6.0, "scenes": [1], "transcript": "It lasted two days. This one is still going." }
  ],
  "format": "review",
  "formatProbs": { "review": 0.64, "product_demo": 0.3, "other": 0.06 },
  "goal": "awareness",
  "sells": 0.31,
  "production": "hands_only",
  "voice": "voiceover",
  "answers": { "face_on_camera": 0.04 },
  "transcript": "I tried the cheapest one first. It lasted two days. This one is still going.",
  "language": "english",
  "inputTokens": 2140
}
```

**Fallbacks:**
- A missing or refused Decisions answer falls back to: beat `value`, lever `none`, hold 2, format `other`, production `mixed`, voice `none`, question 0.5.
- Audio that can't be transcribed gives an empty transcript plus `transcriptError`, and the analysis still runs on the frames.
- An unreadable video or a missing key returns `ok: false`. Never return a partial `Analysis`.

### CLI

```
npx shortform-breakdown analyze <file-or-tiktok-url> [--out <dir>] [--question name="question"]... [--json]
npx shortform-breakdown screen  <file-or-tiktok-url> --question name="question"...
npx shortform-breakdown mcp
```

- `analyze` writes to `--out`. The default is `<file>.breakdown/`, or `./<post id>.breakdown/` for a URL. It writes:
  - `analysis.json`;
  - `report.html`;
  - `frames/01.jpg` and onwards: the 512 px frames the model saw;
  - `sheet.jpg`: every frame tiled 4 wide (ffmpeg `tile`), so an agent can look at one image.
  
  It prints `summarize()` to stdout, or the JSON with `--json`.
- Exit codes: 0 ok, 1 analysis failed (the error goes to stderr), 2 usage error.

### MCP server

`shortform-breakdown mcp` runs over stdio. It is built on `@modelcontextprotocol/sdk` and zod.

| Tool | Input | Returns |
| --- | --- | --- |
| `analyze_video` | `input` (a path or TikTok URL), `questions` (optional) | The `summarize()` text, the output folder path, and the analysis without thumbnails (base64 wastes the model's context) |
| `screen_video` | `input`, `questions` | production, voice, answers |

Setup lines for Claude Code, Claude Desktop and Cursor are in the README.

### Agent skill

`skills/shortform-breakdown/SKILL.md` uses the Agent Skills format: `name` and `description` frontmatter, then the body. The body covers:
- when to use it: someone wants to know why a short video works, or how to borrow its structure;
- the command: `npx shortform-breakdown analyze <file-or-url>`;
- reading the summary, and opening `sheet.jpg` to see the frames;
- what the labels mean (link the tables in `docs/video-analysis.md`);
- keys and costs.

The skill ships in both the npm package and the repo, so skills.sh can list it.

## Examples

Each row is pinned by a test in `tests/`.

| # | Case | Input | Expected |
| --- | --- | --- | --- |
| 1 | Three hard cuts with sound | lavfi red, green, blue shots of 1.5 s each, 360x640, plus a 440 Hz tone | 3 scenes starting at 0, 1.5 and 3.0 s (within 0.1). Calls: transcription, then decisions |
| 2 | No audio track | The same video without the tone | ok. `transcriptError` is "no audio track". Calls: decisions only |
| 3 | One long take | One 11 s shot | 3 scenes of equal length. Scenes 2 and 3 have `cut: false` |
| 4 | Whisper's music line | A transcription whose segment is "Thanks for watching!" with no_speech 0.5 and avg_logprob -0.86 | The segment and its words are dropped |
| 5 | Missing or refused answers | A two-scene Decisions reply where `beat_1` is a refusal and `lever_1` and `hold_1` are missing | Scene 2: beat `value`, lever `none`, hold 2. Scene 1 keeps its answers |
| 6 | No OpenAI key | Example 1 with an empty key | ok false. The error names `OPENAI_API_KEY`. No network call |
| 7 | Unreadable file | A path that does not exist (`/nope.mp4`) | ok false. The error starts with "video:" |
| 8 | TikTok URL without an apinoa key | `https://www.tiktok.com/@<user>/video/<id>` with no `APINOA_API_KEY` | ok false. The error names `APINOA_API_KEY`. No request made |
| 9 | Unsupported URL | `https://example.com/video.mp4` | ok false. The error says to download the video and pass the file |
| 10 | 25 questions | Example 1 with 25 questions | ok false. The error says the maximum is 20 |
| 14 | A scene question of your own | `decide` on Example 1's evidence with one predicate `logo`, scope `scene`, "Is a logo visible in scene {scene}?" | The request holds `logo_0`, `logo_1`, `logo_2`, their instructions name scenes 1, 2 and 3. `scenes[i].logo.probability` comes back per scene |
| 15 | Too many questions | `decide` on a 40-scene evidence with 11 scene-scope questions (440 after expansion) | Throws, the message starts with "decide:" and says 400. No network call |
| 16 | An answer left out | `decide` where the reply has no `logo_1` | `scenes[1].logo` is undefined. No fallback value |
| 17 | The parts rebuild the whole | Examples 1 to 3, once through `analyzeVideo` and once through a pipeline made from `primitives` exports | Deep-equal `Analysis` objects |
| 18 | Scene rules as options | Example 3's 11 s take with `detectScenes(video, { maxTake: 3 })` | 4 scenes of 2.75 s. Scenes 2 to 4 have `cut: false` |

