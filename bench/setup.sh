#!/usr/bin/env bash
# Clones the three tools under test at fixed commits into bench/.work/src and installs each in its own env.
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)/.work"
mkdir -p "$W/src" "$W/env"
clone() { # repo commit dir
  [ -d "$W/src/$3" ] || git clone -q "https://github.com/$1.git" "$W/src/$3"
  git -C "$W/src/$3" checkout -q "$2"
}
clone byjlw/video-analyzer 2b095faf8a965eda5ba055ef29eb0cd71698ae6f video-analyzer
clone HUANGCHIHHUNGLeo/claude-real-video ab4b9b2b23790f5d63a6d15165d3d8ba284c6023 claude-real-video
clone jordanrendric/claude-video-vision 4a4f99016f249a24018cd19b66531ebbcd58024b claude-video-vision

# video-analyzer imports pkg_resources (setuptools < 81), and its Whisper fails on PyAV 19 (faster-whisper passes
# an argument PyAV 19 removed), so it is pinned below both.
uv venv -q --allow-existing -p 3.12 "$W/env/byjlw"
VIRTUAL_ENV="$W/env/byjlw" uv pip install -q "$W/src/video-analyzer" "setuptools<81" "av<19" --only-binary av
uv venv -q --allow-existing -p 3.12 "$W/env/crv"
VIRTUAL_ENV="$W/env/crv" uv pip install -q "$W/src/claude-real-video[whisper]"
(cd "$W/src/claude-video-vision/mcp-server" && npm ci -s --no-audit --no-fund --ignore-scripts && npm run -s build \
  && npm install -s --no-save --no-audit --no-fund openai)

# claude-video-vision reads ~/.claude-video-vision/config.json; run.py points HOME here instead.
mkdir -p "$W/home-cvv/.claude-video-vision"
cat > "$W/home-cvv/.claude-video-vision/config.json" <<'JSON'
{ "backend": "openai", "frame_mode": "images", "frame_format": "jpeg", "frame_resolution": 512, "default_fps": "auto", "max_frames": 100, "enable_index": false }
JSON
echo "setup: ok ($W)"
