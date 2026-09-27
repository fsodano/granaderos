# Deployment start time

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Ordinary attacks and peaceful visits now store the campaign hour and seconds in the deployment request. Joint assaults and sector defenses already carried these fields. Mission visits inherit the ordinary visit clock.

The browser already passed the campaign clock when opening a battle. The defect affected callers that used the deployment request directly: ordinary attacks defaulted to noon, and night visits could default to midnight. The shared request now gives direct simulation and the browser the same start time. The browser handoff prefers this captured time; a later caller clock cannot rebase an existing request. Resuming an automatic battle still returns its exact saved snapshot.

Saved requests reject negative, fractional or null hours and seconds outside 0–3599. A saved battle must retain the start time recorded by its deployment. Tactical elapsed time continues to synchronize once through the existing time bridge. No obsolete-save migration is added.

## Verification

Four deployment-clock tests cover visits on both sides of dawn, dusk and midnight; an ordinary night assault after real travel; identical direct/browser entry; automatic combat and save continuation; a paid exploration step crossing 05:59:58 to 06:00:01; and malformed or shifted saved clocks. The seven existing time-bridge tests now use the unmodified deployment request, including torch lifetime and strategic re-entry.

The legal seed-8 opening uses normal sleep and wait orders to depart the staging sector at midnight, then arrives at San Nicolás at campaign hour 36 (day 2, 12:00:00). San Lorenzo starts at hour 42, second 392 (day 2, 18:06:32). Each battle asserts its start against the actual campaign clock. Both victories replay deterministically: 19 turns/142 orders, then 16 turns/144 orders. All nine deaths remain permanent, and field salvage remains finite. The existing synthetic-map victory and defeat tests also continue interrupted staging waits through actual orders before daylight deployment.

The isolated gameplay checkout passes all 1,219 tests, type checking, the production build and the whitespace check. Concurrent art and recruitment changes are excluded from this checkpoint.

This closes the deployment-origin mismatch. It does not prove later campaign balance or full JA2 parity.
