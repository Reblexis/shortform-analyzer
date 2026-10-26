import assert from "node:assert/strict";
import { detectScenes } from "shortform-analyzer/primitives";
import { makeCuts } from "./lavfi.mjs";

const spans = await detectScenes(makeCuts());
assert.deepEqual(spans.map((s) => Math.round(s.start * 10) / 10), [0, 1.5, 3]);
console.log("primitives.mjs: ok");
