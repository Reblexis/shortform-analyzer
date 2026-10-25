// Example 1's video: three 1.5 s shots (red, green, blue) with a tone.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function makeCuts() {
  const out = join(mkdtempSync(join(tmpdir(), "consumer-")), "cuts.mp4");
  const shots = ["red", "green", "blue"].flatMap((c) => ["-f", "lavfi", "-i", `color=c=${c}:s=360x640:r=30:d=1.5`]);
  execFileSync("ffmpeg", ["-v", "error", "-y", ...shots, "-f", "lavfi", "-i", "sine=frequency=440:duration=4.5",
    "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-map", "3:a", "-shortest", "-pix_fmt", "yuv420p", out]);
  return out;
}
