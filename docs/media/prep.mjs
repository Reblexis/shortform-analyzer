// prep.mjs video.mp4 [analysis.json] out.json : the real data the explainer draws.
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
const P = await import(path.resolve(process.env.PKG, "dist/primitives.js"));
const [video, a2, a3] = process.argv.slice(2);
const analysisPath = a3 ? a2 : null, out = a3 ?? a2;
const { duration } = await P.probe(video);
let scenes;
if (analysisPath) {
  const a = JSON.parse(readFileSync(analysisPath, "utf8"));
  scenes = a.scenes.map((s) => ({ start: s.start, end: s.end, cut: s.cut, transcript: s.transcript, beat: s.beat, beatP: s.beatProbs[s.beat], lever: s.lever, hold: s.hold, text: s.textOnScreen }));
  var video_ = { format: a.format, formatP: a.formatProbs[a.format], goal: a.goal, sells: a.sells, production: a.production, voice: a.voice, sections: a.sections.map((x) => ({ beat: x.beat, start: x.start, end: x.end })) };
} else {
  scenes = (await P.detectScenes(video, { duration })).map((s) => ({ ...s, transcript: "", beat: null }));
}
const thumbs = (await P.extractFrames(video, scenes, { side: 200 })).map((b) => b.toString("base64"));
const dir = mkdtempSync(path.join(tmpdir(), "play-"));
execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", "fps=8,scale=288:-2", "-q:v", "5", `${dir}/%04d.jpg`]);
const play = readdirSync(dir).sort().map((f) => readFileSync(`${dir}/${f}`).toString("base64"));
rmSync(dir, { recursive: true });
writeFileSync(out, JSON.stringify({ duration, scenes, thumbs, play, playFps: 8, video: video_ ?? null }));
console.log(out, scenes.length, "scenes", play.length, "play frames", (JSON.stringify(play).length / 1e6).toFixed(1) + "MB");
