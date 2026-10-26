# Logs every OpenAI call (path, model, bytes up, images, latency, usage) to a JSONL file, then forwards it.
# Usage: proxy.py <port> <log.jsonl>. One adaptation: Chat Completions `max_tokens` becomes
# `max_completion_tokens` and `temperature` is dropped for gpt-6-* models, which reject both.
import json, sys, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
PORT, LOG = int(sys.argv[1]), sys.argv[2]
UP = "https://api.openai.com"

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _go(self, method):
        body = self.rfile.read(int(self.headers.get("content-length") or 0)) if method == "POST" else None
        entry = {"t": time.time(), "method": method, "path": self.path, "bytes_up": len(body or b"")}
        ctype = self.headers.get("content-type", "")
        if body and ctype.startswith("application/json"):
            try:
                j = json.loads(body)
                entry["model"] = j.get("model")
                s = json.dumps(j)
                entry["images"] = s.count("data:image/")
                if str(j.get("model", "")).startswith("gpt-6") and ("max_tokens" in j or "temperature" in j):
                    if "max_tokens" in j: j["max_completion_tokens"] = j.pop("max_tokens")
                    j.pop("temperature", None); entry["adapted"] = True
                    body = json.dumps(j).encode()
            except Exception: pass
        elif body and "multipart" in ctype:
            entry["model"] = "audio-upload"
        hdrs = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "content-length", "accept-encoding", "connection")}
        req = urllib.request.Request(UP + self.path, data=body, headers=hdrs, method=method)
        t0 = time.time()
        try:
            r = urllib.request.urlopen(req, timeout=600); status, data, rh = r.status, r.read(), r.headers
        except urllib.error.HTTPError as e:
            status, data, rh = e.code, e.read(), e.headers
        entry.update(status=status, latency=round(time.time() - t0, 3), bytes_down=len(data))
        try:
            j = json.loads(data)
            if "usage" in j: entry["usage"] = j["usage"]
            if "duration" in j: entry["audio_sec"] = j["duration"]
            if status >= 400: entry["error"] = str(j)[:300]
        except Exception: pass
        with open(LOG, "a") as f: f.write(json.dumps(entry) + "\n")
        self.send_response(status)
        self.send_header("content-type", rh.get("content-type", "application/json"))
        self.send_header("content-length", str(len(data)))
        self.end_headers(); self.wfile.write(data)
    def do_POST(self): self._go("POST")
    def do_GET(self): self._go("GET")

ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
