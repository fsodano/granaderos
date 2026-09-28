# Military bodies and finite equipment on sector reentry

The real paid capital opening stored one player body and two enemy bodies, but
peaceful reentry discarded all three. World entry now retains those units with
zero health, the same position, appearance, weapon definition and remaining gear.
The deployed living squad remains separate. A new enemy occupation can reuse an
enemy identifier; its older body receives a stable distinct identifier. Further
visits preserve that identifier and cannot duplicate the body.

Campaign reports accept confirmed prior player casualties as scene remains,
without applying another death, granting service or returning their untouched
ammunition. Ammunition actually recovered from an old body uses that saved source
as its finite allowance. Shared sources are counted once. A revived prior body,
an unrelated report or a request to redeploy a dead player is rejected.

Runtime source: `b063d878f39e9db2bf5af2c63b57f1ef39765046`.

## Verification

`tests/military-remains.test.mjs` covers four paths:

- Actual seed-8 paid hires, arrival, capital victory and confirmed casualties.
  Healthy survivors revisit the sector, walk to the fallen hire, recover its
  ammunition and authored weapon, save, leave and revisit. The source remains
  depleted, the weapon cannot be taken twice, the correct cartridge total returns
  to treasury and the original death event does not repeat. The badly wounded
  survivor stays in reserve; the test does not silently heal it.
- A prepared renewed occupation retains old enemy gear while introducing a living
  defender with the old identifier. It verifies unique body identifiers, repeated
  entry, depleted ammunition accounting and a third occupation. Prepared deaths
  isolate that identity/accounting case; they are not accepted combat victories.
- Actual saved prior casualties cannot disguise a revived or unrelated report,
  and a living deployment request cannot resurrect one.
- A prepared occupation of the actually won capital starts a second real battle.
  Its actions, result, prior bodies, full service report and saved settlement pass.
  The occupation itself is prepared; this is not an enemy recapture route.

The three initial regressions failed before the correction. Twelve focused world,
ammunition, casualty and reentry cases passed. The four body cases also passed
after adding actual weapon-recovery and definition checks.

Release checks: **786/786 tests**, zero failures or skips (189,138 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (197 requirements, all 50 original and 87 parity rows,
36 evidence records). Exact-head GitHub checks are required before merge.

## Limits

Bodies already removed from a saved scene cannot be reconstructed from campaign
death records. This change preserves retained scene records. It does not add body
transport, burial, decay, civilian inventories, custody or expanded inventory
controls. Existing scene-size limits remain. Rendering uses the existing dead-unit
path; this delivery does not claim live-browser or animation acceptance. Full
historical and independently authored campaign completion remain open.
