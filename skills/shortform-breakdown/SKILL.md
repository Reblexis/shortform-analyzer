---
name: shortform-breakdown
description: Break down a short-form video (TikTok, Reels, Shorts) scene by scene - what is said and shown, which beat each scene plays (hook, setup, value, proof, payoff, cta), what keeps viewers watching and how strongly, and the video's format. Use when someone wants to know why a short video works, or how to borrow its structure for their own.
---

# Short-form breakdown

## When to use it

Someone hands you a short video (a file, or a TikTok post URL) and asks why it works, what its
hook is, how it is structured, or how to make one like it. Also for checking a video against
yes/no questions ("is a face on camera?", "is it a screen recording?").

## Run it

```bash
npx shortform-breakdown analyze <file-or-tiktok-url>
npx shortform-breakdown analyze clip.mp4 --question face="Is a person's face on camera at any point?"
npx shortform-breakdown screen clip.mp4 --question face="Is a person's face on camera?"   # 3 frames, one request
```

Needs `ffmpeg` and `ffprobe` on PATH and `OPENAI_API_KEY`. A TikTok URL
(`https://www.tiktok.com/@<user>/video/<id>`) also needs `APINOA_API_KEY` (https://apinoa.com);
for any other site, download the video first and pass the file. It takes about 15 seconds.

## Read the result

`analyze` prints a summary and writes `<file>.breakdown/`:

- the first line: format, goal (conversion or awareness), length, scene count, how it is made;
- then one line per section: its beat, time, lever and what is said, e.g.
  `hook 0.0-2.1 s (curiosity): "I tried the cheapest one first."`;
- `sheet.jpg`: every scene's frame on one image, 4 wide. **Open it** to see what is shown,
  not only what is said;
- `analysis.json`: the full result, with probabilities per label and a 0-4 `hold` score per scene;
- `report.html`: a page for a person to read.

When you explain a video, lead with the hook (scene 1, what it says and shows), then the
structure (the sections in order), then what to borrow. Quote the transcript; don't invent what
the video says.

## What the labels mean

Beats, levers, hold, formats, production and voice are defined in
[docs/video-analysis.md](https://github.com/trevkang/shortform-breakdown/blob/main/docs/video-analysis.md).
Labels are the model's best guess with probabilities; say so when one is below 0.5.

## Keys and costs

- OpenAI: one `whisper-1` transcription (billed per minute of audio) and one Decisions request
  per video.
- apinoa: a TikTok URL costs 2 units ($0.002) per video.
- Analyse only videos you have the right to use.
