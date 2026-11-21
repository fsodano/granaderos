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

Accepted plans define required architecture and behavior. Source defines the
current code. The [architecture guide](../architecture/README.md) explains it.
The [repository map](../development/repository-layout.md) shows where its
applications, packages, content, and tools live.

## Migration plans

These documents record an in-progress migration of the source onto the
accepted architecture.

| Document | Purpose |
| --- | --- |
| [Clean architecture migration](migration/overview.md) | Orientation survey of the source and the gaps it found |
| [Clean architecture migration plan](migration/plan.md) | Slice sequence, branch flow, version policy, and verification strategy |
| [Migration slice notes](migration/slices/README.md) | Per-slice intent, files, tests, and verification |

## Feature plans

These documents record proposals and implementation steps. Some steps have later
notes. A plan is not a statement of current behavior.

- [Complete campaign authoring studio](campaign-studio.md) — supported package authoring and publication boundaries.
- [Editor experience](editor-experience.md) — bounded UX/DX for Studio and standalone editors, and the preview limits.
- [Campaign creation and community sharing](campaign-authoring.md) — studio
  package authoring, with community publishing and wider mechanics kept as future work.
- [Campaign folders and shared engine](campaign-engine-separation.md) — separation between the shared engine and installed campaign folders.
- [Required equipment implementation plan](EQUIPMENT-IMPLEMENTATION-PLAN.md) — proposed stages for period equipment, containers, masses, and corpse loot.
- [Removable bayonet fitting plan — I06](bayonet-fitting-plan.md) — proposed equipment lifecycle for compatible bayonet fittings ([parity requirements](../requirements/ja2-parity.md#inventory-transfers-and-equipment) row I06).
- [Game content system and editor](game-content-system.md) — proposed separation of engine rulesets, campaign content, and editor workflows.
- [Sector builder implementation plan](sector-builder.md) — web sector editor design and command pipeline (wall-cell geometry superseded by [Walls between cells](wall-edges.md)).
- [Walls between cells](wall-edges.md) — shared cell-edge walls, doors, and windows replacing full-cell walls.
- [Tactical reference graphics](tactical-reference-graphics.md) — 18-piece visual improvement plan for characters, terrain, and furniture.
- [T09 campaign transaction plan](tactical-exit-campaign-plan.md) — proposed campaign return transaction for physical retreat and sector exit ([parity requirements](../requirements/ja2-parity.md) row T09).
- [T09: physical retreat and sector exit](tactical-exit-plan.md) — proposed tactical boundary departure and participant accounting ([parity requirements](../requirements/ja2-parity.md) row T09).

Related notes: [weapon attachment slots](../gameplay/equipment/attachment-slots.md)
and [tactical exit layouts](../gameplay/tactical/tactical-exit-layouts.md).

The root [tactical HUD design contract](../../DESIGN.md) records the original
bottom-strip layout and class names.
