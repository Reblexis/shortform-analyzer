# Video analysis

One short-form video in, a scene-by-scene breakdown out: what is said and shown in each scene,
which beat of the structure it plays, what it does to keep the viewer watching, and what kind of
video it is. Scenes are PySceneDetect-style shots, labelled by OpenAI Decisions.

This page keeps the labels and the thresholds. The layers and how to compose them are in
[concepts.md](concepts.md).

## Steps

1. **Scenes** (`detectScenes`). ffmpeg's scene-change score on RGB frames (`select='gt(scene,0.3)'`; on luma alone a red → green cut is missed) gives the cuts. A
   scene shorter than 0.4 s is a transition and joins the scene before it. A take longer than
   5 s is split into equal parts of at most 5 s (`cut: false`), so a one-take video still gets a
   hook, a body and a CTA. Past 40 scenes the shortest neighbours merge. Each number is an option.
2. **One frame per scene** (`extractFrames`), from its middle, a JPEG at most 512 px on the long
   side. It is what the model sees; a 160 px copy is the scene's thumbnail.
3. **Transcript** (`transcribe`, then `alignWords`). The audio goes to OpenAI transcription
   (`whisper-1`, word timestamps). Each word goes to the scene its midpoint falls in. A segment
   that is likely not speech and unsure (`no_speech_prob` > 0.4 and `avg_logprob` < -0.6) is
   dropped: on music-only reels whisper writes "Thanks for watching!" (0.5, -0.86); real speech
   measured -0.19 to -0.22 even at 0.54. A segment that is only "Thanks for watching" is dropped
   too (on other runs it came with no telling numbers). No audio track, or a failed
   transcription, means empty transcripts; the analysis still runs on the frames.
4. **Decisions** (`decide`; OpenAI `/v1/decisions`, `gpt-6-luna`), one request. The shared input
   is the whole video in order (each scene's time, frame and words). The short-form preset asks:
   - per scene, `beat` (choice): which part of the short-form structure it plays;
   - per scene, `lever` (choice): what it does to keep the viewer watching or get them to act;
   - per scene, `hold` (score, 0 to 4): how strongly it makes the viewer keep watching;
   - per scene, `text` (predicate): does it show text on screen;
   - `format` (choice): what type of short-form video it is;
   - `sells` (predicate): does it try to get the viewer to buy, sign up or click;
   - `production` and `voice` (choices): how it is made and what carries the audio;
   - one predicate `q_<name>` per question the caller asked (up to 20), such as "Is a person's
     face on camera at any point?". `screenVideo` asks only `production`, `voice` and these, from
     3 frames.

## The structure (beats)

Short-form guides agree on Hook → Body → Payoff → CTA, product videos add proof
(Hook, Payoff, Proof, CTA; ad breakdowns: Hook 0-3 s, Context, Reveal/Demo, Social proof,
CTA). The beats:

| Beat | The scene |
|---|---|
| `hook` | Stops the scroll in the first seconds: a bold claim, question, surprise or problem |
| `setup` | Gives context: who, what problem, why it matters |
| `value` | The body: the demo, the steps, the story unfolding, the reveal |
| `proof` | Shows it works: results, before/after, reviews, numbers |
| `payoff` | Delivers what the hook promised: the punchline, the result, the twist |
| `cta` | Asks the viewer to act: follow, comment, buy, link in bio |

Consecutive scenes with the same beat form one section (e.g. Hook 0.0-2.1 s).

## Levers

| Lever | The scene |
|---|---|
| `curiosity` | Opens a question or gap the viewer wants closed |
| `pattern_interrupt` | A visual or audio surprise that breaks the scroll rhythm |
| `relatable` | A pain or moment the viewer knows from their own life |
| `demonstration` | Shows the thing working, so the viewer watches for the result |
| `social_proof` | Others' results, reviews, numbers or popularity |
| `emotion` | Humor, awe, cuteness or outrage |
| `direct_ask` | Asks the viewer to follow, comment, share or buy |
| `none` | Nothing in particular; filler or a transition |

`hold` levels: 0 scroll (most viewers would scroll away), 1 weak, 2 average, 3 strong, 4 gripping.

## Formats

`meme` (humor or trend, not for conversion), `skit`, `product_demo`, `tutorial`,
`review` (testimonial or UGC recommendation), `storytime`, `before_after`, `unboxing`,
`behind_the_scenes`, `talking_head` (opinion or advice), `other`. `goal` is `conversion`
when `sells` ≥ 0.5, else `awareness`.

## Production and voice

Production: `on_camera_person`, `screen_recording`, `hands_only`, `broll_voiceover`,
`text_only`, `animation`, `mixed`. Voice: `on_camera_speech`, `voiceover`, `none`, `music_only`.

## When an answer is missing

A refused or missing answer falls back to: beat `value`, lever `none`, hold 2, format `other`,
sells 0, production `mixed`, voice `none`, a question 0.5. `textOnScreen` is left out.

## Output

`analyzeVideo(input)` returns the `Analysis` described in [reference.md](reference.md#output)
and in `schema/analysis.schema.json`. `npx shortform-breakdown analyze <video>` writes
`analysis.json`, `report.html` (thumbnails, transcript and beats per scene), `frames/` and
`sheet.jpg` into `<video>.breakdown/`. It needs `ffmpeg` and `ffprobe` on PATH and
`OPENAI_API_KEY`.
