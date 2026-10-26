# The model step for tools that stop at frames + transcript (claude-real-video, claude-video-vision):
# one Chat Completions call to gpt-6-luna with every frame and the transcript, asking for the same
# breakdown shortform-breakdown gives. Usage: llm_step.py <frames.json> <transcript.txt> <out.json>
# frames.json: [{"path": ..., "t": seconds}] in time order.
import base64, json, os, sys, urllib.request
frames = json.load(open(sys.argv[1])); transcript = open(sys.argv[2]).read() if os.path.exists(sys.argv[2]) else ""
PROMPT = """These are frames from one short-form video in time order, each with its time in seconds, followed by the transcript.
Break the video into scenes. For each scene give start and end (seconds), beat (one of hook, setup, value, proof, payoff, cta),
lever (what keeps viewers watching: curiosity, emotion, humor, demonstration, transformation, relatability, authority, none)
and hold (0 = viewers scroll away, 4 = nearly impossible to scroll away). For the whole video give format and goal
(conversion or awareness). Answer with JSON only: {"scenes":[{"start","end","beat","lever","hold"}],"format","goal"}."""
content = [{"type": "text", "text": PROMPT}]
for f in frames:
    content.append({"type": "text", "text": f"t={f['t']:.2f}s"})
    content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(open(f["path"], "rb").read()).decode()}})
content.append({"type": "text", "text": "Transcript:\n" + (transcript or "(none)")})
body = json.dumps({"model": "gpt-6-luna", "messages": [{"role": "user", "content": content}], "response_format": {"type": "json_object"}}).encode()
req = urllib.request.Request(os.environ["OPENAI_BASE_URL"].rstrip("/") + "/chat/completions", data=body,
                             headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"], "content-type": "application/json"})
d = json.load(urllib.request.urlopen(req, timeout=600))
json.dump(json.loads(d["choices"][0]["message"]["content"]), open(sys.argv[3], "w"), indent=1)
print("frames", len(frames), "usage", d["usage"]["prompt_tokens"], d["usage"]["completion_tokens"])
