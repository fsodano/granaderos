# Authored militia promotion rules

Initial runtime/test source: `d43b031e13636336f0967824a5d688c5c017e94c`.
Final runtime/test source: `b608f1e68b9c34bb4de759850d8e8dadb4d66844`.

The story editor's Rules section can configure cumulative combat thresholds for
Montonero and Veterano and the marksmanship, leadership and experience-level
gains of each ascent. Regular threshold accepts 1–99; veteran threshold accepts
2–100 and must exceed the regular threshold. Attribute gains accept 0–100 and
level gain accepts 0–9. Zero keeps that attribute; caps remain 100 and level 10.
These gains apply to both combat promotion and paid regular instruction.

One first eligible wound still grants one point, with the same opponent's
eligible kill upgrading it to three. A survivor can gain one rank per returning
encounter with new credit. Rank never replaces health, weapons or supplies.
New veteran tuition remains disallowed. Training prices, durations and cohort
sizes are separate rules and are not edited by these controls.

The optional package field preserves the identity of older content with no new
default fields. Import/export, draft persistence, undo/redo, reset, validation
and new-campaign launch include the authored rules. Saved campaigns retain their
own package; later draft changes cannot change those campaigns. The strategic
screen shows the thresholds actually pinned to that campaign.

## Verification

Five simulation checks and two mounted checks cover this delivery. The initial
overlapping group passes 52/52; the final reviewed group passes 59/59. The
mounted editor check also passes separately. Types and all 36 reference
comparisons pass. Initial full regression on `d43b031` passes **973/973**, zero
failures or skips (229,614.423 ms), and export passes with 722 files and 632 asset
references. Final regression on `b608f1e` passes **974/974**, zero failures or skips
(232,587.041 ms). Final production export passes with 722 files and 632 asset
references. The documentation audit passes with 231 requirements and 70 evidence
records, retaining all 50 original and 87 parity requirements.

The actual combat case authors thresholds of four and seven, pays for and wounds
an actual militia cohort, provides finite paid care, then fires three actual
reaction shots across saved encounters. The same wounded soldier progresses
through ranks 0, 1 and 2 with cumulative points 3, 6 and 9. Its 43/60 health and
weapon remain, while its load falls from three to zero and wear increases.
Authored attribute gains apply only at the two real rank changes. The test uses
a purpose-authored pistol and declared compact geometry; it is not a historical
balance or full defense-route claim.

A zero-gain variant completes an actual paid regular course and later earns
veteran rank through real combat, retaining the actual attributes and wound.
Older records with no stored experience level use the existing effective level
of four; initial test expectations were corrected to compare that effective
value rather than undefined. Runtime behavior was not weakened.

Other checks cover strict schema and threshold ordering, optional legacy
identity, portable packages, saved-content tampering, attribute caps and
prepared high-threshold receipts. The mounted editor changes all five fields,
rejects invalid values, restores and undoes defaults, launches a campaign and
completes real paid instruction under those saved rules. The production campaign
mount shows a saved three-point survivor that has not reached its authored
four-point threshold, plus its real wound and the correct thresholds.

Review reproduced a receipt-limit defect: a regular soldier with 100 recorded
opponents could earn no credit from a new eligible kill and therefore could not
reach veteran rank. The new regression first failed at 100 records where 297 were expected.
The bounded ledger now accepts 300 opponents and 900 points. A cívico below
the largest authored threshold can have 98 earlier wound receipts, then face
up to 199 more opponents within the supported 200-unit tactical limit. The
ledger keeps those 297 receipts and still accepts new credit on the next return,
allowing the second ascent. A prepared boundary test covers that sequence,
peaceful return, the new cap and rejection beyond it. These are explicit
ledger checks, not claims of 298 actual combat victories. The final complete run includes this boundary regression.

[Exact-head GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36470608608/job/109091623451)
passed at `dda3968a13a0affd20bde06ff4fb6ed167219943`.
[PR #93](https://github.com/fsodano/granaderos/pull/93) merged on
2026-09-28 at 19:28:11 UTC as `4dddb7a26afea5b83fe2bb3c5c5f0a9867b4ddd7`.
Together with published paid-course, combat-credit and finite-care evidence, this
closes the rank-progression scope of JA2-S04. Allied autonomy, direct control,
patrols and redistribution remain in JA2-S05. This feature does not establish
live-browser behavior, autonomous militia turns, city redistribution, custody,
advanced defense routes or exact JA2 numerical fidelity.
