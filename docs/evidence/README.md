# Verification evidence

[Documentation index](../README.md) · [Verification records](../verification/README.md)

This folder holds route snapshots and measured performance results. Filenames
and report fields identify their checkpoints. The files preserve the recorded
results; they are not refreshed by a documentation update.

Read the linked verification note for the setup, scope and limitations before
using a result. Published acceptance is recorded in [published progress](../verification/published-progress.md).

## Alpha local acceptance

- [Complete alpha local receipt](alpha-service-equipment-local-2026-10-01.json): final gates, actual full TAP totals and log hashes, shared build, copied browser/UI source relationship.
- [Compact executing-source delta](alpha-source-inputs-delta-2026-10-01.json): exact reconstruction over the immutable PR139 manifest.
- [Bounded policy and limits](../verification/alpha-service-equipment-return-2026-10-01.md). These are local proof included in the alpha PR; no alpha CI or merge is asserted.

## Campaign and route records

- [Campaign routes with partial firearm loading](partial-reload-routes-2026-09-28.json) and [verification scope](../verification/partial-firearm-reloads.md).

- [Campaign routes with finite field aid](finite-first-aid-routes-2026-09-28.json) and [verification scope](../verification/finite-first-aid.md).

- [Fresh historical victory](fresh-historical-ending-2026-09-28.json) and [verification scope](../verification/fresh-historical-ending.md).

- [Fresh Cuyo preparation](fresh-cuyo-preparation-2026-09-28.json) and [verification scope](../verification/fresh-cuyo-preparation.md).

- [Fresh Mendoza campaign loss](historical-mendoza-loss-2026-09-28.json) and [verification scope](../verification/historical-campaign-loss.md).

- [Fresh northern route data](fresh-northern-2026-09-28.json) and [verification scope](../verification/fresh-northern-opening.md).

- [Fresh mixed/hired coastal route data](fresh-coastal-2026-09-28.json) and [verification scope](../verification/fresh-coastal-opening.md).

- [Formal audit evidence](formal-audit-2026-09-27/) and [scope/method](../verification/formal-audit-2026-09-27.md): three source manifests, complete logs, comparisons and reproduced failures.

- [Current campaign and performance report](../verification/gameplay-and-campaign-performance-2026-09-27.md) *(workspace)*
- [Latest gameplay follow-up](../verification/gameplay-follow-up-2026-09-27.md) *(workspace)*
- [26 September regression audit](../verification/current-worktree-regressions-2026-09-26.md) *(workspace)*
- [Northern campaign route](../verification/northern-route.md) *(workspace)*
- [Mendoza foundry route](../verification/mendoza-route.md) *(workspace)*

Dated JSON files in this folder retain the individual route and measurement
checkpoints referenced by these notes.

## Controlled performance comparisons

| Measurements | Interpretation |
| --- | --- |
| [Motion routes](motion-routes/benchmark.json) | [Animation route setup](../development/performance/tactical-motion-performance.md) |
| [Room visibility](room-visibility/benchmark.json) | [Room lookup performance](../development/performance/tactical-room-visibility-performance.md) |
| [Tactical elevation results](tactical-elevation/) | [Elevation performance](../development/performance/tactical-elevation-performance.md) |
| [Campaign performance](campaign-performance-2026-09-27.json) | [Campaign and performance report](../verification/gameplay-and-campaign-performance-2026-09-27.md) |
