// build.mjs data.json out.html : fill the template with the data and the fonts.
import { readFileSync, writeFileSync } from "node:fs";
const [data, out] = process.argv.slice(2), F = process.env.FONTS;
writeFileSync(out, readFileSync(new URL("./page.src.html", import.meta.url), "utf8")
  .replace("__GEIST__", readFileSync(`${F}/geist.b64`, "utf8").trim())
  .replace("__GEISTMONO__", readFileSync(`${F}/geistmono.b64`, "utf8").trim())
  .replace("__DATA__", () => readFileSync(data, "utf8")));
