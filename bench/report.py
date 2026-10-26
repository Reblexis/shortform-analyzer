# bench/.work/results/r*/ → the median of every (tool, video) over its runs: time, CPU, peak memory,
# requests, images, tokens and cost. Usage: python3 bench/report.py [results dir] [--json out.json]
import glob, json, os, statistics, sys

# USD. OpenAI list prices, October 2026.
PRICE = {"chat_in": 0.10e-6, "chat_out": 0.50e-6, "decisions_in": 0.10e-6, "whisper_minute": 0.006}

def cost(calls):
    c = {"whisper_usd": 0.0, "model_usd": 0.0, "in_tok": 0, "out_tok": 0}
    for x in calls:
        u = x.get("usage") or {}
        if x["path"].endswith("/audio/transcriptions"):
            c["whisper_usd"] += (x.get("audio_sec") or 0) / 60 * PRICE["whisper_minute"]
        elif x["path"].endswith("/decisions"):
            c["in_tok"] += u.get("input_tokens", 0); c["model_usd"] += u.get("input_tokens", 0) * PRICE["decisions_in"]
        elif x["path"].endswith("/chat/completions"):
            i, o = u.get("prompt_tokens", 0), u.get("completion_tokens", 0)
            c["in_tok"] += i; c["out_tok"] += o; c["model_usd"] += i * PRICE["chat_in"] + o * PRICE["chat_out"]
    c["usd"] = c["whisper_usd"] + c["model_usd"]
    return c

def summarize(results):
    runs = {}
    for f in glob.glob(os.path.join(results, "r*", "*.json")):
        r = json.load(open(f))
        r.update(cost([json.loads(l) for l in open(f[:-5] + ".calls.jsonl")]))
        runs.setdefault((r["tool"], r["video"]), []).append(r)
    rows = []
    for (tool, video), rs in sorted(runs.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        ok = [r for r in rs if r["exit"] == 0]
        med = lambda k: statistics.median(v) if (v := [r[k] for r in ok if r.get(k) is not None]) else None
        row = {"tool": tool, "video": video, "runs": len(rs), "ok": len(ok), "wall_s_each": [r["wall_s"] for r in rs]}
        for k in ("wall_s", "user_s", "sys_s", "max_rss_mb", "calls", "images", "bytes_up", "in_tok", "out_tok", "usd"):
            row[k] = med(k)
        rows.append(row)
    return rows

if __name__ == "__main__":
    argv = sys.argv[1:]
    out = argv[argv.index("--json") + 1] if "--json" in argv else None
    rest = [a for i, a in enumerate(argv) if a != "--json" and (i == 0 or argv[i - 1] != "--json")]
    rows = summarize(rest[0] if rest else os.path.join(os.path.dirname(os.path.abspath(__file__)), ".work", "results"))
    if out: json.dump({"prices_usd": PRICE, "rows": rows}, open(out, "w"), indent=1)
    print("| video | tool | runs ok | time s | CPU s | peak MB | requests | images | MB up | in tok | out tok | $ |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for r in rows:
        if not r["ok"]: print(f"| {r['video']} | {r['tool']} | 0/{r['runs']} | failed |"); continue
        cpu = (r["user_s"] or 0) + (r["sys_s"] or 0)
        print(f"| {r['video']} | {r['tool']} | {r['ok']}/{r['runs']} | {r['wall_s']:.1f} | {cpu:.1f} | {r['max_rss_mb']:.0f} | "
              f"{r['calls']:.0f} | {r['images']:.0f} | {r['bytes_up'] / 1e6:.2f} | {r['in_tok']:.0f} | {r['out_tok']:.0f} | {r['usd']:.4f} |")
