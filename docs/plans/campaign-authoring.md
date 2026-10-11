# Campaign creation and sharing

Updated: 11 October 2026.

The owner will design campaigns and wants other people to design their own.
Campaign creation is the active studio work; community publishing and wider
mechanics remain future work. Version 0.1 records an earlier playable game and
does not include the studio.

[Campaign studio workflow](../authoring/campaign-studio.md) ·
[Studio acceptance and evidence](../evidence/campaign-studio-2026-10-10/README.md) ·
[Current separation checks](../verification/campaign-engine-separation-2026-10-10.md) ·
[Version 0.1 checkpoint](../verification/version-0.1.md) ·
[Story editor](../development/story-editor.md) ·
[Sector editor](../development/sector-editor.md)

## Existing foundation

The story editor already edits characters, equipment definitions, placement,
rules, chapters, dialogue, quest states and physical delivery/escort errands.
Campaigns pin validated content, and drafts support undo, import and export.
The [La ruta de las postas example](../development/example-post-campaign.md)
demonstrates an independent scenario in the existing world.

The current development branch separates the engine and installed campaign
folders. Local authors can scaffold, check and install a generic campaign using
the [campaign folder workflow](../development/campaign-authoring.md). The menu
can select multiple installed packages, with separate saves and editor drafts.
Only Granaderos ships in the repository. This local workflow does not add a
community catalogue or certify a finished campaign.

The `/studio` website connects the content, world, map, building, presentation
and resource tools through one project. Embedded map edits update the project
directly. A valid project exports an installable ZIP with its referenced
documents and actual resource files; separate manual map exports are not
required. The studio uses the same package validators as the folder workflow.
Its final visible acceptance status is recorded in the linked evidence.

Current package authoring includes supported geography, factions, opposition,
calendar events, role bindings, chapters and resource definitions. Authors can
create, import, edit, validate and download these definitions without changing
engine code. Actual character, building, weapon and campaign previews use the
selected project. Browser project storage remains separate from game saves.

## Planned capabilities

| Area | Future work |
| --- | --- |
| Wider mechanics | Add new diplomacy, event effects, rules and renderer contracts beyond the currently admitted package format. |
| Story scenes | Author markers, arrival triggers, sequences with several actors, interruptions and saved continuation. |
| World and personnel | Connect role successors, resident belongings and wider quest consequences without duplicating identities or equipment. |
| Community publishing | Host a catalogue, publish campaigns, manage versions and provide discovery and review tools. Current browser export prepares a local package. |
| Distribution and updates | Let players acquire and update hosted campaigns while retaining the exact content and resources required by saved games. Local installed-package selection and separate saves already exist. |

Implementation should use small changes with visible controls, finite resource
accounting and save/reload checks. The longer
[content-system design](game-content-system.md) provides proposals; its full scope
is not delivered merely because a related editor control exists.

## Acceptance for the future community platform

Use the studio's valid package output as the input to distribution. A second
person must be able to acquire the hosted campaign and play its real battles,
objectives, defeat and victory paths, then save and continue. Test missing
assets, unsupported versions, invalid references and campaign updates without
overwriting an existing campaign's pinned content. The
[studio plan](campaign-studio.md) defines local authoring acceptance separately.

Equipment shops remain deferred. Modern and science-fiction equipment remain
outside the historical game's scope. This plan does not reinstate removed
material-production or horse-care systems.
