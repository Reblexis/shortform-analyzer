# claude-real-video's frames.json → [{"path", "t"}] for llm_step.py. Usage: crv_frames.py <crv out dir> <frames.json>
import json, os, sys
d = sys.argv[1]; raw = json.load(open(os.path.join(d, "frames.json")))
items = raw.get("frames", raw) if isinstance(raw, dict) else raw
out = []
for f in items:
    name = f.get("file") or f.get("path") or f.get("filename")
    t = f.get("t", f.get("time", f.get("timestamp", f.get("seconds", 0))))
    out.append({"path": name if os.path.isabs(name) else os.path.join(d, "frames", os.path.basename(name)), "t": float(t) if not isinstance(t, str) else sum(float(x) * 60 ** i for i, x in enumerate(reversed(t.split(":"))))})
json.dump(out, open(sys.argv[2], "w"))
