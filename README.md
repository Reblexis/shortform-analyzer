<div align="center">

# shortform-analyzer

*Break a short-form video into scenes, and say why each one keeps the viewer watching*

[![npm version](https://img.shields.io/npm/v/shortform-analyzer?style=flat-square)](https://www.npmjs.com/package/shortform-analyzer)
[![Build Status](https://img.shields.io/github/actions/workflow/status/trevkang/shortform-analyzer/ci.yml?style=flat-square&label=CI)](https://github.com/trevkang/shortform-analyzer/actions)
[![Node.js](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Features](#features) • [Benchmark](#benchmark) • [Get started](#get-started) • [Usage](#usage) • [How it works](#how-it-works) • [Building blocks](#building-blocks)

<img src="https://raw.githubusercontent.com/trevkang/shortform-analyzer/main/docs/media/how-it-works.gif" width="100%" alt="A real TikTok (Zach King, a message to all AI, 27.9 s) plays while detectScenes cuts its timeline into 17 scenes. Then one Decisions request labels every scene at once: a beat (hook, setup, value, payoff, cta), a hold score, and the sections. The video is a skit, awareness, made as on camera person. Last, the playhead runs over the timeline again and shows each scene with its labels and words.">

<sub>A real run of <code>analyzeVideo</code> on <a href="https://www.tiktok.com/@zachking/video/7655004069190192398">Zach King's “a message to all AI”</a> (the video is his) · <a href="docs/media/how-it-works.mp4">MP4</a></sub>

</div>

Give it a TikTok, Reel or Short and it tells you, scene by scene, what is said and shown, which beat the scene plays (hook, setup, value, proof, payoff, cta), what keeps the viewer watching and how strongly, and what format the video is. One line in Node, or a CLI, an MCP server and an agent skill.

```ts
import { analyzeVideo, summarize } from "shortform-analyzer";

const a = await analyzeVideo("clip.mp4");
if (a.ok) console.log(summarize(a));
// meme, awareness, 5 s, 3 scenes, 3 with text on screen. Made as text only, audio: music only.
//   hook 0.0-1.5 s (curiosity): "Wait"
//   value 1.5-3.0 s (demonstration) (nothing said)
//   cta 3.0-4.5 s (demonstration): "Follow!"
```

## Features

- **Scene by scene**: cuts, the words said in each scene, its middle frame, and a beat, lever and 0-4 hold score per scene.
- **Fast and light**: one transcription and one decision request per video. About 3 to 9 seconds and under 70 MB of memory ([benchmark](#benchmark)).
- **Never throws**: a bad video or a missing key comes back as `{ ok: false, error }`. A refused answer falls back to a stated default.
- **Your own questions**: up to 20 yes/no questions per video, or any question per scene through the [building blocks](#building-blocks).
- **Four ways in**: a library, a CLI, an MCP server for Claude, Cursor and others, and an agent skill.
- **Readable output**: `analysis.json` with a [JSON Schema](schema/analysis.schema.json), a one-page `report.html`, and `sheet.jpg` with every frame on one image.

## Benchmark

Three public TikToks through four tools, all on the same model (`gpt-6-luna`), on an Apple Silicon laptop, October 2026. Median of 2 runs (video-analyzer: 1 run).

| | **shortform-analyzer** | [claude-video-vision](https://github.com/jordanrendric/claude-video-vision) | [claude-real-video](https://github.com/HUANGCHIHHUNGLeo/claude-real-video) | [video-analyzer](https://github.com/byjlw/video-analyzer) |
| --- | --- | --- | --- | --- |
| Time, 17 s video | **6.8 s** | 17.7 s | 28.8 s | 81.9 s |
| Time, 28 s video | **3.7 s** | 12.8 s | 19.6 s | 110.2 s |
| Time, 61 s video | **8.2 s** | 16.6 s | 22.6 s | 346.7 s |
| Peak memory | **65-69 MB** | 98-142 MB | 0.87-1.2 GB | 2.4-4.0 GB |
| Install size | **24 MB** | 89 MB | 879 MB | 1.0 GB + a 1.5 GB model |
| OpenAI requests per video | 2 | 2 | 1 (Whisper runs locally) | 18-62 (one per frame) |
| Images sent | **7-17** | 34-62 | 23-67 | 17-61 |
| Cost per video | $0.0025-0.0078 | $0.0039-0.0102 | **$0.0023-0.0063** | $0.0053-0.0289 |

Why it is faster: one Decisions request labels every scene in 0.7-1.2 s, where the same model writing its answer as chat takes 7-18 s, and one frame per scene sends 2-4 times fewer images. claude-real-video costs a little less because it transcribes on your machine, paying with 9-44 s of CPU and about 1 GB of memory instead. Most of our time and cost is the `whisper-1` call.

<details>
<summary>How it was run</summary>

- Videos: [@pet..supplies' cat brush](https://www.tiktok.com/@pet..supplies/video/7112871757157092650) (17 s, product demo), [Zach King, "a message to all AI"](https://www.tiktok.com/@zachking/video/7655004069190192398) (28 s, many cuts), [GaryVee](https://www.tiktok.com/@garyvee/video/7114641064446676267) (61 s, talking head). They belong to their creators and are not in this repo.
- claude-video-vision (1.4.0) and claude-real-video (`ab4b9b2`) stop at frames and a transcript, so each gets one Chat Completions request asking for the same breakdown. video-analyzer (`2b095fa`) needs PyAV below 19 for its Whisper to run; `gpt-6-luna` rejects its `temperature` and `max_tokens`, which were dropped and renamed.
- Prices: `gpt-6-luna` $0.10 per million input tokens and $0.50 per million output tokens, Decisions output free, `whisper-1` $0.006 a minute. Install size is `node_modules` after `npm install`.
- Speed, cost and resources only. The quality of the labels is not compared.

</details>

To run it yourself, on stand-in videos or your own: [bench/](bench/README.md). The numbers above are in [`bench/results/2026-10.json`](bench/results/2026-10.json).

## Get started

You need:

- [Node.js](https://nodejs.org) 20 or later;
- `ffmpeg` and `ffprobe` on PATH (`brew install ffmpeg`, `apt install ffmpeg`), or pass `ffmpegPath` and `ffprobePath`;
- an OpenAI key in `OPENAI_API_KEY`.

```bash
npm install shortform-analyzer
```

Or run it without installing:

```bash
npx shortform-analyzer analyze clip.mp4
```

> [!NOTE]
> The input is a video file: a path or the video's bytes. A URL is refused; download the video first and pass the file.

## Usage

### Library

```ts
import { writeFile } from "node:fs/promises";
import { analyzeVideo, reportHtml, summarize } from "shortform-analyzer";

const a = await analyzeVideo("clip.mp4", {
  questions: [{ name: "face_on_camera", question: "Is a person's face on camera at any point?" }],
});
if (!a.ok) throw new Error(a.error);

a.scenes[0];          // { index, start, end, thumbnail, transcript, beat, beatProbs, lever, leverProbs, hold, textOnScreen }
a.sections;           // consecutive scenes with the same beat
a.format;             // "review", "tutorial", "meme", …
a.answers;            // { face_on_camera: 0.04 }
console.log(summarize(a));                       // text for an agent
await writeFile("report.html", reportHtml(a));   // one self-contained page
```

| Export | Does |
| --- | --- |
| `analyzeVideo(input, options?)` | The full analysis. `input` is a file path or a `Buffer` |
| `screenVideo(input, questions, options?)` | A quick check from 3 frames (15, 50, 85 percent) and one request: production, voice and your questions |
| `screenCover(image, questions, options?)` | The same from one cover image, before any download |
| `summarize(analysis)` | Format, goal, scene count, production, then one line per section |
| `reportHtml(analysis, title?)` | A self-contained HTML page: the beat strip, then one row per scene |

Options: `openaiApiKey` (default `OPENAI_API_KEY`), `openaiBaseUrl` (default `OPENAI_BASE_URL`, else `https://api.openai.com/v1`; Azure OpenAI works through it), `questions` (up to 20), `ffmpegPath`, `ffprobePath`, `fetch`.

The output's fields are in [docs/reference.md](docs/reference.md#output) and [`schema/analysis.schema.json`](schema/analysis.schema.json) (`schemaVersion: 1`).

### CLI

```bash
npx shortform-analyzer analyze clip.mp4
npx shortform-analyzer analyze clip.mp4 --question face="Is a person's face on camera?" --json
npx shortform-analyzer screen clip.mp4 --question face="Is a person's face on camera?"
```

`analyze` prints the summary (or the JSON with `--json`) and writes `<file>.analysis/`:

- `analysis.json` and `report.html`;
- `frames/01.jpg`…: the 512 px frames the model saw;
- `sheet.jpg`: every frame tiled 4 wide, so an agent can look at one image.

Exit codes: 0 ok, 1 the analysis failed (the reason is on stderr), 2 a usage error.

### MCP server

Claude Code:

```bash
claude mcp add shortform-analyzer -e OPENAI_API_KEY=sk-... -- npx -y shortform-analyzer mcp
```

Claude Desktop, Cursor and other clients:

```json
{
  "mcpServers": {
    "shortform-analyzer": {
      "command": "npx",
      "args": ["-y", "shortform-analyzer", "mcp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

| Tool | Input | Returns |
| --- | --- | --- |
| `analyze_video` | `input` (a file path), `questions` (optional) | The summary, the output folder, and the analysis without thumbnails |
| `screen_video` | `input`, `questions` | production, voice, answers |

### Agent skill

[`skills/shortform-analyzer/SKILL.md`](skills/shortform-analyzer/SKILL.md) teaches an agent when to run it and how to read the result. It ships in the npm package too.

```bash
npx skills add trevkang/shortform-analyzer
```

## How it works

One video goes through four steps (the animation above shows steps 1 and 4):

| Step | What happens | Function |
| --- | --- | --- |
| 1. **Scenes** | ffmpeg finds the cuts. Flashes under 0.4 s join the scene before; a take over 5 s is split so a one-take video still has a beginning, middle and end | `detectScenes` |
| 2. **Transcript** | `whisper-1` writes every word with its time; each word goes to the scene its midpoint falls in | `transcribe`, `alignWords` |
| 3. **Frames** | The middle frame of every scene, 512 px for the model | `extractFrames` |
| 4. **Decisions** | One OpenAI Decisions request reads every scene's frame next to its words, in order, and answers questions about each scene and the whole video | `decide` |

```
                       ┌─ extractFrames ─────────────────────┐
video ─ probe ─ detectScenes                                 ├─ sceneEvidence ─ decide ─ parseShortform ─ Analysis
                       └─ extractAudio ─ transcribe ─ alignWords ┘                 ▲
                                                                     shortformQuestions (or yours)
```

The words are given to the scenes **before** the decision, because the model reads them side by side. And the decision is one request for the whole video, not one per scene, because a scene's role depends on its neighbours: the same shot is a hook at 0 s and a payoff at 20 s.

The short-form labels are just one set of questions. Steps 1 to 4 know nothing about short-form video, so you can use them on their own or ask your own questions per scene. The layers are explained in [docs/concepts.md](docs/concepts.md).

## Building blocks

Every step is public from `shortform-analyzer/primitives`.

> [!WARNING]
> This subpath is experimental: a minor version may change a signature. Every change is in [CHANGELOG.md](CHANGELOG.md).

Scenes and the words said in each, with no model call:

```ts
import { probe, detectScenes, extractAudio, transcribe, alignWords } from "shortform-analyzer/primitives";

const { duration } = await probe("talk.mp4");
const spans = await detectScenes("talk.mp4", { duration, maxTake: 30 });
const { words } = await transcribe(await extractAudio("talk.mp4"));
const texts = alignWords(words, spans);
```

The short-form preset plus a question of your own, asked of every scene:

```ts
import { decide, extractFrames, parseShortform, sceneEvidence, shortformQuestions, type DecisionQuestion } from "shortform-analyzer/primitives";

const frames = await extractFrames("clip.mp4", spans);
const questions: DecisionQuestion[] = [
  ...shortformQuestions(),
  { type: "predicate", name: "product", scope: "scene", instructions: "Is the product visible in scene {scene}?" },
];
const d = await decide(sceneEvidence(spans, frames, texts, { duration }), questions);
const labels = parseShortform(d);                                    // beats, levers, hold… with fallbacks
const product = d.scenes.map((s) => s.product?.probability ?? 0.5); // your answer, per scene
```

`decide` takes `predicate` (a probability), `choice` (one of your options, with probabilities) and `score` (0 to the number of levels − 1) questions, for the whole video or per scene, up to 400 per request. It returns only what the model answered: a refused answer is absent, and you choose the fallback. The building blocks throw an `Error` that names the step (`video:`, `transcribe:`, `decide:`); the functions above them never throw.

## The labels

| Beat | The scene |
|---|---|
| `hook` | Stops the scroll in the first seconds: a bold claim, question, surprise or problem |
| `setup` | Gives context: who, what problem, why it matters |
| `value` | The body: the demo, the steps, the story unfolding, the reveal |
| `proof` | Shows it works: results, before/after, reviews, numbers |
| `payoff` | Delivers what the hook promised: the punchline, the result, the twist |
| `cta` | Asks the viewer to act: follow, comment, buy, link in bio |

- **Levers:** `curiosity`, `pattern_interrupt`, `relatable`, `demonstration`, `social_proof`, `emotion`, `direct_ask`, `none`.
- **Hold:** 0 (most viewers scroll away) to 4 (nearly impossible to scroll away).
- **Formats:** `meme`, `skit`, `product_demo`, `tutorial`, `review`, `storytime`, `before_after`, `unboxing`, `behind_the_scenes`, `talking_head`, `other`. `goal` is `conversion` when `sells` ≥ 0.5, else `awareness`.
- **Production:** `on_camera_person`, `screen_recording`, `hands_only`, `broll_voiceover`, `text_only`, `animation`, `mixed`.
- **Voice:** `on_camera_speech`, `voiceover`, `none`, `music_only`.

When the model refuses or skips an answer: beat `value`, lever `none`, hold 2, format `other`, production `mixed`, voice `none`, a question 0.5. A video without speech is still analysed from its frames, with an empty transcript and `transcriptError`. Definitions and thresholds are in [docs/video-analysis.md](docs/video-analysis.md).

## Keys and costs

Each video takes one `whisper-1` transcription and one Decisions request (`gpt-6-luna`) on your `OPENAI_API_KEY`: from $0.0025 for a 17 s video to $0.0078 for a 61 s one ([benchmark](#benchmark)). There is no telemetry, and your key goes only to OpenAI.

> [!IMPORTANT]
> Analyse your own videos, or videos you have the right to analyse.

## Development

```bash
pnpm install
pnpm test           # builds, then runs every test (videos are made with ffmpeg lavfi; no network)
pnpm typecheck
pnpm test:consumer  # installs the packed tarball into a blank project and imports it
```

Start with [docs/concepts.md](docs/concepts.md); a change starts as a doc edit, then a test, then the code.

## Credits

Built by [Trevor](https://github.com/trevkang) and [Viktor](https://github.com/Reblexis). It started as the video analysis module of viral-oracle, their team project at the Omnara hackathon (October 2026).

The how-it-works animation is rendered with `render.mjs` from [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) (MIT); the video in it belongs to [Zach King](https://www.tiktok.com/@zachking); Geist fonts are under the SIL Open Font License ([docs/media](docs/media/README.md)).
