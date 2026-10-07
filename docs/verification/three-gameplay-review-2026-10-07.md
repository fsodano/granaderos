# Integrated 3D review — 7 October 2026

The battlefield already uses the Three.js sector renderer and the eight-body
human library. This pass checks that integration against the existing sprite
and building catalogue, then improves specific defects in small increments.

## First increment

The playable renderer sandbox now includes all nine colonial building types,
alternating facade directions, and standing, running, crouched and prone
movement. Doors and movement use the ordinary battle reducer. The sandbox and
its complete tactical HUD fit the review viewport.

Facade windows, tower faces and trim now follow the entrance direction. Civic
cupolas rest above the facade instead of filling the entrance. Static clock
faces, church bells, gallery braces, a pulpería trade sign and a capped rural
chimney restore detail visible in the [existing building catalogue](../../assets/previews/buildings/catalogue.png).
Pitched roofs have fascia, thickness and rounded ridge joins. Default flat
terraces use masonry and retain explicit authored roof finishes.

The civic clock follows the [official Buenos Aires history](https://buenosaires.gob.ar/gcaba_historico/noticias/un-simbolo-de-la-revolucion-de-mayo-y-de-buenos-aires),
which places a Cádiz clock in the eighteenth-century tower. Colonial roof,
timber and ironwork references are documented by the [national monument register](https://www.argentina.gob.ar/capital-humano/cultura/monumentos/cabildo-de-la-ciudad-de-buenos-aires).
These details remain scale interpretations; the clock does not display the
campaign time.

Trees now have connected tapered trunks, roots, forked branches and irregular
foliage sprays. An adult tree uses 2,112 triangles instead of 2,160. Actor canopy
fading and level admission retain their earlier rules.

Prone travel previously covered a 1.236-metre cell in 420 ms while its metadata
used an approximately 0.08 m/s foot measurement. The game drove the crawl cycle
many times faster than its native movement. The revised profile measures the
supporting forearms in the actual exported clips: male 0.195142 m/s and female
0.194203 m/s. Player travel and admitted enemy frames share that pace. Diagonal
travel uses its real distance. Hidden steps keep their earlier timing, and no
presentation clock changes AP, equipment, saved state or movement rules.

## Evidence and reproduction

The first combined local selection passed 147 tests in about 15 seconds,
including actor runtime, clocks, projection, visibility, combat effects,
buildings, vegetation, sandbox reducer actions and camera movement. TypeScript,
the documentation audit, all 38 baseline checks and production static export
passed. The export contained 1,243 files and 1,038 verified asset references.

`tools/verify-three-browser.mjs` captures eight integrated scenes and rejects
page/asset errors, missing characters, empty geometry or a clipped review HUD.
`tools/verify-three-actions.mjs` checks a real rifle shot, finite reload and crawl
through the UI and captures all nine building views. Both use `PLAYWRIGHT_MODULE`
and optional `CHROMIUM_EXECUTABLE`; the default review URL is
`http://127.0.0.1:3150/renderer-sandbox`. Output stays in ignored
`artifacts/three-gameplay-review/`, or `GRANADEROS_REVIEW_OUTPUT`.

Warm browser measurements on this computer used Chrome, Apple M2 Max hardware
graphics, DPR 1 and a 992 × 634 canvas. After actor loading and a three-second
settle, five one-second samples were:

| Scene | FPS samples | Active / loaded characters |
| --- | --- | --- |
| Combat | 60, 60, 60, 60, 60 | 12 / 13 |
| Night | 60, 60, 60, 60, 60 | 12 / 13 |
| Tucumán | 60, 59, 60, 60, 60 | 8 / 8 |
| 100-character sector | 60, 60, 57, 60, 60 | 47 / 100 |

Cold loading samples were lower. These measurements cover the stated camera
and computer; they do not establish 100 simultaneously visible bodies or DPR 2
performance.

## Second increment

All ground and horse movement now uses the exported stride of the matching
anatomy, equipment and posture. Male unarmed walking takes about 683 ms per
cardinal cell and running about 441 ms. Diagonal segments retain the same
physical speed. Recorded crawl and horse steps wait until their visible
travel completes and commit the final battle once.

Roof UVs now measure metres along the eave and the real slope. Partial room
cutaways reuse the original plane coordinates. Clay courses are approximately
19 cm wide and 45 cm long; roof maps retain their source colours and add subtle
surface relief. Ground and flat terrace coordinates retain their existing
mapping.

Palace balconies require two solid entrance supports. Barracks gate details,
stable timber frames and church tower foundations follow the authored walls
and skip openings. Individual building selection removes the other guards,
so the full facade and roof can be reviewed through normal camera controls.

The local selection passed 108 motion/input/playback/export tests, 28 building
and world tests, and the updated cumulative-distance checks. TypeScript and
production static export passed. The real UI fire/reload/crawl checks passed
again and all nine isolated facades were captured. A separate empty-sector
browser check loaded all ground textures, removed the loading message and
reported zero actors, 5,280 triangles and no errors.

## Next increments and acceptance limits

The civic facade still needs two readable arcade levels. Browser review also
found raised long garments in prone poses and recorded reloads playing much
faster than their native clip. These are the next specific corrections. The
broader posture bank, braking steps and paired melee contact still need
review. The [character review](../../assets/source/characters-3d/REVIEW.md) records
the accepted standing reference and the retained motion bank separately.

The inspected sprites provide anatomy, clothing, grips and silhouette targets;
the supplied tactical references provide density and room-readability targets.
Passing geometry and loading checks does not certify final visual polish. This
record is an incremental acceptance report, not a declaration that the full 3D
or gameplay objective is complete.
