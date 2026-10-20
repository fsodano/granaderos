# Create and install a local campaign

This guide describes the campaign implementation published in `main` through
[PR #334](https://github.com/fsodano/granaderos/pull/334). The historical `0.1` tag
retains its original checkpoint. Only `campaigns/granaderos/` is
installed in this repository. The engine can discover and select additional
campaign folders without adding a title or character to engine code.

The [verification record](../verification/campaign-engine-separation-2026-10-10.md)
records completed focused checks, the type check and the one-package static
export. The final broad regression run and browser refresh were stopped and
are incomplete. The commands below describe the author workflow; they do not
claim that a complete campaign or release gate has passed.

## Create a draft

Run these commands from the repository root after installing web dependencies:

```sh
npm run campaign:new -- my-campaign ./drafts/my-campaign
npm run campaign:check -- ./drafts/my-campaign
```

Use a new lower-case ID with letters, digits and hyphens. The destination folder
must have the same name as the ID. The command refuses to overwrite an existing
folder. It creates a small generic campaign with two connected localities,
tactical maps, one recruit, a local placeholder portrait, a tool definition,
a calendar and a chapter objective. It adds no installed campaign to the menu.

The scaffold is a starting point for authoring. Replace its placeholder art,
text, forces and day-two objective before distributing a campaign.

## Package files

```text
my-campaign/
  manifest.json
  content.json
  world.json
  presentation.json
  assets.json
  assets/
    guide.png
  maps/
    index.json
    camp.json
    watch-post.json
```

The manifest uses format `granaderos-campaign`, version `1`. Its `id`, `name`
and `revision` identify the installed package. The fields `content`, `world`,
`maps`, `presentation` and `assets` are relative JSON file paths. Use
`scenario: "generic-v1"` for an authored campaign. JSON packages cannot add
executable scenario code.

| File | Author data |
| --- | --- |
| `content.json` | Cast, equipment, contracts, placements, dialogue, quests, chapter objectives and initial rules |
| `world.json` | Localities, the shared 36 by 33 cell grid, districts, roads, cities, factions, geography, building styles and physical resources |
| `maps/index.json` | `maps` list with each map's `id` and relative `path` |
| `presentation.json` | Menu text and art, introduction, calendar, atlas labels, portrait choices and character creation text |
| `assets.json` | Version `1`, with an `assets` list of ID, relative path, SHA-256 and MIME type |

Map paths are relative to the map index folder. A map document's ID must match
its index entry. Keep stable character, quest, locality and map IDs when revising
a campaign. The checker reports invalid references and unsupported data.

Set `content.json`'s optional `rules.startingHour` to an integer from `0` to `23`
to choose the first day's starting time. An omitted value preserves midnight.
Granaderos starts at `9` (09:00). New contracts begin at the current time and
retain their full duration. Loading a save preserves its saved clock. Timed
events use absolute campaign hours and cannot precede `startingHour`.

For detailed cast, equipment, dialogue and objective controls, use the story
editor guide. Its historical examples describe the Granaderos package; a
generic package uses its own definitions and explicit settings. New generic
campaigns do not include the original ambient cast when
`includeOriginalResidents` is omitted. The story editor displays that effective
choice and preserves it explicitly when switching an existing package to
authored chapters.

The world can define `projection` with `minLongitude`, `maxLatitude`,
`longitudeScale` and `latitudeScale`. Places and geography use that projection.
The scaffold uses local coordinates and its own visible land outline.

World ownership still uses the engine IDs `patriot` and `royalist`. The campaign
can supply their display names. The tactical grid and supported mechanics are
shared engine contracts; the package does not define arbitrary code or a new
combat ruleset.

## Building styles and map layout

`world.buildings.types` defines styles for supported architecture kinds such
as `house`, `farmhouse`, `estancia`, `church`, `mansion`, `cabildo`, `pulperia`,
`warehouse` and `barracks`. Each type supplies a display `name`, `roof`
(`tile`, `thatch` or `terrace`), hexadecimal `wall` and `trim` colours, and
`height`. Supported boolean flags select existing exterior details:
`gallery` for farmhouse, `awning` for pulperia, `tower` for church,
`arcade` for cabildo, and `upper` for mansion. These details do not add
collision cells or playable floors. `world.buildings.footprints` supplies
each kind's width and height.

Tactical map buildings specify their supported `architecture`, position,
width, height, material, wall layout, openings and rooms. Finish fields select
the renderer's admitted `wallFinish`, `roofFinish`, `doorStyle` and
`windowStyle` choices. The sector editor exposes these choices and validates
the resulting geometry. The world's `expansion` data selects the building
kinds and counts used when generating cell scenes; its default building
selection must be nonempty. Selected campaign styles apply to generated
buildings as well as authored maps. Generic styles supply default wall and
trim pigments and visual height. Generated neighbourhood and district houses
use the selected roof before shared roof and slab generation. Explicit map
`roof`, `wallFinish` and `roofFinish` fields override these defaults. When a
map has metric roof slabs, their elevation determines the rendered wall
height. Saves pin selected styles; forged style or mode fields fail admission.

These fields configure shared renderer profiles, materials and archetypes.
The package format does not import external animated character or building
meshes. Arbitrary model formats and new architectural renderer code need
engine development.

## Images and character appearance

Put campaign images in `assets/`. Reference them as
`/campaigns/my-campaign/assets/<path>`, including nested folders when needed.
Do not copy the hosting prefix, such as `/granaderos`, into stored references.
The browser adds it when serving the package.

After changing local resources, update their recorded hashes and check again:

```sh
npm run campaign:assets -- ./drafts/my-campaign
npm run campaign:check -- ./drafts/my-campaign
```

The resource command supports PNG, JPEG, WebP and JSON metadata. It retains
existing resource IDs for unchanged paths. Linked files, outside-folder paths,
missing resources and mismatched hashes fail the check.

Configure the portrait chooser with `presentation.characterPortraits` entries:

```json
{
  "id": "guide-face",
  "name": "Guía",
  "src": "/campaigns/my-campaign/assets/guide.png",
  "gender": "woman",
  "role": "scout",
  "skinTone": "brown",
  "spriteAppearance": "woman-scout",
  "spriteSkinTone": "brown",
  "selectable": true
}
```

Without a configured list, a generic campaign derives choices from its cast.
An empty cast uses the neutral engine placeholder. Generic menus do not borrow
Granaderos portraits. Skin tones are `light`, `brown` and `dark`. Appearance
choices use the supported shared sprite families: `military`, `worker`,
`civilian-man`, `poncho-wearer`, `friar`, `woman-combatant` and `civilian-woman`.
Each family selects an existing renderer archetype. The stock campaign owns
its named character assignments; shared animation atlases, skin masks,
terrain, scenery and 3D building resources remain engine assets.

`presentation.officerCreation` can configure class names and local equipment,
question labels, choice names and creation text. Stable question and choice
IDs select the shared skill effects. This does not permit new executable
character rules. Generic campaigns have a neutral unarmed creation fallback.
A class can set `bladeFittingPattern: "india_socket"` when its local primary
weapon uses template `1800` and its blade uses template `1811`. New characters
then receive one identified, loose bayonet that fits that Brown Bess. Omitting
the field keeps the blade unmarked. Existing saved equipment does not change.

## Forces and timed events

Configure `oppositionEquipment` for `officer`, `line` and `veteran`, and
`militiaEquipment` for `green`, `regular` and `veteran`. Assign local weapon IDs
or `null`. The corresponding `oppositionBlades` and `militiaBlades` maps select
local secondary blades. Generic campaigns issue no weapon or blade when a
selection is omitted or `null`.

Optional `oppositionAppearance` and `militiaAppearance` maps use the same role
keys. Supply every role when adding either map. Each role contains exactly
`spriteAppearance` and `skinTone`, for example:

```json
{
  "oppositionAppearance": {
    "officer": {"spriteAppearance": "worker", "skinTone": "light"},
    "line": {"spriteAppearance": "worker", "skinTone": "brown"},
    "veteran": {"spriteAppearance": "woman-scout", "skinTone": "dark"}
  }
}
```

Use canonical supported sprite IDs. Generic forces without appearance data use
`worker` and `brown`; they do not receive the historical faction uniform.

Optional `campaignEvents` in content can change a quest or transfer treasury
funds at a whole campaign hour:

```json
{
  "campaignEvents": [
    {
      "id": "first-contribution",
      "atHour": 24,
      "conditions": [],
      "text": "El campamento recibe una contribución.",
      "effects": [{"type": "treasury", "operation": "receive", "amount": 50}]
    }
  ]
}
```

An event has exactly these five fields. IDs must be unique portable lowercase
IDs. There can be at most 100 events. `atHour` is an integer from 0 to 876000.
Conditions use the chapter condition schema, with at most six conditions and
no `meeting` condition. At most two effects are allowed, with no repeated effect
type. A treasury effect uses `pay` or `receive` and an integer amount from 1 to
1000000. A quest effect is `{ "type": "quest", "quest": "local-quest-id",
"status": "active" }`; status can also be `completed` or `failed`.

At the specified hour, all conditions and effect quotes must pass. An event
that cannot apply is permanently skipped. Applied events add their text to
the log. Saved receipts prevent a second reward. Same-hour events run in ID
order. Automatic quest expiry and death failures settle before same-hour
event conditions. Hour-zero events run after campaign initialization and their
effects can immediately advance a chapter. Events cannot move
actors or execute code.

The optional `world.enemyStrategy` configures generic invasions. It has
`version: 1` and a `theaters` object. Each theater record contains `legHours`
(1–240), `reserve` (0–100000), `raidEveryHours` (1–876000), and `axis`, a list
of unique connected locality IDs in that theater. The axis must exclude the
effective campaign headquarters; `content.headquarters` overrides
`world.defaultHeadquarters`.
At cadence multiples, a raid
targets the first player-owned locality on the axis other than headquarters.
Shared arrival and defense rules apply. Without this policy, a generic campaign
has no scheduled invasions.

## Install and test

After a draft passes the check, copy its complete folder into
`campaigns/my-campaign/`. Its folder name must match `manifest.id`. Start
`npm run dev`, then select it in the menu. The development server and production
build generate the registry from installed manifests. Do not maintain a second
handwritten registry. The production build validates JSON and resource hashes
before copying package data and assets.

The [story editor](story-editor.md) and [sector editor](sector-editor.md) open the selected package through
`?campaign=my-campaign`. They use separate draft keys for each installed
campaign. Story edits create an authored copy; the launch strips its installed
origin and gives its save slot a content hash. Installed campaign saves use the
campaign ID. Saved games pin their original package, including maps and visual
references. Changing the installed revision does not rewrite a saved game. Before loading
an installed package, continuing a save, or importing it, the browser checks the
resource bytes against the pinned SHA-256 values. Missing or changed resources
stop the operation and identify the file and required campaign revision.

The sector editor's playtest uses that selected package's cast, equipment,
faction labels, appearance and regional weather. It does not change the package
or the installed campaign save. A geometry-only legacy playtest called without
campaign context retains its compatibility defaults.

The story editor exports content JSON. The sector editor exports individual
map documents. Put each exported file into the matching package and check the
folder again. These editors do not write the entire package directory or publish
a campaign to other people.

Verify recruitment, travel, tactical entry, dialogue, objectives and saved
continuation for the actual authored campaign. A successful package check or
build establishes file and schema validity; it does not establish balance,
historical accuracy, complete route acceptance or release quality.

## Share a folder

Distribute the complete folder, including local assets and all referenced maps.
The recipient checks it and installs it under `campaigns/<id>/` in a compatible
engine checkout, then rebuilds or starts the development server. Browser save
files transfer progress; they are not an installation package or an asset archive.

There is no community catalogue, browser package installer or publication
service in this implementation. See the [future authoring plan](../plans/campaign-authoring.md)
for the remaining product work, and the [engine separation plan](../plans/campaign-engine-separation.md)
for implementation checks.
