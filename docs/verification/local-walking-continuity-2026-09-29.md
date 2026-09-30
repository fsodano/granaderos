# Walking continuity in the local game

This report applies to the advanced local checkout served at port 3000. Its
base is `eb39ef7e903fa33f1d463b2af0db2de3c66cf93c` with existing working changes.
It is separate from published main. [The evidence file](../evidence/local-walking-continuity-2026-09-29.json)
records all six changed file hashes and validation logs.

The walking clock now carries only movement time between cells. Preparation
waits and late endpoint callbacks cannot advance it past unseen poses.
Illustrated figures and shadows keep fractional screen positions. The native
pixel fallback remains aligned to whole pixels. Player walking, running,
crouching and crawling retain phase through delayed steps and unrelated renders.

The original checkout passes 33 targeted checks and 11 rendered-scene checks,
types and the production
build (1099 exported files, 993 asset references). The isolated advanced copy
passes 44 related checks, plus an eight-case gait group covering all four player
movement modes. Each changed file matched its saved source hash before application.
Unrelated edits and the user's normal save were retained.

Using the separate QA save, the ordinary map control moved Acosta six cells
from (23,20) to (23,14) in Retiro, with center follow and 100% scale. A 20-second
capture recorded phases `0,1,2,3,0,1,2,3`. All 56 moving samples kept fractional
sprite positions. There were no browser errors, long tasks or long animation
frames in the visible-browser capture.

Display callbacks averaged 32.87 ms overall; position updates averaged 32.29 ms
(p95 33.70 ms, maximum 66.70 ms). The prior hidden-browser capture also ran near
30 FPS. Test runners were stopped and the computer reported battery power at
18%. Chrome documents that [Energy Saver can reduce display refresh](https://developer.chrome.com/blog/memory-and-energy-saver-mode).
This is a possible explanation, not a verified cause in this embedded browser.
A six-second visible title-screen control, with zero SVG elements or actors,
also averages 32.65 ms per browser callback, with no long tasks. This shows the
current callback limit also exists without tactical rendering. It does not
identify its platform cause. No power setting was changed. The result does not establish a speed improvement
against the earlier 120 Hz capture or satisfy sustained 60 FPS acceptance.

Walking artwork still contains only four poses at five FPS. Four generated
candidates repeated leg poses or had wrong directions and were rejected.
Better intermediate poses, larger battle measurements and full campaign
acceptance remain open.

The focused release change merged in [PR #127](https://github.com/fsodano/granaderos/pull/127)
as `45bcc53861e3891fec40058c862cb256e7912478`, after all five checks passed on
head `fca80a22f9a97c57ab825d4402b0bbc64f01c80e`. The release suite passes 1247/1247.
The dirty local checkout remains intact and serves the integrated fix at port 3000.
