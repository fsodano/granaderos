# Assigned strategic campaign roles

The editor assigns a foundry engineer and a marching commander by character
identity. Either role can be disabled, and one character can hold both. Missing
configuration preserves the original identities when present; removing a default
historical identity leaves its role unassigned. Explicit assignments protect their
characters from deletion until the author removes or replaces the reference.

Roles activate only after actual incorporation and require the character to be
alive, free and still in service. Pending paid arrivals grant neither privilege.
Death, custody and contract expiry stop the privilege. Marching retains its
existing global effect across squads and suppresses travel fatigue in both exact
cell and locality journeys. A paid, completed foundry remains organized after its
engineer leaves or dies; later funding does not require paying for it again.
Treasury controls name the actual engineer and explain unavailable preparation.

## Verification

Runtime source: `b3d1387cb3a6e0e3b7028e9545154c0cf7af9cf4`.

- `tests/campaign-roles.test.mjs`: real paid booking/arrival, cell movement before
  and after arrival, exact one-time workshop/funding payments and saved results
  with two new identities and no historical cast. Actual one-day contract expiry
  during a locality journey removes the marching benefit and blocks an unfinished
  foundry. A completed foundry still permits funding after expiry.
- A prepared compact combat uses the actual enemy turn to kill the assigned
  engineer. Real battle settlement, save and subsequent travel confirm that the
  dead character grants no role while the surviving force can continue. This is
  a bounded tactical regression, not a full mission or campaign victory.
- Separate prepared custody, confirmed-death, deferred-departure and occupied
  Mendoza states isolate eligibility. Invalid role shapes, missing identities,
  explicit disabling, legacy defaults and altered pinned saves are covered.
- `tests/story-editor.test.mjs`: mounted selection, undo/redo, reset, reference
  protection, removal after clearing roles and launch followed by actual paid
  arrival, foundry payment and fatigue-free travel. Actual mounted treasury
  controls reject pending arrival and apply preparation/funding payments once.
- Seventy-one focused runtime/editor/cast/legacy checks passed. Early authoring
  checks exposed test-selection and mount-lifetime mistakes; those were corrected
  before the final focused run. No gameplay validation was relaxed.

Release checks: **767/767 tests**, zero failures or skips (187,348 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (193 requirements, all 50 original and 87 parity rows,
32 evidence records); 112 changed local links. Exact-head GitHub checks are
required before merge.

Accepted in [PR #55](https://github.com/fsodano/granaderos/pull/55) at
`04d4b5ce4da52c09687e72b7f3a8aeecf3f3f8cc`, with
[successful exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36387749886/job/108816651510).
Merged into `main` as `b2c9fb453f255f29d00e0fa1baccf88d1b60c641`.

## Limits

ROLES-01 assigns two existing strategic privileges. At this checkpoint foundry location, name, setup cost and funding cost retained
existing rules; the subsequent [foundry project delivery](foundry-project.md)
authors them. March effect strength still uses existing rules. Mission identities,
recruitment gates, indispensable original-story actors and successor role transfer
remain separate work. The original campaign still needs its foundry to progress;
an author who disables it must provide another progression. Roles do not grant
combat abilities, move their holder to the map, bypass hiring, heal a character or
transfer belongings. No full alternate/historical campaign, browser session or
sustained loaded-combat performance acceptance is claimed.
