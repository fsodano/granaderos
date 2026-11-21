# Verification evidence

[Documentation index](../README.md)

This folder is the evidence workspace record index for saved dated acceptance workspaces, route snapshots and measured performance results. Every
record below belongs to its named source and date. [Version 0.1](../verification/version-0.1.md) is the current summary. References to an open PR or
pending publication describe that record's creation time, not current Git state.
A `*(workspace)*` label means a separate development checkout (development-workspace record), not published `main`.
Preserve the original measurements and failed outcomes. · [Verification records](../verification/README.md)

Filenames and report fields identify their checkpoints. The files preserve the recorded
results; they are not refreshed by a documentation update.

Read the linked verification note for the setup, scope and limitations before
using a result. Published acceptance is recorded in the
[version 0.1 status](../verification/version-0.1.md).

## Active campaign authoring website

- [Campaign studio acceptance](campaign-studio-2026-10-10/README.md): project, archive, resource and storage checks, final editor/CLI gate, production export and visible browser results with exact limits.

## Historical alpha local acceptance

- [Complete alpha local receipt](alpha-service-equipment-local-2026-10-01.json): final gates, actual full TAP totals and log hashes, shared build, copied browser/UI source relationship.
- [Compact executing-source delta](alpha-source-inputs-delta-2026-10-01.json): exact reconstruction over the immutable [PR #139](https://github.com/fsodano/granaderos/pull/139) manifest.
- [Bounded policy and limits](../verification/alpha-service-equipment-return-2026-10-01.md). These are local proof included in the alpha PR; no alpha CI or merge is asserted.

## Campaign and route records

- [Campaign routes with partial firearm loading](partial-reload-routes-2026-09-28.json) and verification scope.

- [Campaign routes with finite field aid](finite-first-aid-routes-2026-09-28.json) and verification scope.

- [Fresh historical victory](fresh-historical-ending-2026-09-28.json) and verification scope.

- [Fresh Cuyo preparation](fresh-cuyo-preparation-2026-09-28.json) and verification scope.

- [Fresh Mendoza campaign loss](historical-mendoza-loss-2026-09-28.json) and verification scope.

- [Fresh northern route data](fresh-northern-2026-09-28.json) and verification scope.

- [Fresh mixed/hired coastal route data](fresh-coastal-2026-09-28.json) and verification scope.

- [Formal audit evidence](formal-audit-2026-09-27/) and [scope/method](../verification/formal-audit-2026-09-27.md): three source manifests, complete logs, comparisons and reproduced failures.

- Current campaign and performance report *(workspace)*
- Latest gameplay follow-up *(workspace)*
- 26 September regression audit *(workspace)*
- Northern campaign route *(workspace)*
- Mendoza foundry route *(workspace)*

Dated JSON files in this folder retain the individual route and measurement
checkpoints referenced by these notes.

## Controlled performance comparisons

| Measurements | Interpretation |
| --- | --- |
| [Motion routes](motion-routes/benchmark.json) | [Animation route setup](../development/performance/tactical-motion-performance.md) |
| [Room visibility](room-visibility/benchmark.json) | [Room lookup performance](../development/performance/tactical-room-visibility-performance.md) |
| [Tactical elevation results](tactical-elevation/) | [Elevation performance](../development/performance/tactical-elevation-performance.md) |
| [Campaign performance](campaign-performance-2026-09-27.json) | Campaign and performance report |
