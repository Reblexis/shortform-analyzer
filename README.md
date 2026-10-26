# shortform-breakdown

Break a short-form video into scenes: what is said and shown in each one, which beat it plays (hook, setup, value, proof, payoff, cta), what keeps the viewer watching and how strongly, and the video's format. One line in Node, a CLI, an MCP server and an agent skill.

```ts
import { analyzeVideo, summarize } from "shortform-breakdown";

const a = await analyzeVideo("clip.mp4");
if (a.ok) console.log(summarize(a));
// e.g. for three coloured shots with "Wait … Follow!" over them:
// meme, awareness, 5 s, 3 scenes, 3 with text on screen. Made as text only, audio: music only.
//   hook 0.0-1.5 s (curiosity): "Wait"
//   value 1.5-3.0 s (demonstration) (nothing said)
//   cta 3.0-4.5 s (demonstration): "Follow!"
```

## How it works

<p align="center"><img src="https://raw.githubusercontent.com/trevkang/shortform-breakdown/main/docs/media/how-it-works.gif" width="100%" alt="A real TikTok (Zach King, a message to all AI, 27.9 s) plays while detectScenes cuts its timeline into 17 scenes. Then one Decisions request labels every scene at once: a beat (hook, setup, value, payoff, cta), a hold score, and the sections. The video is a skit, awareness, made as on camera person. Last, the playhead runs over the timeline again and shows each scene with its labels and words."></p>

<p align="center"><a href="docs/media/how-it-works.mp4">MP4</a> · Every time, word and label on screen is a real run of <code>analyzeVideo</code> on <a href="https://www.tiktok.com/@zachking/video/7655004069190192398">Zach King's “a message to all AI”</a> (the video is his).</p>

One video goes through four steps (the animation shows steps 1 and 4: the cut and the decision):

| Step | What happens | Function |
| --- | --- | --- |
| 1. **Scenes** | ffmpeg finds the cuts. Flashes under 0.4 s join the scene before; a take over 5 s is split so a one-take video still has a beginning, middle and end | `detectScenes` |
| 2. **Transcript** | `whisper-1` writes every word with its time; each word goes to the scene its midpoint falls in | `transcribe`, `alignWords` |
| 3. **Frames** | The middle frame of every scene, 512 px for the model | `extractFrames` |
| 4. **Decisions** | One OpenAI Decisions request reads every scene's frame next to its words, in order, and answers questions about each scene and the whole video | `decide` |

The order matters in one place: the words are given to the scenes **before** the decision, because the model reads them side by side. And the decision is one request for the whole video, not one per scene, because a scene's role depends on its neighbours: the same shot is a hook at 0 s and a payoff at 20 s.

The short-form labels (beat, lever, hold, format…) are just one set of questions. Steps 1 to 4 know nothing about short-form video, so you can use them on their own, or ask your own questions per scene ([building blocks](#building-blocks)).

```
                       ┌─ extractFrames ─────────────────────┐
video ─ probe ─ detectScenes                                 ├─ sceneEvidence ─ decide ─ parseShortform ─ Analysis
                       └─ extractAudio ─ transcribe ─ alignWords ┘                 ▲
                                                                     shortformQuestions (or yours)
```

## Install

```bash
npm install shortform-breakdown
```

Node 20 or later. `ffmpeg` and `ffprobe` on PATH (`brew install ffmpeg`, `apt install ffmpeg`), or pass `ffmpegPath` and `ffprobePath`. An OpenAI key in `OPENAI_API_KEY`.

## Library

```ts
import { writeFile } from "node:fs/promises";
import { analyzeVideo, reportHtml, summarize } from "shortform-breakdown";

const a = await analyzeVideo("clip.mp4", {
  questions: [{ name: "face_on_camera", question: "Is a person's face on camera at any point?" }],
});
if (!a.ok) throw new Error(a.error);   // nothing throws: a bad video or a missing key is { ok: false, error }

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

The output's fields are in [docs/reference.md](docs/reference.md#output) and in [`schema/analysis.schema.json`](schema/analysis.schema.json) (`schemaVersion: 1`).

## CLI

```bash
npx shortform-breakdown analyze clip.mp4
npx shortform-breakdown analyze clip.mp4 --question face="Is a person's face on camera?" --json
npx shortform-breakdown screen clip.mp4 --question face="Is a person's face on camera?"
```

`analyze` prints the summary (or the JSON with `--json`) and writes `<file>.breakdown/`:

- `analysis.json`, `report.html`;
- `frames/01.jpg`…: the 512 px frames the model saw;
- `sheet.jpg`: every frame tiled 4 wide, so an agent can look at one image.

Exit codes: 0 ok, 1 the analysis failed (the reason is on stderr), 2 a usage error.

## MCP server

Claude Code:

```bash
claude mcp add shortform-breakdown -e OPENAI_API_KEY=sk-... -- npx -y shortform-breakdown mcp
```

Claude Desktop, Cursor and other clients:

```json
{
  "mcpServers": {
    "shortform-breakdown": {
      "command": "npx",
      "args": ["-y", "shortform-breakdown", "mcp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

| Tool | Input | Returns |
| --- | --- | --- |
| `analyze_video` | `input` (a file path), `questions` (optional) | The summary, the output folder, and the analysis without thumbnails |
| `screen_video` | `input`, `questions` | production, voice, answers |

## Agent skill

[`skills/shortform-breakdown/SKILL.md`](skills/shortform-breakdown/SKILL.md) teaches an agent when to run it and how to read the result. It ships in the npm package too.

```bash
npx skills add trevkang/shortform-breakdown
```

## Building blocks

Every step is public from `shortform-breakdown/primitives`. This subpath is **experimental**: a minor version may change a signature, and every change is in [CHANGELOG.md](CHANGELOG.md). The layers are explained in [docs/concepts.md](docs/concepts.md).

Scenes and the words said in each, with no model call:

```ts
import { probe, detectScenes, extractAudio, transcribe, alignWords } from "shortform-breakdown/primitives";

const { duration } = await probe("talk.mp4");
const spans = await detectScenes("talk.mp4", { duration, maxTake: 30 });
const { words } = await transcribe(await extractAudio("talk.mp4"));
const texts = alignWords(words, spans);
```

The short-form preset plus a question of your own, asked of every scene:

```ts
import { decide, extractFrames, parseShortform, sceneEvidence, shortformQuestions, type DecisionQuestion } from "shortform-breakdown/primitives";

const frames = await extractFrames("clip.mp4", spans);
const questions: DecisionQuestion[] = [
  ...shortformQuestions(),
  { type: "predicate", name: "product", scope: "scene", instructions: "Is the product visible in scene {scene}?" },
];
const d = await decide(sceneEvidence(spans, frames, texts, { duration }), questions);
const labels = parseShortform(d);                                    // beats, levers, hold… with fallbacks
const product = d.scenes.map((s) => s.product?.probability ?? 0.5); // your answer, per scene
```

`decide` takes `predicate` (a probability), `choice` (one of your options, with probabilities) and `score` (0 to the number of levels − 1) questions, for the whole video or per scene, up to 400 per request. It returns only what the model answered; a refused answer is absent, and you choose the fallback. The building blocks throw an `Error` that names the step (`video:`, `transcribe:`, `decide:`); the functions above them never throw.

## The labels

**Beats**

| Beat | The scene |
|---|---|
| `hook` | Stops the scroll in the first seconds: a bold claim, question, surprise or problem |
| `setup` | Gives context: who, what problem, why it matters |
| `value` | The body: the demo, the steps, the story unfolding, the reveal |
| `proof` | Shows it works: results, before/after, reviews, numbers |
| `payoff` | Delivers what the hook promised: the punchline, the result, the twist |
| `cta` | Asks the viewer to act: follow, comment, buy, link in bio |

**Levers:** `curiosity`, `pattern_interrupt`, `relatable`, `demonstration`, `social_proof`, `emotion`, `direct_ask`, `none`. **Hold:** 0 (most viewers scroll away) to 4 (nearly impossible to scroll away). **Formats:** `meme`, `skit`, `product_demo`, `tutorial`, `review`, `storytime`, `before_after`, `unboxing`, `behind_the_scenes`, `talking_head`, `other`; `goal` is `conversion` when `sells` ≥ 0.5, else `awareness`. **Production:** `on_camera_person`, `screen_recording`, `hands_only`, `broll_voiceover`, `text_only`, `animation`, `mixed`. **Voice:** `on_camera_speech`, `voiceover`, `none`, `music_only`. Definitions and thresholds: [docs/video-analysis.md](docs/video-analysis.md).

When the model refuses or skips an answer: beat `value`, lever `none`, hold 2, format `other`, production `mixed`, voice `none`, a question 0.5. A video without speech is still analysed from its frames, with an empty transcript and `transcriptError`.

## Keys and costs

- **OpenAI** (`OPENAI_API_KEY`): one `whisper-1` transcription and one Decisions request (`gpt-6-luna`) per video. About 15 seconds per video.

No telemetry. Your key goes only to OpenAI.

## Input is a video file

Pass a file path or the video's bytes. A URL is refused: download the video first and pass the file.

## Use videos you have the right to use

Analyse your own videos, or videos you have the right to analyse.

## Development

```bash
pnpm install
pnpm test           # builds, then runs every test (videos are made with ffmpeg lavfi; no network)
pnpm typecheck
pnpm test:consumer  # installs the packed tarball into a blank project and imports it
```

## Credits

Built by [Trevor](https://github.com/trevkang) and [Viktor](https://github.com/Reblexis). It started as the video analysis module of viral-oracle, their team project at the Omnara hackathon (October 2026).

## Licence

MIT. The how-it-works animation is rendered with `render.mjs` from [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) (MIT); the video in it belongs to [Zach King](https://www.tiktok.com/@zachking); Geist fonts under the SIL Open Font License ([docs/media](docs/media/README.md)).
