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

## Third increment

Tall civic facades now have two distinct arcade levels, upper iron rails,
side windows and a larger clock cupola. Short village profiles retain one
level. Chapel bell gables have a real arched opening; domestic and forge
chimneys start at the roof on a solid side wall. All supports skip authored
doors, windows, breaches and playable upper surfaces. Cutaways remove them
with their room.

The complete fourteen-template catalogue now provides exterior, first-room
and complete-interior states in four rotations. Each state is prepared by
ordinary door and movement orders from one exterior guard. The 168-state
fixture checks passed without writing room disclosure directly or changing
source templates. `tools/verify-three-catalog.mjs` captures six live states
per template; `--full` captures all twelve. The earlier nine-building selector
remains available.

Named room purposes now select appropriate dressing. Administrative shelves
show leather-bound ledgers and tied paper. Carts, cannon tyres and seeded
loose timber remain above their floor and within their authored footprints.
Timber, stone and brick retain texture colours, with subtle wood and plaster
surface relief.

The friar and woman-shawl use calf-aware sewn panels and sparse crouch/prone
corrective shapes blended with the body clock. All six LODs keep their bones,
triangles, textures and draw calls. Side views confirm the prone drape lies
over the legs and the friar crawl keeps that silhouette. Full garment motion
coverage and general cloth collision are not established by those samples.

Recorded maintenance gestures now use native clip intervals. Interrupted
rifle loading presents only the paid work and resumes at its stored fraction.
The live `tools/verify-three-partial-loading.mjs` check retained 69% work through
the next turn, then spent 14 internal AP (3.5 displayed PA) and one cartridge
exactly once. The four UI stages produced no browser errors.

## Fourth increment

Six rifle lengths now have distinct loading and unloading contacts in four
postures and both anatomy banks. The loading palm stays within 6 mm of its
actual muzzle and the 3 mm ramrod axis fits the measured muzzle clearance.
Support feet remain planted; crouched stocks clear the floor. This adds 48
item-specific aliases to each bank, for 318 clips, and updates the eight generic
rifle loading clips. The other 262 original clips and bank meshes were retained
byte-for-byte at that boundary. Native source closeups and the real interrupted
loading control confirm the corrected bindings.

Recorded grenade and knife throws now use the native preparation interval,
continue from the release marker through the visible flight, and keep impact
results without replaying the throw. Eighteen focused checks cover one final
commit, blocked repeated input, finite item use, impact cues and hidden-flight
privacy. The rules result remains equal to the ordinary reducer result.

Masonry now reuses the existing mottled sprite plaster. Box surfaces measure
texture coordinates in metres, so unequal wall lengths and rotated facades
keep a common texture density. Unequal faces, adjacent joins and explicit
polygon coordinates pass the focused checks. Church fronts regain their curved
crest and barred round window; the bell stage clears the actual roof ridge.
Tower foundations and cornices skip playable upper surfaces.

Posta, warehouse and smithy canopies have roof undersides, fascia and supported
beams. Timber braces and masonry capitals remain within solid authored cells.
The live catalogue captured 18 views across these three templates without
browser errors. Exterior captures and the warehouse interior were compared
with the retained artwork. The posta piers remain subtle at the review scale.

## Next increments and acceptance limits

Mounting, throw body mechanics, the broader posture bank, braking steps and
paired melee contact still need review. The
[character review](../../assets/source/characters-3d/REVIEW.md) records the
accepted standing reference and the retained motion bank separately.

The inspected sprites provide anatomy, clothing, grips and silhouette targets;
the supplied tactical references provide density and room-readability targets.
Passing geometry and loading checks does not certify final visual polish. This
record is an incremental acceptance report, not a declaration that the full 3D
or gameplay objective is complete.
