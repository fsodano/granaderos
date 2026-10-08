# Prone rifle aim, fire and reload boot support

The complete weighted boot surfaces in nine prone rifle clips crossed the floor. The current source calls native boot support for prone idle and crawl, but leaves aim, fire and reload on the original fixed prone leg pose. The maximum measured penetration was 53.188 mm in the male LOD2 and 47.412 mm in the female LOD2. The defect occurs throughout these clips, not only at a marker.

## Small native source cut

`build-prone-rifle-support.py` reads the current complete native banks. It uses their supported `prone.idle.long-gun` leg pose for `prone.aim.long-gun`, `prone.fire.long-gun`, generic `prone.reload.long-gun` and the six reload variants for owned rifles 1800, 1801, 1802, 1803, 1804 and 1807. Each target must have a fixed native leg pose and exactly the same fixed Root/pelvis channels as that supported idle. A changed parent or moving leg causes a build failure. The existing idle has at most 3.13e-7 quaternion component bake noise; source sampling allows that export precision without changing floor or native reach gates.

Only six thigh, calf and foot rotation outputs per clip change. Every input time, interpolation, output count, Root/pelvis, ball, upper-body, weapon and loading-contact channel remains exact. The cut changes 54 rotation outputs per bank, retains 1,377 other selected channels and all 325 unrelated clips. The complete native node/rest dimensions, offsets/scales, mesh/skin/inverse binds and other document fields remain exact. This retains the released rifle guard and lance idle. Actual periods, nominal durations, markers, action costs and profile remain unchanged. Manifest changes are eighteen support records and the two bank byte/hash pairs.

Full library generation runs this small named postpass after the existing guard support pass. The builder uses the current supported idle rather than a stored old animation bank. It checks both banks before publication and rejects a concurrent bank or manifest change. Repeat runs retain exact published asset bytes. No runtime correction or new per-frame work is added.

## Complete boots and ordinary blends

Both anatomies and all three LODs were sampled across all nine stored clips. Actual full-boot minima, in millimetres, are:

| Anatomy | LOD | Before | After | Existing supported idle |
| --- | --- | ---: | ---: | ---: |
| Male | 0 | -51.995 | 2.156 | 2.156 |
| Male | 1 | -52.142 | 2.009 | 2.009 |
| Male | 2 | -53.188 | .963 | .963 |
| Female | 0 | -46.437 | 1.982 | 1.982 |
| Female | 1 | -46.642 | 1.777 | 1.777 |
| Female | 2 | -47.412 | 1.007 | 1.007 |

The male LOD2 .963 mm endpoint is an existing supported-idle clearance limit. This cut retains that idle exactly and does not claim at least 1 mm for every LOD. The ordinary blend gate requires no additional penetration versus each current supported idle, within 0.1 micrometre of float precision, plus a positive floor clearance and both contacts below the existing 3 mm prone support bound. The existing LOD0 prone boot gate above 1 mm also passes.

Forty-eight ordinary presentation/reducer routes cover both anatomies, all LODs, fire-mode aim entry/return, an admitted ground shot and each owned rifle reload. The minimum through entry/work/return is .963264 mm; maximum boot contact is 2.271327 mm; maximum complete-boot speed is .001765 mm/s. Native offsets/scales and saved wrapper position/yaw remain exact. Inputs and final reducer snapshots remain unchanged by visual playback. Native loading contact and existing prone idle/crawl checks pass.

```sh
node --test --test-name-pattern='prone|48 ordinary' tests/characters-prone-rifle-support.test.mjs tests/characters-boot-support.test.mjs tests/characters-rifle-loading.test.mjs
python3 tools/characters-3d/build-prone-rifle-support.py --receipt /tmp/prone-rifle-support.json
python3 tools/characters-3d/verify-library.py
node tools/characters-3d/compile-locomotion-profile.mjs --check
npm run typecheck
```

## Visible comparison and scope

Four normal browser routes compare both anatomies before and after on an isolated renderer. They select the owned prone Brown Bess, use F to aim, Enter on a free ground cell to fire, Shift+R to reload and Escape to return to idle. Twenty-four same-camera images cover aim, discharge, early loading, ramrod work, return and idle. All five actors load; no page or console errors occur. The after views show the toes and lower boots above the surface while the upper rifle pose stays unchanged.

This is a source boot correction for the nine named clips. It does not certify the remaining prone brace, priming, repair, unload, pistol or gesture families. Those remain separate audits. It does not alter either frozen sideways/crouch publication package.
