# How-it-works video

`how-it-works.gif` (README) and `how-it-works.mp4` (with sound) are rendered from
`how-it-works.src.html`, made with the `explainer-engaging` skill from
[Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics) (MIT).

To render again: replace `__GEIST__` and `__GEISTMONO__` with the base64 of `Geist-Variable.woff2`
and `GeistMono-Medium.woff2` (Geist fonts, SIL Open Font License, `OFL-Geist.txt`), save as
`how-it-works.html`, then, with `npm i playwright` and ffmpeg:

```bash
node render.mjs how-it-works.html how-it-works.mp4 60 8 8
ffmpeg -i how-it-works_silent.mp4 -vf "fps=15,scale=800:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" how-it-works.gif
```

## Demo videos (next version)

The next how-it-works video shows a real TikTok going through the package: where it is cut,
which words land in which scene, and the labels each scene gets. No metaphors: every number,
word and label on screen comes from a real `analyzeVideo` run (`analysis.json`, `frames/`).

The candidates, picked from the most viewed TikToks through apinoa (views on 2026-10-25, cuts
from `detectScenes`). The videos belong to their creators: credit the account and link the
post, and keep the video files out of the repo (only the rendered GIF and MP4 go in).

| Video | Views | Length | Real cuts | What it shows |
| --- | --- | --- | --- | --- |
| [Cat brush (@pet..supplies)](https://www.tiktok.com/@pet..supplies/video/7112871757157092650) | 96.3M | 17 s | 5 | The cat, the brush at work, the happy cat, then the caption "works very well": hook → value → proof → cta in plain sight. Should come out `product_demo`, `conversion` |
| [Zach King, "a message to all AI"](https://www.tiktok.com/@zachking/video/7655004069190192398) | 67.8M | 28 s | 14 | Many cuts, speech and on-screen text, but 17 scenes look busy in one GIF |
| [Khaby Lame](https://www.tiktok.com/@khaby.lame/video/7678009073421405471) | 124.5M | 31 s | 5 | No speech, so it cannot show words being given to scenes |

The most viewed TikTok, [Zach King's Hogwarts broom](https://www.tiktok.com/@zachking/video/6768504823336815877)
(2.4B), is one take with no cuts: it would only show the 5 s split, not cut detection.
