# Implementation plans

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
requirements are complete. Check the [version 0.1 status](../verification/version-0.1.md),
[feature evidence](../verification/README.md) and each record's source and date
before selecting work.

- [Complete campaign authoring studio](campaign-studio.md) — supported package authoring acceptance, exact evidence and publication status.

- [Editor experience](editor-experience.md) — delivered bounded UX/DX for Studio and standalone editors; current evidence and broader preview limits.

- [Campaign creation and community sharing](campaign-authoring.md) — current studio
  package authoring, with community publishing and wider mechanics kept as future work.

- [Required equipment implementation plan](EQUIPMENT-IMPLEMENTATION-PLAN.md)
- [Removable bayonet fitting plan — I06](bayonet-fitting-plan.md) *(workspace)*
- [Game content system and editor](game-content-system.md) *(workspace)*
- [Sector builder implementation plan](sector-builder.md)
- [Tactical reference graphics](tactical-reference-graphics.md) *(workspace)*
- [T09 campaign transaction plan](tactical-exit-campaign-plan.md) *(workspace)*
- [T09: physical retreat and sector exit](tactical-exit-plan.md) *(workspace)*

Related implementation notes: [weapon attachment slots](../gameplay/equipment/attachment-slots.md),
[tactical exit layouts](../gameplay/tactical/tactical-exit-layouts.md), and
[equipment acceptance](../verification/equipment-redesign-2026-09-26.md).

The root [tactical HUD design contract](../../DESIGN.md) records the original
bottom-strip layout and class names.
