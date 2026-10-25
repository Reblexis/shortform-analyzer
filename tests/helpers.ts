// Test videos made with ffmpeg lavfi, and a fake OpenAI at fetch. No test touches the network.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const hasFfmpeg = (() => { try { execFileSync("ffmpeg", ["-version"]); execFileSync("ffprobe", ["-version"]); return true; } catch { return false; } })();

export const tmp = (prefix = "sb-test-") => mkdtempSync(join(tmpdir(), prefix));

/** Example 1 and 2: three 1.5 s solid-colour shots (red, green, blue), 360x640, with or without a 440 Hz tone. */
export function makeCuts(audio: boolean): string {
  const out = join(tmp(), audio ? "cuts.mp4" : "silent.mp4");
  const shots = ["red", "green", "blue"].flatMap((c) => ["-f", "lavfi", "-i", `color=c=${c}:s=360x640:r=30:d=1.5`]);
  const tone = audio ? ["-f", "lavfi", "-i", "sine=frequency=440:duration=4.5"] : [];
  execFileSync("ffmpeg", ["-v", "error", "-y", ...shots, ...tone,
    "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]", "-map", "[v]", ...(audio ? ["-map", "3:a", "-shortest"] : []),
    "-pix_fmt", "yuv420p", out]);
  return out;
}

/** Example 3: one 11 s take, no audio. */
export function makeLongTake(): string {
  const out = join(tmp(), "take.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=orange:s=360x640:r=30:d=11", "-pix_fmt", "yuv420p", out]);
  return out;
}

export type Call = { url: string; body: unknown; auth?: string };

/**
 * A fake OpenAI: whisper returns two words; Decisions answers each scene's beat by `beats` (then `value`), hold 3, format meme,
 * sells 0.1, every caller question 0.9. `decisionsReply` overrides the whole Decisions reply.
 */
export function fakeOpenAI(opts: { beats?: string[]; decisionsReply?: (body: any) => unknown; transcriptionStatus?: number } = {}) {
  const beats = opts.beats ?? ["hook", "value", "cta"];
  const calls: Call[] = [];
  const fetchFn = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    if (url.endsWith("/audio/transcriptions")) {
      calls.push({ url, body: init.body, auth });
      if (opts.transcriptionStatus) return Response.json({ error: { message: "bad audio" } }, { status: opts.transcriptionStatus });
      return Response.json({ text: "Wait for it. Follow!", language: "english", words: [
        { word: "Wait", start: 0.2, end: 0.6 }, { word: "Follow!", start: 3.5, end: 4.0 },
      ] });
    }
    if (url.endsWith("/decisions")) {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body, auth });
      if (opts.decisionsReply) return Response.json(opts.decisionsReply(body));
      const names: string[] = body.questions.map((q: { name: string }) => q.name);
      const answers = names.flatMap((name): unknown[] => {
        const m = name.match(/^(beat|lever|hold|text)_(\d+)$/);
        if (m) {
          const i = Number(m[2]);
          if (m[1] === "beat") { const b = beats[i] ?? "value"; return [{ type: "choice", name, choice: b, probabilities: [{ value: b, probability: 0.8 }, { value: "setup", probability: 0.2 }] }]; }
          if (m[1] === "lever") return [{ type: "choice", name, choice: i === 0 ? "curiosity" : "demonstration", probabilities: [{ value: "curiosity", probability: 0.6 }] }];
          if (m[1] === "hold") return [{ type: "score", name, score: 3 }];
          return [{ type: "predicate", name, probability: 0.7 }];
        }
        if (name === "format") return [{ type: "choice", name, choice: "meme", probabilities: [{ value: "meme", probability: 0.6 }, { value: "other", probability: 0.4 }] }];
        if (name === "sells") return [{ type: "predicate", name, probability: 0.1 }];
        if (name === "production") return [{ type: "choice", name, choice: "text_only", probabilities: [{ value: "text_only", probability: 0.9 }] }];
        if (name === "voice") return [{ type: "choice", name, choice: "music_only", probabilities: [{ value: "music_only", probability: 0.7 }] }];
        if (name.startsWith("q_")) return [{ type: "predicate", name, probability: 0.9 }];
        return [];
      });
      return Response.json({ answers, usage: { input_tokens: 900 } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { fetchFn, calls, path: (c: Call) => c.url.split("/v1/")[1] };
}

/** Runs `fn` with env vars set (undefined deletes), then restores them. */
export async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const old = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(old)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
