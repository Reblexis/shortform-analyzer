import { LEVER_TEXT, type Analysis } from "../primitives.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const sec = (t: number) => `${t.toFixed(1)}s`;
const pct = (p: number | undefined) => `${Math.round((p ?? 0) * 100)}%`;

/** A self-contained HTML page: the structure strip, then one row per scene. */
export function reportHtml(a: Analysis, title = "Video analysis"): string {
  const strip = a.sections.map((s) =>
    `<div class="seg b-${s.beat}" style="flex:${Math.max(s.end - s.start, 0.3)}" title="${sec(s.start)}-${sec(s.end)}">${s.beat}<small>${sec(s.start)}-${sec(s.end)}</small></div>`).join("");
  const rows = a.scenes.map((s) => `
  <article>
    <img src="${s.thumbnail}" alt="Scene ${s.index + 1}">
    <div>
      <h3>Scene ${s.index + 1} <span>${sec(s.start)}-${sec(s.end)}${s.cut === false ? " · same take" : ""}</span></h3>
      <p class="tags"><b class="b-${s.beat}">${s.beat} ${pct(s.beatProbs[s.beat])}</b>
        <i>${s.lever.replace("_", " ")}</i> hold ${s.hold.toFixed(1)}/4</p>
      <p class="why">${esc(LEVER_TEXT[s.lever])}</p>
      <blockquote>${s.transcript ? esc(s.transcript) : "<em>nothing said</em>"}</blockquote>
    </div>
  </article>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{--bg:#fafaf9;--fg:#1c1917;--mute:#78716c;--card:#fff;--line:#e7e5e4}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--mute:#a8a29e;--card:#292524;--line:#44403c}}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:860px;margin:auto}h1{margin:0 0 4px}.meta{color:var(--mute);margin:0 0 16px}
.strip{display:flex;gap:2px;border-radius:8px;overflow:hidden;margin-bottom:24px}
.seg{padding:8px 6px;color:#fff;font-weight:600;font-size:13px;min-width:0;overflow:hidden;white-space:nowrap}
.seg small{display:block;font-weight:400;opacity:.85}
article{display:grid;grid-template-columns:120px 1fr;gap:16px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:10px}
article img{width:120px;border-radius:6px}h3{margin:0}h3 span{color:var(--mute);font-weight:400;font-size:13px}
.tags b{color:#fff;padding:1px 8px;border-radius:99px;font-size:12px}.tags i{color:var(--mute)}
.why{color:var(--mute);margin:4px 0}blockquote{margin:6px 0 0;padding-left:10px;border-left:3px solid var(--line)}
.b-hook{background:#dc2626}.b-setup{background:#d97706}.b-value{background:#2563eb}.b-proof{background:#059669}.b-payoff{background:#7c3aed}.b-cta{background:#db2777}
</style></head><body><main>
<h1>${esc(title)}</h1>
<p class="meta">${a.format.replace(/_/g, " ")} (${pct(a.formatProbs[a.format])}) · ${a.goal} (sells ${pct(a.sells)}) · ${sec(a.duration)} · ${a.scenes.length} scenes${a.transcriptError ? ` · no transcript: ${esc(a.transcriptError)}` : ""}</p>
<div class="strip">${strip}</div>${rows}
</main></body></html>`;
}
