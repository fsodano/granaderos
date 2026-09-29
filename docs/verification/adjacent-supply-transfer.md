# Share personal supplies with a companion

Runtime/test source: `2bf4933335961174805127bea6fc66bcd2380b64`.

The ordinary inventory selects priming, flints, rations, torches, dressings or
bolas, an exact whole quantity and an adjacent conscious squad member. Four
sender AP or one exploration second moves that quantity from one holder to the
other. The recipient keeps their action points and both retain their weapons.
The supply display now includes actual dressings. The selected quantity must
be available in full; the engine does not silently reduce it. UI preview and
execution share companion, obstacle, stock and range checks.

Saved tactical state, campaign settlement and reentry retain each remainder.
This uses the six authored personal allocations and their existing finite use.
Cartridge sharing is separate because its current deployment/refund economy
needs its own conservation work. Quantity bounds protect accepted campaign/save
ranges; they do not establish physical pocket capacity or weight for every
supply. Tactical quantities remain at most 100,000 per ordinary field or
1,000,000 dressings, matching the supported strategic paths.

## Verification

Four simulations and two mounted production-game checks pass **6/6**; the related
weapon handover, HUD and authored-supply group passes **30/30**. Complete regression
passes **1182/1182**, zero failures or skips, in 268,950 ms. Types, production
export (722 files, 632 asset references), 36 reference comparisons and
documentation audit (256 requirements, 95 evidence records) pass.

The actual campaign fixture configures three immediate paid hires: one carries
four dressings, the medic has none and the third arrives at one health. Ordinary
map entry places them next to each other. The first soldier passes three
actual dressings to the medic, who uses two to stabilize the critical arrival.
Other supply types transfer by exact quantity. Full saves, ordinary exit and
reentry retain both supply remainders and the patient's recovered health.

Prepared combat fields verify all six types, a single sender AP cost and
unchanged recipient AP/held equipment. Exploration moves a full bundle in one
second. Rejections cover fractional, missing, nonnumeric, negative and excessive
amounts, unknown or unsupported types, stock/bounds, wrong recipient, obstacles,
insufficient AP and ambiguous weapon-source fields. The mounted Home case uses
actual supply, quantity and recipient controls, changes supply type and reads
the normal persisted save. Another mounted case shows the stock refusal and
checks that the registered order cannot bypass it. The previous HUD assertion
was updated from six supply rows to seven to include actual dressings.

Ground placement, cartridge sharing, physical pockets, remote relay and throwing
remain open. These are simulations and mounted DOM checks, not live-browser,
performance or complete campaign acceptance. Exact-head CI passed before publication.

## Publication

Published in [PR #118](https://github.com/fsodano/granaderos/pull/118) on 2026-09-29 01:42:33 UTC.
Exact head `2d0ff258098cea9140eaeea09f05908775ec39fa` passed [CI run 36508356384](https://github.com/fsodano/granaderos/actions/runs/36508356384), including the full suite, types and production build. Merge commit: `f2771452b09db0b5ed9e21988a084e2a3c4b91db`. This publication does not close the broader game or campaign requirements.
