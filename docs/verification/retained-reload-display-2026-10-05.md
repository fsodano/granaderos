# Retained loading display — 5 October 2026

This batch addresses the combat-loop feedback in item 41 and the visible weapon
tradeoffs in video requirement V07. It does not establish overall campaign
balance or a complete legal campaign.

The existing partial-loading rule retains work on the physical gun. Previously,
the hands and roster showed ready charges without the unfinished work. At zero
AP, a successful partial order could therefore appear to have done nothing.
The new [loading display](../gameplay/equipment/retained-reload-display.md) shows
that work separately, including each hand's own weapon. It reads the existing
state and changes no ammunition, AP, health, enemy action or save field.

## Scope of the checks

Four complete affected files cover each hand's own firearm, unfinished work
beside a ready barrel, zero AP, older omitted fields and the actual mounted
loading control. The existing authored slow-loader route is a declared
regression; it is not an earned native wound or a complete campaign.

An isolated headless browser check uses the real roster CSS at 1,366, 1,024,
800, 650 and 390 pixels. The first 390-pixel check found a clipped badge.
The compact mobile roster now retains its established 78-pixel minimum and
horizontal scrolling. The final checks retain the separate charge count,
fit the progress badge inside each hand, and reach the last mobile portrait.
The player's running browser tab was not used for this check.

The first native diagnostic hires Acosta (110) and Inés Aguirre (107) for their
actual weekly prices of 420 and 588 pesos. It retains the six-hour arrivals,
ordinary attack and north-edge deployment on the unchanged Buenos Aires map.
No actor health, kit, terrain, AP or enemy force was assigned. Its 32 accepted
records end in a real defeat: Acosta returns unconscious at 6 HP after hostile
fire, then bleeds to death; Aguirre later dies from two actual hits. Neither
fires or reloads. Official saved replay is exact. The stopped pair has digest
`c323955a9c7edb4d7c2c604626200bebe2ab280dc20bff09dce32acf775ad282`
at hour 18, second 204, with 2,192 pesos. Those losses and costs remain intact.
This diagnostic does **not** pass sustained wounded-loop acceptance or justify
changing damage or AP settings. Canonical defeat settlement preserves both
deaths. A normal version-2 commission uses the current default 550-point profile
and public questionnaire without a hiring fee. Five actual weekly hires cost
1,876 pesos and arrive after six real hours. The resulting six-person party has
316 pesos at hour 24, second 204. Its full 40-order saved replay is exact.
The accepted pair has digest
`f988e3bbeaedb0cc7419ae254b2b7eae30f4c00356cbeb625c1c146aa6c32ff7`.
Further native fighting continues from that outcome; no favorable reset
substitutes for it.

An earlier harness attempt stopped before tactical admission because it tried
to save a pending campaign without its required battle. The corrected harness
replays the exact three paid prefix orders, dispatches the same attack and
prepares the canonical campaign/battle pair before saving. The original failure
log remains separate. That sequencing error is not a game-rule defect.

## Final validation

The complete unfiltered `npm run test:quick` passes **4,969/4,969 tests** across
**715/715 files**, with no failed, cancelled, skipped or todo tests, in
387.186 seconds. The eight existing extended exclusions remain unchanged.
The test runner, shard allocation and suite configuration are unchanged.
The four complete affected files pass 68/68; these cases overlap the short suite.

Type checking, the production build, documentation audit, all 38 baseline
comparisons, all 11 runner self-tests, complete shard coverage, suite partition
and whitespace checks pass. The export verifies 1,133 files and 1,033 asset
references. The five real-CSS screen widths pass, with no clipped loading badge.

All final gates use production digest
`7b2361d6b8306f9c01e269fe6943ed66395eda292d5182b38d3f1c847a65a03f`
and build identity `7b2361d6b830`. The test and support digest is
`7c5afda099c08770e605fd3cb113be1d08f5c25c80fd0b43414ae6ff4dffde78`
over 893 paths, including 723 test files. The original native failure logs and
saves remain separate from these passing regression gates.

No damage, wound, recovery, reload or other balance value changed. No cannon
mechanic, 3D renderer or saved field changed. The primary checkout, running game
and browser save remained intact. This batch does not prove sustained native
combat balance, a completed campaign or the eight extended suites.
