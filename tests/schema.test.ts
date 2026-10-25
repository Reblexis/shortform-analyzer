// Success criterion 3: the analyses from Examples 1 to 3 validate against schema/analysis.schema.json.
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { analyzeVideo } from "../src/index.js";
import { fakeOpenAI, hasFfmpeg, makeCuts, makeLongTake } from "./helpers.js";

const validate = new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync("schema/analysis.schema.json", "utf8")));

describe.skipIf(!hasFfmpeg)("schema", () => {
  const cases: [string, () => string, object][] = [
    ["Example 1, three cuts with sound", () => makeCuts(true), { questions: [{ name: "face_on_camera", question: "Is a face on camera?" }] }],
    ["Example 2, no audio", () => makeCuts(false), {}],
    ["Example 3, one long take", makeLongTake, {}],
  ];
  for (const [name, make, extra] of cases) {
    it(`${name} validates`, async () => {
      const a = await analyzeVideo(make(), { openaiApiKey: "k", fetch: fakeOpenAI().fetchFn, ...extra });
      if (!a.ok) throw new Error(a.error);
      // Through JSON, as a consumer reads analysis.json.
      const ok = validate(JSON.parse(JSON.stringify(a)));
      expect(validate.errors ?? []).toEqual([]);
      expect(ok).toBe(true);
    });
  }

  it("rejects an analysis that breaks the contract", () => {
    expect(validate({ schemaVersion: 2, ok: true })).toBe(false);
  });
});
