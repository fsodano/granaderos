# Granaderos campaign

This is the only installed campaign. Its manifest selects the historical
scenario and its JSON files define the world, tactical maps, cast, inventory,
presentation and local image resources. The build creates the campaign registry
from installed manifests; an example file in `web/public/campaigns/` is not an
installed campaign.

The campaign owns the portraits, avatar choices and historical illustrations
in `assets/`. References use `/campaigns/granaderos/assets/<filename>`.
`assets.json` records each resource's path, type and SHA-256. The browser adds
the configured hosting prefix; the stored content references remain portable.
Production images have one serving location. `assets/source/`, `assets/prompts/`
and `assets/web/` contain generation sources and receipts, not a second served
campaign.

The engine retains shared terrain, scenery, building materials, illustrated
animation atlases, skin masks and 3D models. Campaign character records select
their appearance and skin tone. These selections do not change simulation
rules. Named historical appearance and skin assignments live in this campaign's
catalogue. The portrait menu has one source in
`presentation.json` under `characterPortraits`. Generic campaigns can provide
the same list, or use portraits from their character records. An empty generic
cast uses the neutral engine placeholder. The current renderer supports the
shared appearance archetypes and the `light`, `brown`, and `dark` skin tones.

The portrait build tools write into this asset folder and refresh `assets.json`.
`tools/campaign-export.mjs` checks the manifest and resource hashes before
export. Campaign JSON cannot provide executable engine code.

The trusted historical scenario also owns the named mission panels in `ui/`.
The browser registers these panels for that scenario. Generic campaign packages
use the common campaign interface and their authored story objectives.

The editors load the selected campaign through `?campaign=granaderos`. Local
story and sector drafts use separate keys for each installed campaign. A story
editor launch is an authored copy: its save key includes its content hash and
does not replace the installed campaign save.
