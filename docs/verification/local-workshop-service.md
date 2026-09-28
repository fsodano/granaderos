# Local workshop service

Source: `d3e7d078653f9dd15c98926f57cec18430a25727`.

A normal two-squad campaign reproduced remote servicing: with the selected squad
at Retiro, replenishment and repair could affect a person who had travelled to
Buenos Aires. The old check verified the selected squad's workshop, not the
recipient's location. The new regression failed before the correction.

Both actions now require the person to be available at that exact workshop.
Control, supply, funds and existing refill/repair prices still apply. A shared
eligibility check also serves the explicit dressing purchase. The armory shows
the selected person's actual location and disables unavailable service controls
with a visible reason. The campaign checks eligibility again when accepting the
order, so an old control state cannot authorize remote work.

## Acceptance

Three simulation tests use authored zero supplies, actual paid hires, separate
squads and real travel. Weapon wear is declared prepared state for this service
regression. Remote replenishment and repair preserve money and physical state.
A person already in the workshop receives service without changing the remote
person. Returning through normal travel enables paid service once; a second
request cannot charge for complete provisions or an intact weapon. Save/load and
actual deployment retain the serviced counts and condition. Unavailable service,
a non-workshop location, lost control and insufficient funds are rejected.

A mounted armory test selects both people, reads their distinct locations,
verifies disabled remote controls, pays for local service, applies the real return
trip and services the returned person through the same controls. The save retains
the result. The existing authored-foundry, headquarters, equipment and doctor
checks also pass.

Release checks: **821/821 tests**, zero failures or skips (199,313 ms); type
check; production export (722 files, 632 asset references); 36 baseline checks;
documentation audit (208 requirements, all 50 original and 87 parity rows,
47 evidence records); 162 changed-document local links. Exact-head GitHub CI
is required before merge.

## Limits

This correction establishes local paid workshop service. It does not implement
repair assignments with elapsed work, finite tool custody, local armory transfers,
merchant stock or transport of purchased equipment. It retains the existing
instant workshop prices and refill targets. No live-browser or full performance
acceptance is claimed.

[PR #70](https://github.com/fsodano/granaderos/pull/70) merged after
[GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36419410898/job/108918251655)
passed at `9eacc99f7eb3778f9a389f2097e58a9af6294d13`.
