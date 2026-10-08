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

## Fifth increment

Farmhouse galleries now have joined front and return roofs, fascia, braces and
two capped chimneys. Their supports stay in actual intact wall cells, skip
edited openings and omit playable upper surfaces. The six live farmhouse
views retain ordinary door actions and room cutaways.

Grenade, knife and bolas throws now have distinct native body mechanics for
both anatomies. Torso and pelvis rotation, a controlled lead step and the free
arm support the release. The eighteen replaced clips preserve their existing
release times, joints and scale; the other 309 clips per anatomy stay unchanged.
The actual grenade order additionally verifies weapon stow through recorded
preparation, flight and recovery, including exhaustion of the final grenade.
The live order spends 3.75 PA once and produces no browser errors.

Mounting and dismounting now use the measured saddle, iron stirrup and tack
grips. The reverse path retains the same frame grid. The protected native
preparation lasts 2.3 seconds; competing orders are ignored until its result
commits once. The lance head now has its correct orientation, and long weapons
use fitted stow positions during the transition. The two equipment meshes are
the only replaced equipment geometry. Mounted idle boot contact still needs
a separate correction; these transition checks do not accept the entire
riding bank.

Pistol loading work now identifies the owned primary or offhand gun. The
native clock selects each paid interval, reflects the offhand body pose and
stows the other gun while its hand works. The playable two-pistol review
checks both guns together and the offhand alone. The first spends 15 PA and
two cartridges; the second spends 7 PA and one cartridge. Both retain one
charge in each owned gun. Repeated input during loading cannot add an order.
`tools/verify-three-paired-loading.mjs` reproduces these UI checks and captures
both working hands. Pistol muzzle contact remains a separate source audit.

The existing building support audit now covers all fourteen compiled types,
four rotations and original, window-edited and breached walls: 168 geometry
states. Low columns, gallery posts, pilasters and trim remain in solid cells;
the depot hoist clears the approach, and the pulpería sign retains its timber
barrel emblem above the standing entrance height. The nine changed templates
produced 54 live exterior, partial and interior captures without browser
errors. Selected facade and interior images were visually reviewed. The
support probe does not by itself establish final facade quality.

## Sixth increment

Mounted boots now meet the moving iron stirrups. The fit changes only eight
leg and foot rotation tracks in 74 mounted or transition clips per anatomy.
The checked boot contact stays within 7 mm of the iron, and mount/dismount
endpoints stay within 6 mm. The other 49,954 animation tracks, native meshes,
skin bindings, weapon contacts and action clocks remain byte-identical at this
boundary. Live riding and reverse mounting views were inspected.

Pistol loading now fits three actual item lengths in both bodies and all four
postures. The maximum checked native muzzle gap is 0.69 mm and rod centre
offset is 1.13 mm. The timed rod uses the existing mesh at the actual short
barrel length. Each charge of the 1808 two-barrel pistol uses its own bore;
partial second-barrel work resumes on that same bore. The other 314 clips,
native rigs and meshes per anatomy remain unchanged at the pistol boundary.
The bank now contains 334 clips per anatomy.

The playable **Recarga de cuatro cañones** scene uses real exploration orders
and finite cartridges. Its live check loads two charges in each owned pistol,
reducing reserve from eight to four once. The offhand-only order reduces eight
to six and leaves the loaded primary gun alone. Repeated input is blocked.
Both working hands and all four rod strokes were captured and viewed without
browser errors. Exploration retains its ordinary AP rules. The earlier combat
scene still checks the 15 PA/two-cartridge and 7 PA/one-cartridge orders.
`tools/verify-three-paired-loading.mjs --four-bores` reproduces the new scene.

Ladder playback now faces the upper end in both directions and retains the
full native interval. A three-metre ascent or descent takes 4.615 seconds at
0.65 m/s vertical pace. Hidden reappearance retains its ordinary admission
delay. Exact paid endpoints, AP and battle state remain authoritative. The
slower live review exposed roof-edge and limb support defects; the timing
boundary does not accept those contacts.

Limewashed and adobe walls now use mild variation from the retained plaster
map instead of multiplying their finish by its strong brown pigment. Physical
texture density and relief remain unchanged. The town hall has the retained
sprite's curved clock crown, stone entablature and two low finials. Twelve live
views checked its four rotations and three room states. Formal facade columns
and separate upper windows remain under comparison.

Chapel gables and house/forge chimneys now use the actual authored roof slab
height. They skip usable roof cells and retain ordinary cutaways. The visible
catalogue roof control permits original roofs, terraces, blocked three-metre
slabs and accessible three-metre roof routes. Zero-height blocked cells retain
collision without adding raised obstacle blocks. Positive/default obstacles
retain their geometry. Twelve corrected chapel/house slab views and six forge
roof-route views produced no browser errors; selected exteriors and interiors
were inspected.

Actor equipment and clothing now rebind only when the immutable presentation
record changes. Native clocks, timed tools and completion still advance each
visible frame. Real paired loading passed after this change. On the same M2 Max,
Chrome, DPR 1 and 992 × 634 canvas used above, a camera exposing all 100 loaded
bodies produced warm samples of **60, 60, 57.2, 59, 60 FPS** with 1,553 draw calls
and 1,438,718 triangles. The first LOD-switch sample was 31.9 FPS. This is bounded
warm performance evidence; it does not establish locked 60 FPS or other hardware
and pixel densities. The earlier table remains the earlier camera's evidence.

## Seventh increment

The formal town hall now follows its direct sprite with capped square columns,
corner supports, a storey band and eighteen separate barred upper panes. These
details use actual solid wall cells, keep opening rays clear and omit upper
panes on short slabs. Six live room-state and rotation views produced no browser
errors. The exterior was compared directly with the current 2D town hall.

All fourteen building templates now retain their sprite's jointed stone footing.
Plaster walls have small deterministic low chips and scuffs using the existing
undercoat. Brick and stone faces, openings and cut walls do not receive plaster
wear. The geometry check covers 56 rotated bases, 168 room/window/breach states
and 24 short-slab/roof-route states. Twenty-four live views of the town hall,
palace, house and warehouse produced no browser errors; selected views were
inspected against their retained source. Palace upper detail remains pending.

The Escopeta Criolla now has the supplied reference's single bore, matching its
capacity-one rule. All nine firearms also fit their separate lock, band and sight
centres to the same length factor as their vertices. The old short rifle and
Trabuco fittings extended 45–355 mm beyond their native muzzles. The corrected
barrel ends remain 2.9–4.6 mm behind them. Seventeen other item meshes, all gun
roots and muzzle markers, equipment metadata and loading clips remain unchanged.
The [firearm review](../art/firearm-fitting-3d-review-2026-10-07.md) records the
source comparison and corrected timed rod views.

The pistol clearance check now uses published deformed face and neck triangles.
Every charge, hand, posture and physical bore passes 45 native poses with a
conservative 15 mm barrel capsule. Minimum surface gaps are 34.50 mm for the male
body and 43.76 mm for the female body. Corrected source views show the actual rod;
these supplement the sixth increment's live four-bore acceptance.

Melee contact cues now carry a typed visible target pose only after actor
admission and room readability. Stale, hidden, missing, ambiguous and coordinate
targets cannot supply body data. Real paid orders retain their authoritative
outcome and save state. This prepares contact fitting; diagonal sword reach is
still under repair and is not accepted by this data boundary.

## Eighth increment

Door leaves now retain the direct sprite's separate detail on both faces.
Panelled leaves have four framed fields, plank leaves have board seams and
straps, and barn leaves have flat timber V-braces. Local moulding and brace
colours make their narrow raised edges visible while the shared timber leaf
finish remains intact. Handles and hinge plates stay attached to the original
hinges. Short cutaway stubs omit full-height hardware and panels.

Twenty-six affected checks cover all fourteen actual catalogue templates and
four rotations, both leaf faces, standing doorway clearance, breaches, room
cutaways, slabs and roof routes. Twenty-four stable live views of house, town
hall, palace and warehouse produced no browser errors. Selected exteriors and
interiors were visually reviewed. Captures interrupted by loading are removed
and repeated by the catalogue checker; an earlier loading image is excluded.

The melee body resolver now uses only the current loaded actor matching the
admitted target pose and appearance. Hidden, pending, stale, replaced, failed
and ambiguous models cannot supply geometry. Thirty-four runtime/resolver checks
and the type check pass. A collapsed clothing face now supplies a finite segment
or point distance. This is groundwork for the measured paired contact repair,
which remains pending.

## Ninth increment

The palace now follows its direct sprite with four supported capped columns,
a measured storey band, a joined balcony and twenty-one arched upper panes on
all four faces. Edited openings remove their supports. Short slabs retain one
facade storey, and ordinary room cutaways remove the upper decoration. The
[palace review](../art/palace-facade-3d-review-2026-10-07.md) records the source
comparison and the separate pending portico roof and crest.

Paired melee cues now include only nearby disclosed passable floor rectangles
at the attacker height. Walls, windows, closed doors, uneven floors, unreadable
rooms and disclosed blocking props cannot support a fitted step. Private prop
records do not change visible support. This is a boundary for the pending
contact fit; it does not yet change the native attack.

Ladder geometry now refreshes when the authored endpoint heights change at the
same saved cells. The clean committed cut passed 114 affected checks in 6.77
seconds, type and documentation checks, all 38 baseline checks, and the
production export. Twelve live palace views cover the original roof and the
closed 3 m slab without browser errors. Selected rotated exteriors and the
short slab were visually inspected against the current sprite.

## Tenth increment

The palace portico now retains the direct sprite's raised stone entablature,
shallow tiled gable and small geometric badge. Metre-based roof UVs, joined
fascia and ridge, and closed front and rear masonry keep the detail readable
from either side. Its whole return excludes walking upper cells. Short slabs,
breached supports and ordinary room cutaways omit the above-roof features.
The [portico review](../art/palace-portico-3d-review-2026-10-07.md) records the
source dimensions and the repaired rear closure.

The clean committed cut passed 75 affected checks in 10.78 seconds, type and
documentation checks, all 38 baseline checks, and the production export.
Six stable playable palace views produced no browser errors. The front,
rear and interior were compared with the current sprite. The native repair
work remains separate from this small architectural release.

## Timber lattice increment

Lattice windows now follow the direct sprite's diagonal timber strips and source
colour on both faces. Barred and arched windows retain their iron. Edited styles,
breaches and normal room cutaways retain their existing shell controls. The
[timber window review](../art/timber-lattice-3d-review-2026-10-07.md) records the
measured opening and final visual comparison.

The clean committed cut passed 31 affected checks in 10.13 seconds, the type and
documentation checks, all 38 baseline checks and the production export. Twelve
final playable pulpería and caballeriza views had no browser errors. Selected
exterior and interior views were compared with the current sprites.

## Native climbing increment

The complete native ascent and descent follow the same measured ladder as the
world mesh and movement path. Hands and feet retain support through the roof
transfer; both saved endpoints and the original authoritative costs remain.
Same-cell access has a real slab aperture and a flush timber cover. The cover
opens only for an admitted visible climb and restores ordinary roof footing
afterward. Visible melee support excludes an actively open hatch.

The [native climbing review](../art/native-climbing-3d-review-2026-10-07.md)
records the native preservation proof, physical surface checks and limitations.
The clean cut passed 69 affected checks, type/docs/baseline/native/profile checks
and the production export. Four final playable hatch routes at 3 m and 4.2 m
retained exact saved endpoints without browser errors. Male and female roof
transfers and the opposite-facing rural-house route were visually reviewed.

## Crouched boot increment

Native crouched idle/walk now fit the complete published boot at the actual
export grid. The worst stored interpolation is below 0.3 mm; idle rests at 2 mm.
The original swinging-foot lift and all upper-body, weapon and Root tracks
remain. All 322 other clips in each bank are exact. The
[crouched support review](../art/crouched-boot-support-3d-review-2026-10-07.md)
records the measured full surfaces and bounded source export.

The clean cut passed 72 focused checks, type/docs/baseline/native/profile checks
and the production export. It retains the concurrent rider fix and accepts the
current climb, loading and sabre regressions. Eight clean normal UI idle/walking
frames were captured; selected frames were visually compared with the sprites.
Prone and broader motion polish remain under review.

## Depot facade increment

The depot now retains the current sprite's full-height stone piers and loft
loading hatch, boom, pulley and rope. Their measured supports stay in intact
wall cells. Edited openings, actual pitched roof rise, ordinary room cutaways
and legal upper routes control the detail. The
[depot review](../art/depot-facade-3d-review-2026-10-07.md) records the source
comparison and final visible stone faces.

The clean cut passed 50 affected checks in 5.80 seconds, type/docs/baseline checks
and the production export. Six clean playable views had no browser errors.
Front/side exteriors and the rotated interior were compared with the current
sprite. This accepts the bounded depot correction.

## Prone boot increment

The complete native boots now remain on the support surface through prone idle
and crawl. The measured stored lower surface remains between 1 and 3 mm above
the floor, including the toe caps. Native leg rotations supply the correction;
body, arms, held weapons and all 322 other clips remain exact. The
[prone support review](../art/prone-boot-support-3d-review-2026-10-07.md)
records the actual surfaces and preservation comparison.

The clean cut passed 74 focused checks, type/docs/baseline/native/profile checks
and the production export. Fourteen clean normal UI frames completed
male and female one-cell crawl orders at exact saved destinations without game
or browser errors (excluding the missing favicon). Selected idle, crawl and
completion frames were compared with the sprites. Exposed unarmed hand/cuff
support and broader motion remain.

## Aged roof finish increment

Authored aged clay roofs now retain the current sprite's encoded saturation
and brightness before native lighting. Ordinary clay retains its existing
colour map and tile relief. The
[aged roof review](../art/aged-roof-finish-3d-review-2026-10-07.md)
records the direct source comparison and remaining support-placement defect.

The clean cut passed 13 affected checks, type/docs/baseline checks and the
production export. Twelve clean posta/estancia views had no browser errors;
the aged front and ordinary clay side were visually inspected.

## Warehouse buttress increment

Closed sloping masonry supports and pale inclined coping now replace the
warehouse's short trim blocks. All vertices remain in intact wall cells;
edited openings, real roof elevations and ordinary room cutaways control them.
The [warehouse review](../art/warehouse-buttresses-3d-review-2026-10-07.md)
records the source proportions and the remaining physical relief limit.

The clean cut passed 54 affected checks, type/docs/baseline checks and the
production export. Six clean playable views had no browser errors. The front
and interior were compared with the direct sprite. A separate shell-placement
correction is required to expose the support depth.

## Posta pier increment

The posta separates its broad stepped corner piers from thinner masonry porch
posts. Source support positions, intact cells, edited openings, actual roof
heights and ordinary room disclosure control the new details. The
[posta review](../art/posta-piers-3d-review-2026-10-07.md) records their source
proportions and the capitals still obscured by the legacy shell placement.

The clean cut passed 58 affected checks, type/docs/baseline checks and the
production export. Six clean playable views had no browser errors. Front,
side and interior were compared with the current sprite. A separate placement
correction remains necessary for the prominent capital silhouette.

## Warehouse shell placement increment

The default warehouse shell, roof, gables and loading canopy now share centred
wall coordinates. Both side supports expose 39.2 cm while staying inside
blocked support cells. Disclosed room floors meet the inner wall and keep their
finish and hatch clipping. Corner door/window edits retain their exact original
placement. The
[placement review](../art/warehouse-shell-placement-3d-review-2026-10-07.md)
records these joins and the remaining source-palette comparison.

The clean cut passed 69 affected checks, type/docs/baseline checks and the
production export. Thirty final clean playable original/slab/terrace/walking
roof views had no browser errors. Selected exteriors, interior and upper modes
were visually inspected against the source.

## Thatch roof finish increment

Authored thatch now retains the current sprite's encoded saturation and
brightness before native lighting. The aged treatment, ordinary clay, current
maps, physical spacing and bump relief remain. The
[thatch review](../art/thatch-roof-finish-3d-review-2026-10-07.md)
records the direct roof comparison and remaining stable-gable correction.

The clean cut passed 13 affected checks, type/docs/baseline checks and the
production export. Eighteen clean rural-house/stable/aged-control views had no
browser errors; the house front and stable side were visually reviewed.

## Posta corner exposure increment

The posta shell, front piers and porch now share centred wall coordinates.
The pale capital tops clear the original hip eave while the complete supports
remain within their solid wall cells. Room floors join continuously; corner
opening edits retain the original clipped shell. Warehouse placement remains
intact. The [posta exposure review](../art/posta-exposure-3d-review-2026-10-07.md)
records the current sprite comparison and remaining wall palette work.

The final clean cut passed 77 affected checks, type/docs/baseline checks and
the production export. Twelve clean rotation/disclosure views had no browser
errors. Front and side exteriors and the interior were visually inspected.

## Primary pistol-butt contact increment

A standing primary/right pistol with a free guard hand now contacts its actual
brass cap against the current admitted target body. The entire swept sole and
native wrist path must remain supported and reachable. A replacement model is
refitted and cached recovery does not inspect hidden targets. The
[pistol contact review](../art/supported-pistol-butt-3d-review-2026-10-07.md)
records the independent arm check and finite unsupported cases.

The clean cut passed 70 affected checks, type/docs/baseline checks and the
production export. The normal inventory/move/B/strike browser sequence had
no errors and applied exactly one paid 23-point impact without consuming its
charge or reserve. Contact and recovery screenshots were visually inspected.
The broader audit found a separate released sabre wrist-path issue, held for
its own repair; this pistol cut does not hide it.

## Native unarmed prone arm support increment

The unarmed prone idle/crawl palms, fingers and complete sleeves now clear
the floor. Alternating planted skin pulls set the unarmed distance clock;
torso, Root, legs, fingers and every equipped clip remain exact. Per anatomy,
all 332 other clips and 306 non-arm selected channels are preserved. The
[prone arm review](../art/prone-arm-support-3d-review-2026-10-07.md) records
actual stored versus nominal duration and the remaining lateral contact roll.

The final clean cut passed 63 affected checks, native/profile/type/docs/baseline
checks and the production export. Twenty-eight clean browser captures had
no errors and both normal one-cell crawls committed their saved endpoints.
Selected support and recovery frames were compared with the current unarmed
prone sprites. The decoded track/manifest preservation proof passed again
against the exact clean source.

## Stable timber gable ventilation increment

The stable's broad timber triangle and six physical slats now follow the
current sprite span and actual pitched roof height. Authored slabs, terraces,
usable overlapping roof cells and room cutaways omit the pitched feature.
The [stable ventilation review](../art/stable-ventilation-3d-review-2026-10-07.md)
records the retained frame and remaining separate material work.

The final clean cut passed 75 affected checks, type/docs/baseline checks and
the production export. Eighteen clean original/slab browser views had no errors.
The front was compared with the current direct sprite; selected original and
slab exterior/interior frames were visually inspected.

## Next increments and acceptance limits

The low-ceiling headwear limit, broader posture bank, braking steps and the
remaining paired melee actions still need review. The broader published bank
audit also found floor penetration in sideways steps, prone motion and lance
locomotion; native boot grounding remains under correction. Warehouse buttresses and the posta porch remain under source comparison. The
[character review](../../assets/source/characters-3d/REVIEW.md) records the
accepted standing reference and the retained motion bank separately.

The inspected sprites provide anatomy, clothing, grips and silhouette targets;
the supplied tactical references provide density and room-readability targets.
Passing geometry and loading checks does not certify final visual polish. This
record is an incremental acceptance report, not a declaration that the full 3D
or gameplay objective is complete.

## Authored architecture paint

The source wall images and encoded paint formulas now apply to all fourteen compiled templates. Main-wall and solid-volume roles have distinct source overlays before native vertex and physical lighting. The clean source passes 87 affected architecture checks, type checking, documentation/baseline audits and the static build (`0bd513889feb`). Its 84 ordinary browser catalogue views pass without browser errors. The posta, barracks, house, warehouse and depot captures were visually compared with the current sprites. Geometry, openings, metric UVs, disclosure, roofs, props and unpainted legacy materials are retained. Warehouse support paint and house entrance details remain separate work; this is bounded material acceptance. See [the detailed review](../art/authored-architecture-finish-3d-review-2026-10-07.md).

## Warehouse support paint

The stone warehouse buttress now retains the source body and separate warm-foot palettes with their 60% volume overlays before normal 3D lighting. The closed wedge, pale coping, metre UVs and cell containment remain unchanged. The clean cut passes 34 affected checks, type checking, documentation/baseline audits, the build (`6a24a3a8992f`) and twelve browser views without errors. The visible 0° and 90° supports were compared with the current sprite. See [the support paint review](../art/warehouse-volume-finish-3d-review-2026-10-07.md).

## Green window shutters

Authored shutters now occupy the actual aperture with the current sprite’s paired green panels, dark borders, pale rails and central gap. Both physical faces are visible rather than buried in the masonry jamb. The source retains window flags, glazing, opening dimensions, collision, disclosure and breaches. The clean cut passes 64 affected checks, type checking, documentation/baseline audits, the build (`94aeb2d266c3`) and 24 house/farmhouse browser views without errors. The visible exteriors and house interior were compared with the current sprites. See [the shutter review](../art/shutter-window-3d-review-2026-10-07.md).

## Supported house placement

Authored houses with intact front corners now use one centred physical frame for their walls, roof, door crossing and chimney. Ground floor returns keep the room finish and measured hatch clipping. Corner openings, unsupported front corners and unpainted legacy houses retain their original frame. The clean source passes 73 affected checks, type checking, documentation/baseline audits and the build (`5dd99033b0f1`). Its 24 completed original/slab/accessible-roof browser views have no browser errors; an initial cold navigation timeout was retried successfully. The source house piers and hood remain the next cut. See [the placement review](../art/house-shell-placement-3d-review-2026-10-07.md).

## House front piers and hood

The house now has the current source’s two supported corner piers, warm stone feet, separate pale coping and shallow timber door hood. Physical dimensions, cell containment, standing doorway clearance and real roof/upper-route bounds are checked. The clean source passes 72 affected architecture checks, type checking, documentation/baseline audits and the build (`d885995adab9`). Its thirty ordinary and closer browser views pass without errors; the entrance, exteriors and disclosed interior were compared with the current sprite. See [the house facade review](../art/house-facade-3d-review-2026-10-07.md).

## Standing unarmed sideways support

The four standing unarmed sideways clips now retain a supporting boot and clear the complete footwear throughout the loop. Stable native knee direction, forefoot roll and recovery are checked without stretching the limbs. All 332 other clips and 302 non-leg selected channels per anatomy, native durations, pace and the profile remain exact. The clean source passes 97 affected checks, native/profile/type/docs/baseline verification and the build (`6e151ad105fa`). Four ordinary two-cell routes save their destinations; all 68 browser captures pass without errors. Selected frames were compared with the current male/female walking sheets. See [the detailed review](../art/standing-unarmed-sideways-support-3d-review-2026-10-07.md) for contact residuals and the separate test fixture correction.

## Supported stable placement

The stable wall, actual door crossing, pitched roof, gables and ventilation now share one centred frame when both front corners remain intact. Edited corners and unpainted legacy selection retain the original shell. The clean source passes 61 affected checks, type/docs/baseline verification and the build (`fb3936990e45`). Thirty ordinary and closer original/slab/accessible-roof browser views pass without errors. Selected views were compared with the current stable sprite. The source-sized timber frame remains the next cut. See [the placement review](../art/stable-shell-placement-3d-review-2026-10-07.md).

## Exposed stable timber frame

The stable now has supported source-sized front posts, diagonal ties and a continuous timber header. Door, window and edited-support crossings remain clear; short roofs and usable upper routes omit conflicting features. The clean source passes 65 affected checks, type/docs/baseline verification and the build (`922e40531573`). Thirty original/slab/accessible-roof and closer browser views pass without errors. The front, side, slab and interior were compared with the current stable sprite and the placement-only cut. See [the timber review](../art/stable-timber-frame-3d-review-2026-10-07.md).

## Supported farmhouse placement

The farmhouse wall shell, real doorway, hip roof, gallery planes and chimney supports now share centred coordinates when both front corners remain intact. Corner opening edits and unpainted legacy selection retain their original clipped shell. The clean source passes 69 affected checks, type/docs/baseline verification and the build (`ea6e054cf232`). Thirty ordinary and closer original/slab/accessible-roof views pass without browser errors. Selected views were compared with the current farmhouse sprite; exposed gallery details remain the next cut. See [the placement review](../art/farmhouse-shell-placement-3d-review-2026-10-07.md).

## Whole-cycle sabre wrist support

The sabre contact helper now checks complete native wrist and sole paths before admitting a supported strike. Forty pairings and 9,640 independently rendered samples have zero requested wrist clamp or contact gap. Fifty affected checks, type/docs/baseline verification, the build (`0ade92e9548f`) and eighteen ordinary browser captures pass; the paid action spends 3.5 PA once, deals 42 damage once and retains its saved cell without browser errors. Selected frames were compared with both current strike sheets. The pinned thirteen-actor idle-blend replay also clears the backhand and hilt wrists. Cold fitting cost, the native guard's elevated right boot and a separate first-frame scene-order discontinuity remain recorded limits. See [the detailed review](../art/supported-melee-3d-review-2026-10-07.md).

## Current target frame order

The scene now binds every current actor identity and visibility before evaluating contact. Native target bodies tick before contact actors, with one tick per active actor. The strict resolver still rejects unavailable or undisclosed models. The clean source passes 41 focused checks, type/docs/baseline verification, the build (`1cb70509cc9d`) and eighteen ordinary paid sabre captures without errors. The finite action retains its AP, damage and saved cell. Diagonal paid-facing transitions and moving target drift remain recorded follow-ups. See [the frame-order review](../art/scene-contact-frame-order-review-2026-10-07.md).

## Exposed farmhouse gallery

The farmhouse gallery now has the source front and return posts, warm stone feet, supported ties and shallow beams. Its joined corner retains one post and one roof cap, with overlapping beam faces removed. The source passes 73 affected checks, type/docs/baseline verification and the build (`3652c1aed03a`). Thirty ordinary and closer original/slab/accessible-roof browser views pass without errors. Selected exterior, entrance, interior and roof views were compared with the current sprite. See [the gallery review](../art/farmhouse-gallery-exposure-3d-review-2026-10-07.md).

## Standing rifle sideways support

Four standing rifle left/right clips now retain supported complete footwear through their native loops. All 332 other clips and 302 non-leg selected channels per anatomy, native clocks, pace, dimensions and earlier unarmed corrections remain exact. The source passes 26 affected checks, native/profile/type/docs/baseline verification and the build (`5e49d10010e7`). Four normal held-rifle routes save their cells; all 68 captures pass without errors. Selected frames were compared with both current walking sheets. See [the rifle movement review](../art/standing-rifle-sideways-support-3d-review-2026-10-07.md).

## Supported parish placement

The supported authored church walls, gables, roof, openings and disclosed floor returns now share centred coordinates. Tower compensation keeps its actual reserved/compact foundations; edited corners and unpainted legacy shells retain the original frame. The source passes 57 affected checks, type/docs/baseline verification and the build (`4b90ee754a77`). Thirty original/slab/accessible-roof and closer browser views pass without errors. Selected exteriors, entrance, interior and roof routes were compared with the current parish sprite. Source-sized nave wedges and facade details remain separate cuts. See [the placement review](../art/church-shell-placement-3d-review-2026-10-07.md).

## Remaining standing equipment sideways support

Sixteen short-gun, sabre, knife and lance sideways loops now retain complete supported boots for both anatomies and directions. The named transplant preserves all 326 other clips and 1,208 non-leg channels per anatomy, earlier unarmed/rifle support, native dimensions, clocks and pace. Forty-two affected checks, native/profile/type/docs/baseline verification and the clean build (`afbb49d94305`) pass. All sixteen normal owned-equipment routes save their destinations; 272 clean source-pinned captures have no browser errors. Selected frames were compared with both current walking sheets. Actual runtime start/stop intersections remain measured and explicit; this increment accepts loops only. See [the equipment movement review](../art/standing-equipment-sideways-support-3d-review-2026-10-07.md).

## Paid sabre facing and phase continuity

Diagonal standing sabre preparation now turns toward the admitted current target while retaining a supported rear boot; contact keeps the already admitted body/foot recipe. The finite endpoint fix preserves complete native path admission. All 62 affected checks, type/docs/baseline checks and the clean build (`16d1ba388b52`) pass. Independent replay covers 184 paid actions, eight headings and 368 admissions with bounded actual Root/sole handoffs. Both ordinary diagonal browser routes retain their paid cells, 3.5 PA strike cost and one 42-damage result; 42 source-pinned captures have no errors. First-fit cost, current target breathing drift and broader body/weapon polish remain explicit. See [the facing review](../art/paid-melee-facing-3d-review-2026-10-07.md).

## Supported chapel placement

The authored chapel roof, walls, door, floor returns and existing bell gable now share centred coordinates when the front supports remain intact. Edited corners and unpainted legacy shells retain their clipped placement. All 57 affected checks, type/docs/baseline checks and the clean build (`fb1e33a36d4c`) pass. Thirty ordinary and closer original/slab/accessible-roof views pass without browser errors and were compared with the current chapel sprite. The source front piers remain a separate detail cut. See [the placement review](../art/chapel-shell-placement-3d-review-2026-10-07.md).

## Exposed chapel front piers

The chapel now has its source-sized front shafts, separate warm stone feet and capitals. All four rotations retain actual corner supports, the standing door and real upper routes. The source passes 56 affected checks, type/docs/baseline checks and the clean build (`4a2d7c8a2e8a`). Thirty ordinary and closer original/slab/accessible-roof browser views pass without errors and were compared with the current sprite. See [the front-pier review](../art/chapel-front-piers-3d-review-2026-10-07.md).

## Parish tower warm stone base

The parish tower now has the source warm stone base and retained 67.82 cm height on its actual supported foundation. The upper body joins its top without overlapping planes. All 55 affected checks, type/docs/baseline checks and the clean build (`0031975cb7ef`) pass. Thirty ordinary and closer original/slab/accessible-roof views pass without browser errors and were compared with the current sprite. See [the tower-base review](../art/church-tower-stone-base-3d-review-2026-10-07.md).

## Closed and readable church nave supports

Authored churches now have the current sprite's closed sloped nave supports, separate warm stone feet and measured local face borders. Both actual side walls retain stable physical anchors across rotation. The final combined source passes 63 affected geometry checks, type/docs/baseline checks and export `fa0709314bb2`. Thirty original/slab/accessible-roof/close views and six final combined views pass without browser errors and were compared with the current parish sprite. Edited supports, standing openings, upper routes and normal cutaways remain covered. The 90° flat-source anchor difference is a declared physical adaptation. See [the nave review](../art/church-nave-supports-3d-review-2026-10-07.md) and [source edges](../art/church-nave-edge-separation-3d-review-2026-10-07.md).

## Exposed parish front piers

The parish front corners now carry the current source-sized plaster shafts, separate warm stone feet and projecting capitals. Actual supports, compact/reserved tower foundations, standing openings, edited-corner fallback and accessible roofs remain covered through all rotations. All 59 affected checks, type/docs/baseline checks and export `f8931734fc11` pass. Thirty original/slab/accessible-roof/close browser views pass without errors and were compared with the current parish sprite. See [the front-pier review](../art/church-front-piers-3d-review-2026-10-07.md).

## Supported shop forge and depot shells

Authored shop, forge and depot roofs, walls, standing openings and floor returns now share centred support coordinates when both front corners are intact. Depot piers and its loft follow the same measured frame. Edited corners and unpainted legacy shells retain their existing placement. All 53 affected checks, type/docs/baseline checks and export `f615a93d1dbb` pass. Ninety original/slab/accessible-roof/close views and eighteen final combined views pass without browser errors; selected entrances, exteriors and interiors were compared with the three current sprites. Porch frames remain the next separate source detail. See [the shell review](../art/work-porch-shell-placement-3d-review-2026-10-07.md).

## Current parish arched bars

Authored church and explicitly arched chapel panes now use the current sprite's three pale bars, measured insets and transverse stroke. Default small chapel windows and other saved styles retain their existing helper. All 52 affected checks, type/docs/baseline checks and export `790c382a3b61` pass. Sixty actual original/slab/accessible-roof/close views pass without browser errors; selected exterior/interior church bars and the ordinary chapel entrance were compared with the current sprites. The publication bridge preserves the actual capture source and selected file hashes. See [the grille review](../art/parish-arched-window-bars-3d-review-2026-10-07.md).

## Native standing rifle guard support

The native standing rifle guard and initial/final stock-strike endpoints now keep both complete boots level at the 2 mm floor. Eight lower rotation tracks in two clips per anatomy change; all 332 other clips, 151 non-leg channels per selected clip, native rigs/meshes/skins and clocks remain exact. Twelve complete-boot/runtime-blend checks, native/profile/type/docs/baseline checks and final export `117224602904` pass. Four ordinary owned-rifle movement routes and both cardinal paid stock strikes pass in 114 source-pinned captures without browser errors. Each strike spends 4 PA, commits 18 damage once and retains ammunition. The same actor/native hashes remain exact after the parish merge. Sampled acceleration corners, sideways transitions, diagonal rifle turns and complete target contact remain open. See [the guard review](../art/standing-rifle-guard-support-3d-review-2026-10-07.md).

## Current shop forge and depot porch frames

Authored shop and forge porches now expose their source timber posts, paired ties and shallow roof planes; depot loading frames retain their distinct three posts, warm stone feet and broad header. Actual supports, standing doors, edited corners, saved roofs and normal cutaways remain covered. All fifty-four combined affected checks, type/docs/baseline checks and export `2bb2077f2c1a` pass. Ninety actual original/slab/accessible-roof/close views pass without browser errors and were compared with the three current sprites. The source receipt and unchanged-file publication bridge retain the actual capture commit. See [the porch review](../art/source-work-porches-3d-review-2026-10-07.md).

## Current depot stone pier volumes

Authored depot piers now retain the current source's rectangular warm stone feet and capitals around their existing supported shafts. Legacy and edited-corner fallbacks, real openings, saved finishes and upper routes remain covered. All fifty-four combined affected checks, type/docs/baseline checks and export `6c318168bf4c` pass. Thirty source-pinned original/slab/accessible-roof/close views and six final combined porch-and-pier views pass without browser errors. Selected views were compared with the current depot sprite. See [the pier review](../art/depot-source-piers-3d-review-2026-10-07.md).

## Standing lance idle boot support

Both standing lance idle clips now support complete native boots while retaining all other clips, clocks, upper contact and dimensions. Fourteen affected checks, native/profile/type/docs/baseline checks and export `5ba61ae9ed40` pass. All four ordinary owned and dismounted lance routes save their destinations; seventy-two accepted source-pinned captures have no browser errors. Selected guards and supported feet were compared with the current walking sheets. The corrected setup failure and actual source bridge remain explicit. This accepts native idle support only. See [the lance review](../art/standing-lance-idle-support-3d-review-2026-10-07.md).

## Current smithy brick chimney

The authored smithy now retains its source brick shaft, broad brick cap and inset dark flue on actual intact supports. Legacy chimneys, edited supports, saved finishes, room disclosure and upper routes remain covered. Fifty-one affected checks, type/docs/baseline checks and combined export `b0f73eb21870` pass. Thirty-four source-pinned browser views pass without errors; selected views were compared with the current sprite, including the full chimney close view. The capture source, unchanged publication bridge and initial loading retries are recorded. See [the chimney review](../art/smithy-source-chimney-3d-review-2026-10-07.md).
