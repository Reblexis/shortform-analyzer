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
