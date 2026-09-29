# Saving authored cartridge allocations

> Historical verification record. The
> [persistent ammunition delivery](strategic-ammunition-custody.md) replaces
> automatic return refunds with physical carried and sector stock. Its current
> checks supersede the refund expectations below; the original results remain history.

Source: `32f7dc096cbdb3c152a79996a337d1fc1f885443`.

An independently authored campaign configured fourteen deployment cartridges. Its
first peaceful headquarters visit failed save admission: the campaign issued the
configured amount, but the pending-squad validator still allowed only ten reserve
rounds. The same mismatch affected larger combat deployments.

Pending reserve validation now uses the campaign's pinned deployment allowance.
The existing loaded-capacity validation remains. This changes save admission, not
the issue price, firing rules or actual stock. The tests fail before the fix with
“la batalla guardada es inválida” on legitimate generated scenes.

## Acceptance

`tests/authored-cartridge-save.test.mjs` creates actual paid recruits and visits or
attacks through campaign actions with 0, 10, 11, 14 and 100 cartridges. It verifies
up-front payment, live units, saved continuation, rejection of excess pending
reserves, the exact unused refund and rejection of a repeated departure.

A second case uses a real peaceful scene, approaches a resident, fires an actual
round, synchronizes time, saves, reloads the weapon and saves again. The available
amount remains 99 from the initial 100. Departure charges exactly the spent round.
The civilian hit uses the ordinary damage/incident path; this is a prepared supply
regression, not a claimed campaign victory.

Release checks: **807/807 tests**, zero failures or skips (192,756 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (205 requirements, all 50 original and 87 parity rows,
44 evidence records). [PR #67](https://github.com/fsodano/granaderos/pull/67)
merged after [CI](https://github.com/fsodano/granaderos/actions/runs/36414937984/job/108903700414)
passed at `1f77280fc516baede6f694233789a769a1f3a9b9`.

## Limits

This closes the stale pending-reserve cap. It does not implement new ammunition
types, prices, custody, civilian loot or the remaining advanced systems. A complete
authored campaign and live-browser performance retain their separate acceptance
requirements.
