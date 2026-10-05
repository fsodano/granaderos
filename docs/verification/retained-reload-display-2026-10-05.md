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
The second native assault continues from that exact outcome; no favorable reset
substitutes for it. Its 292 accepted campaign and tactical records replay
exactly. Ordinary and presented execution agree for every tactical order.
The unchanged native Buenos Aires battle ends in victory at turn 20. The
normal return retains the original two deaths and four new deaths (the officer,
Ferreyra, Silva and Ferreira). Sosa survives at 47/70 HP and Cejas at 67/67 HP,
both without bleeding. Actual victory funds leave 566 pesos at hour 37,
second 219. The accepted settled pair has digest
`b58518698ca3bd6f292abb7e91ee0f305d257b83e1873f49ca97cc963176f910`.

Silva earns the wounded loading check in that battle. At order 204, hostile
fire lowers him from 90 to 11 HP with six bleeding. At order 206, Ferreira's
actual first aid spends one dressing, stabilizes him at 15 HP and stops the
bleeding. At order 211, he pays 36 AP for a four-increment aimed shot. The
observed enemy falls from 100 to 36 HP; Silva retains 19 AP, an empty gun,
nine reserve rounds and condition 99. Order 212 spends those 19 AP on loading.
The chamber stays empty and the reserves stay at nine; retained work is
19/45 and the actual hand model reads `Recarga en curso: 42%`. On the next
real turn, order 222 pays the remaining 26 AP, leaves 34 AP and finishes one
charge, reducing the reserves to eight and removing unfinished work. Official
save boundaries preserve each result. An independent read-only check replays
orders 211, 212 and 222 from their immediate saved predecessors and matches
the admitted pairs exactly.

All current-party finite charges fall from 60 to 45, including one charge in
Ferreyra's dropped gun; four actual care orders reduce twelve dressings to
eight. No refill, health grant, terrain change or enemy reduction occurs.
No affordable covered-cell move was admitted for Silva at that point. This
proves a wounded shot and loading across real turns, with actual campaign
losses; the full wounded shoot/cover/load sequence and campaign balance remain
open. The native run uses the previously validated production digest below.
Its complete acceptance log, saved history and terminal pairs remain separate
from the short regression suite.

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
