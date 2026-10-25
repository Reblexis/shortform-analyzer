import assert from "node:assert/strict";
import { analyzeVideo, summarize } from "shortform-breakdown";
import { makeCuts } from "./lavfi.mjs";

const fakeFetch = async (url) => {
  if (String(url).endsWith("/audio/transcriptions")) return Response.json({ text: "Hi", words: [{ word: "Hi", start: 0.1, end: 0.3 }] });
  return Response.json({ answers: [{ type: "choice", name: "beat_0", choice: "hook" }] });
};
const a = await analyzeVideo(makeCuts(), { openaiApiKey: "k", fetch: fakeFetch });
assert.equal(a.ok, true, a.error);
assert.equal(a.scenes.length, 3);
assert.equal(a.scenes[0].beat, "hook");
assert.match(summarize(a), /3 scenes/);
console.log("analyze.mjs: ok");
