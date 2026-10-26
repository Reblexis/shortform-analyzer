#!/usr/bin/env bash
# Three stand-in videos made with ffmpeg lavfi, the lengths of the October 2026 run: 17 s with 5 cuts,
# 28 s with 14 cuts, 61 s with 3. Each shot is one colour, over a tone.
set -euo pipefail
OUT="$(cd "$(dirname "$0")" && pwd)/.work/videos"
mkdir -p "$OUT"
make() { # name seconds shots
  local name=$1 dur=$2 n=$3 inputs="" chain="" i
  local len; len=$(echo "scale=3; $dur / $n" | bc)
  local colors=(red green blue orange purple teal yellow gray pink navy olive maroon cyan brown white)
  for ((i = 0; i < n; i++)); do
    inputs+=" -f lavfi -i color=c=${colors[i % ${#colors[@]}]}:s=576x1024:r=30:d=$len"
  done
  for ((i = 0; i < n; i++)); do chain+="[$i:v]"; done
  chain+="concat=n=$n:v=1:a=0[v]"
  # shellcheck disable=SC2086
  ffmpeg -v error -y $inputs -f lavfi -i "sine=frequency=440:duration=$dur" \
    -filter_complex "$chain" -map "[v]" -map "$n:a" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT/$name.mp4"
  echo "$OUT/$name.mp4"
}
make demo-17s 17 6
make skit-28s 28 15
make talk-61s 61 4
