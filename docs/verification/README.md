# Verification and current status

[Documentation index](../README.md)

Read the [published progress ledger](published-progress.md) first. It records
accepted features on GitHub `main`, approved scope changes and open work.

## Published baseline

- [Formal implementation audit — 27 September](formal-audit-2026-09-27.md)
- [Machine-readable requirement register](requirements.json)

- [Published implementation and verification ledger](published-progress.md)
- [Authored world presence verification](character-presence.md)
- [Retiro opening verification](retiro-opening.md)
- [Civilian state verification](civilian-state.md)
- [Authored resident verification](authored-residents.md)
- [Death successor verification](death-successors.md)
- [Registered tactical order synchronization](tactical-order-sync.md)
- [Authored local contracts](local-contracts.md)
- [Authored dialogue choices](authored-dialogues.md)
- [Dialogue choice conditions](dialogue-conditions.md)
- [Dialogue payments and rewards](dialogue-payments.md)
- [Authored quest states and journal](authored-quests.md)
- [Automatic quest deadlines](quest-deadlines.md)
- [Required character survival](quest-survival.md)
- [Dialogue-triggered local meetings](dialogue-movements.md)
- [Arrival-gated dialogue and quest effects](meeting-arrivals.md)
- [Ending a local meeting](meeting-release.md)
- [Authored melee weapons](authored-blades.md)
- [Primary and secondary troop blade loadouts](force-blades.md)
- [Initial funds and cartridge allotments](campaign-supply-rules.md)
- [Starting territorial control and loyalty](starting-territory.md)
- [Configurable campaign headquarters](campaign-headquarters.md)
- [Import ports and saved delivery windows](import-supply-rules.md)
- [Authored campaign chapters and endings](campaign-story.md)
- [Independent campaign casts](campaign-cast.md)
- [Assigned strategic campaign roles](campaign-roles.md)
- [Authored foundry project and workshop](foundry-project.md)
- [Project conditions in chapters and dialogue](project-conditions.md)
- [Deceased contracts and saved continuation](contract-casualty-presence.md)
- [Military bodies and finite equipment on reentry](military-remains.md)
- [San Lorenzo settlement after exploration](post-victory-mission.md)
- [Fresh mixed and hired coastal opening routes](fresh-coastal-opening.md)
- [Fresh historical victory and saved continuation](fresh-historical-ending.md)
- [Fresh Cuyo preparation and late commander recruitment](fresh-cuyo-preparation.md)
- [Explicit loss of indispensable historical actors](historical-campaign-loss.md)
- [Essential-character loss with a full diary](civilian-loss-log.md)
- [Fresh northern continuation through Yatasto](fresh-northern-opening.md)
- [Character starting supplies](character-starting-supplies.md)
- [Character starting condition](character-starting-condition.md)
- [Saving authored cartridge allocations](authored-cartridge-save.md)
- [Independent post campaign](independent-post-campaign.md)
- [Strategic medical care](strategic-medical-care.md)
- [Local workshop service](local-workshop-service.md)
- [Explicit strategic rest](strategic-rest.md)
- [Authored care and rest rules](authored-care-rules.md)
- [Finite field first aid and persistent wounds](finite-first-aid.md)
- [Critical military condition and retained casualties](critical-military-condition.md)
- [Story editor](../development/story-editor.md)
- [Sector editor](../development/sector-editor.md)

The records below come from the separate development checkout unless stated
otherwise. Their test counts and implemented behavior are not acceptance of the
published game. [Workspace gameplay acceptance](gameplay-completion.md) records
that checkout's latest known failures. The [parity audit](ja2-parity-audit.md)
retains its detailed requirements; approved published scope changes still apply.

## Development-workspace acceptance and recent records

- [Gameplay completion work](gameplay-completion.md) *(workspace)*
- [Classic JA2 gameplay parity audit](ja2-parity-audit.md) *(workspace)*
- [Gameplay follow-up — 27 September 2026](gameplay-follow-up-2026-09-27.md) *(workspace)*
- [Campaign start, movement and performance — 27 September 2026](gameplay-and-campaign-performance-2026-09-27.md) *(workspace)*
- [Current worktree regression audit — 2026-09-26](current-worktree-regressions-2026-09-26.md) *(workspace)*
- [Main campaign integration audit — 2026-09-26](main-campaign-integration-2026-09-26.md) *(workspace)*
- [Equipment redesign acceptance and current progress](equipment-redesign-2026-09-26.md) *(workspace)*

## Bounded route and tactical records

These records describe their stated checkpoint. Later changes can alter their
results. Read their limits before using them as acceptance evidence.

- [Opening campaign with turning AP](opening-control.md) *(workspace)*
- [Northern campaign route verification](northern-route.md) *(workspace)*
- [Verified advance to the Mendoza foundry](mendoza-route.md) *(workspace)*
- [JA2 gameplay: live verification record](ja2-live-verification.md) *(workspace)*
- [Tactical simulation verification](tactical-verification.md)

[Raw evidence](../evidence/README.md) holds machine-readable results. [Archived
audits](../archive/README.md) retain earlier findings for traceability.

A rules test, prepared scene, save continuation or isolated checkout verifies
only that scope. A full campaign claim requires a complete route with real
resources, casualties and campaign settlement. Documentation link checks do not
establish gameplay correctness.
