# Verification and current status

[Documentation index](../README.md)

This folder keeps the game's status checkpoints and its classic Jagged Alliance 2
(JA2) parity baseline. Each record states its own date, source and limits; a
passing record is a snapshot for that source, not proof about a later version.
[Version 0.1 status](version-0.1.md) records the tagged checkpoint, and the
[shipping campaign plan](../plans/core-campaign-v0.1.md) records the current
acceptance work. Read [which document governs status](../README.md#which-document-governs-status)
before drawing completion claims.

The dated per-feature verification receipts and the machine-readable requirement
register that this folder previously held were removed in November 2026. The
[parity audit](ja2-parity-audit.md) retains the full requirement rows, their
sources and their acceptance conditions; earlier receipts and register rows
remain available in Git history.

## Status checkpoints

- [Version 0.1 scope and validation](version-0.1.md) — the tagged version's
  scope, checks and known limits.
- [Latest build consolidation](latest-build-consolidation.md) — the PR #139
  publication and its 1 October checks.
- [Alpha service-equipment return](alpha-service-equipment-return-2026-10-01.md)
  — the dated candidate and its browser/save checks.
- [Formal audit, 27 September](formal-audit-2026-09-27.md) — the historical
  cross-branch audit and its evidence limits.

## Architecture and layout acceptance

- [Domain architecture, 28 October](domain-architecture-2026-10-28.md) — the
  implemented domain, use-case, editor, persistence and browser checks of the
  0.2.0 reorganization, with explicit limits.
- [Repository layout, 28 October](repository-layout-2026-10-28.md) — source
  navigation and directory responsibilities of the same reorganization.
- [Engine and campaign separation, 10 October](campaign-engine-separation-2026-10-10.md)
  — the engine/content boundary record.

## Classic JA2 parity baseline

- [Classic JA2 gameplay parity audit](ja2-parity-audit.md) — the 87 requirement
  rows with their G/M/W/V sources, status meanings, and per-row evidence and
  remaining work.
- [Live verification record](ja2-live-verification.md) — the dated live browser
  checks cited by the audit rows.
- [Complete video requirement map, 3 October](ja2-video-review-2026-10-03.md) —
  the narrated-video requirements and their sampled footage evidence.
- [Gameplay overview review, 30 September](ja2-gameplay-review-2026-09-30.md) —
  the Wikipedia overview mapped to the audit rows, with open design questions.
- [Tactical verification](tactical-verification.md) — project context for the
  tactical checks cited by the audit's sources.

## Workspace and feature acceptance

- [Development-workspace acceptance](gameplay-completion.md) — the dated
  results of the separate advanced-gameplay checkout.
- [Persistent campaign ammunition](strategic-ammunition-custody.md) —
  ammunition ownership across sector visits and its limits.
- [Shared wall edges](wall-edges.md) — the current cell-edge wall, door and
  window format, its checks and later campaign limits.

Raw measurement archives linked from these records live under `evidence/`.
Keep new verification notes with an explicit source, date, tested scope and
limits; keep raw measurements in `evidence/` and link them from the record.
