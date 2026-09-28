# Authored care and rest rules

Source: `8274f58b959b6408bfdc8a97540421836f78e204`.

The story editor's Rules tab can configure nine care settings: minimum medical
skill, base hourly healing, the medical-skill interval for an extra health point,
dressing price, treatment energy/fatigue costs, base rest energy/fatigue recovery
and the stable-rest healing interval. Whole values and explicit ranges are
validated before import or launch. The optional group must be complete and cannot
contain unknown fields. Older packages retain their existing content identity
and default behavior without inserting a new field.

A new campaign pins the settings. They govern actual assignment eligibility,
saved doctor validation, hourly healing and effort, rest and its saved partial
hours. Dressing prices agree across explicit purchases and ordinary workshop
replenishment. A zero price permits a genuine free refill when supplies are
missing; complete stock still rejects another refill. Zero treatment effort or
base rest recovery is explicit and does not create extra dressings.

## Acceptance

Five simulation tests cover strict bounds and legacy import/save identity;
custom doctor eligibility, healing and energy/fatigue costs; changed rest rates;
a nine-hour healing interval saved at hour eight; invalid saved intervals; zero
recovery; paid and free dressing purchases through both workshop paths; finite
consumption with zero effort; deployment; and pinned rules after external draft
changes. Prepared care wounds/exhaustion and depleted dressing stock are declared
fixtures. These are rules and transaction checks, not a newly accepted full route.

The mounted editor changes all nine fields, undoes/redoes a value, rejects an
invalid interval, restores defaults, undoes the reset and launches. Actual paid
recruitment and a four-dressing purchase charge the authored 68 pesos. Save/load
retains the quantities and rules; a later draft price change cannot change that
campaign or overwrite the ordinary save.

Release checks: **833/833 tests**, zero failures or skips (204,095 ms); type
check; production export (722 files, 632 asset references); 36 baseline checks;
documentation audit (210 requirements, all 50 original and 87 parity rows,
49 evidence records); 157 changed-document local links. Exact-head GitHub CI
is required before merge.

## Limits

The critical threshold, one dressing per working hour, safe exact-cell policy,
existing daily recovery and tactical first aid retain their own rules. This does
not author individual sleep needs, automatic sleep, global fatigue capacity,
physical kit custody, merchant stock or advanced first-aid mechanics. Published
historical and independent route regressions are retained with default rules;
this does not establish balance for every possible authored combination. No
live-browser usability or performance claim is made.

[PR #72](https://github.com/fsodano/granaderos/pull/72) merged after
[GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36422917141/job/108929776748)
passed at `9c8aded66da6c792165c44670551f2af1fe5e293`.
