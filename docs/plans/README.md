# Implementation plans

This index lists the accepted architecture contracts and feature implementation plans in `docs/plans/`.

[Documentation index](../README.md)

## Accepted architecture

Read both accepted documents before architecture work or changes to domain terminology.
The [repository instructions](../../AGENTS.md) require their use.

| Document | Purpose |
| --- | --- |
| [Domain architecture and implementation plan](accepted/domain-architecture.md) | Domain model, use cases, repositories, world behavior, package boundaries, and implementation gates |
| [Ubiquitous language](accepted/ubiquitous-language.md) | Canonical terms, ownership, naming rules, and consistency checks |

Accepted plans define required architecture and behavior. Source and dated
verification establish implementation. The [architecture guide](../architecture/README.md)
explains the current code. The [repository map](../development/repository-layout.md)
shows where its applications, packages, content, and tools live.

## Feature plans

These documents record proposals, implementation steps and delivered editor scope.
Some steps have later implementation notes. A plan is not evidence that its
requirements are complete. Entries marked *(workspace)* are development-workspace
records written against a separate development checkout rather than the published
`main` branch (see [version 0.1 status](../verification/version-0.1.md)).
Check the [version 0.1 status](../verification/version-0.1.md),
[feature evidence](../verification/README.md) and each record's source and date
before selecting work.

- [Complete campaign authoring studio](campaign-studio.md) — supported package authoring acceptance, exact evidence and publication status.
- [Editor experience](editor-experience.md) — delivered bounded UX/DX for Studio and standalone editors; current evidence and broader preview limits.
- [Campaign creation and community sharing](campaign-authoring.md) — current studio
  package authoring, with community publishing and wider mechanics kept as future work.
- [Campaign folders and shared engine](campaign-engine-separation.md) — separation between the shared engine and installed campaign folders.
- [Core campaign: manual testing handoff](core-campaign-v0.1.md) — dated handoff record for manual campaign testing, local validation, and known failures.
- [Required equipment implementation plan](EQUIPMENT-IMPLEMENTATION-PLAN.md) — proposed stages for period equipment, containers, masses, and corpse loot.
- [Removable bayonet fitting plan — I06](bayonet-fitting-plan.md) *(workspace)* — proposed equipment lifecycle for compatible bayonet fittings ([parity audit](../verification/ja2-parity-audit.md) row I06).
- [Game content system and editor](game-content-system.md) *(workspace)* — proposed separation of engine rulesets, campaign content, and editor workflows.
- [Sector builder implementation plan](sector-builder.md) — web sector editor design and command pipeline (wall-cell geometry superseded by [Walls between cells](wall-edges.md)).
- [Walls between cells](wall-edges.md) — shared cell-edge walls, doors, and windows replacing full-cell walls.
- [Tactical reference graphics](tactical-reference-graphics.md) *(workspace)* — 18-piece visual improvement plan and PR records for characters, terrain, and furniture.
- [T09 campaign transaction plan](tactical-exit-campaign-plan.md) *(workspace)* — proposed campaign return transaction for physical retreat and sector exit ([parity audit](../verification/ja2-parity-audit.md) row T09).
- [T09: physical retreat and sector exit](tactical-exit-plan.md) *(workspace)* — proposed tactical boundary departure and participant accounting ([parity audit](../verification/ja2-parity-audit.md) row T09).

Related implementation notes: [weapon attachment slots](../gameplay/equipment/attachment-slots.md),
[tactical exit layouts](../gameplay/tactical/tactical-exit-layouts.md), and
equipment acceptance.

The root [tactical HUD design contract](../../DESIGN.md) records the original
bottom-strip layout and class names.
