# Campaign creation and sharing — future work

Updated: 10 October 2026.

The owner will design campaigns and wants other people to design their own.
This is the future product direction. Version 0.1 records the current playable
game; it does not add or claim a complete campaign creator platform.

[Current version](../verification/version-0.1.md) ·
[Story editor](../development/story-editor.md) ·
[Sector editor](../development/sector-editor.md)

## Existing foundation

The story editor already edits characters, equipment definitions, placement,
rules, chapters, dialogue, quest states and physical delivery/escort errands.
Campaigns pin validated content, and drafts support undo, import and export.
The [La ruta de las postas example](../development/example-post-campaign.md)
demonstrates an independent scenario in the existing world.

The sector editor authors tactical maps, buildings and shared wall edges.
These tools provide useful starting points. They do not yet form a complete
workflow for publishing arbitrary campaigns to other players.

## Planned capabilities

| Area | Future work |
| --- | --- |
| Campaign composition | Define geography, factions, opposition, diplomacy, calendar events and mission roles without editing game code. |
| Story scenes | Author markers, arrival triggers, sequences with several actors, interruptions and saved continuation. |
| World and personnel | Connect role successors, resident belongings and wider quest consequences without duplicating identities or equipment. |
| Packaging | Export a campaign with its required sectors, images and assets; validate dependencies and supported versions before launch. |
| Creator workflow | Provide a clear path to create, test, export, share, import and update a campaign. Explain invalid content with useful errors. |
| Player workflow | Select an imported campaign, see its identity and requirements, and keep its saves separate from other campaigns. |

Implementation should use small changes with visible controls, finite resource
accounting and save/reload checks. The longer
[content-system design](game-content-system.md) provides proposals; its full scope
is not delivered merely because a related editor control exists.

## Acceptance for the future platform

Create a new campaign through the public editors without engine edits. Export
its package and import it in a clean browser profile. A second person must be able
to play its real battles, objectives, defeat and victory paths, then save and
continue. Test missing assets, unsupported versions, invalid references and
campaign updates without overwriting an existing campaign's pinned content.

Equipment shops remain deferred. Modern and science-fiction equipment remain
outside the historical game's scope. This plan does not reinstate removed
material-production or horse-care systems.
