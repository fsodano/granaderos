# Fresh coastal opening: mixed created force and hired force

**Current status — 4 October 2026:** The figures and methods below describe
the dated September source. The current ordinary 3,200-peso route has separate
[stock campaign evidence](stock-campaign-route-2026-10-04.md), including actual
coastal victories, permanent casualties and a physical port agreement.
Separate 32,000-peso funded fixtures do not establish ordinary-start acceptance.

The [persistent ammunition record](strategic-ammunition-custody.md) contains
the later route checkpoints, actual costs and surviving force. The original
source and dated results below remain historical evidence.

Two new campaigns now complete the published coastal opening with actual combat,
paid service, permanent losses and saved mission settlement. They start from
default content, seed 8, Retiro alone, no personnel and 3,200 pesos. Neither route
grants territory, supplies, health or a battle result.

Source: `5119b5ca619d4974aac0fb5594d51a699074b778`.

Later manual-care integration changed the reproducible route costs and casualties.
See [the finite first-aid regression record](finite-first-aid.md) for that source;
the checkpoint below remains evidence of this earlier release.

[Recorded checkpoints](../evidence/fresh-coastal-2026-09-28.json) retain the figures.

| Route | Start | Saved San Lorenzo result |
| --- | --- | --- |
| Created officer with support | Free legal 550-point profile, physical Cabral recruitment and four paid week hires | Phase 2, hour 36 second 68, 3,673 pesos; commander 88 HP; six current squad members |
| Hired force | Six paid week hires, no created officer | Phase 2, hour 42 second 74, 2,885 pesos; commander 88 HP; five current squad members |

The created route loses Cabral and civilian Paroissien. The hired route loses
Acosta, Arce, Desforges and Kerr, plus civilian Dorrego and Paroissien. Their deaths
remain saved. Neither controller assumes that a named doctor or contact survived.

## Method and acceptance

`tests/fresh-coastal-route.test.mjs` runs both paths through the actual authored
Buenos Aires, San Nicolás and San Lorenzo maps. Its driver uses ordinary tactical
orders, visible targets, remembered locations, aim, cover, reload and finite
medical supplies. It cannot edit AP, money, health, ammunition or victory.

Each battle records its legal orders. A second execution applies every order with
the campaign clock, reloads a save halfway through the engagement, and verifies
identical final units, random state and elapsed tactical time. Deployment uses the
actual campaign hour and seconds, including lighting changes. The campaign then
explores, spends any needed available dressings and settles its actual victory.

After casualties, replacements are selected only from living characters outside
current service. Their week contracts are paid, their destination must be a
controlled valid arrival site, and the route waits for their real arrival. Dead
characters cannot be hired again. Duplicate result reports are rejected. Final
state has the completed San Lorenzo mission, a living temporary commander, positive
funds, no open scene and phase 2; the campaign ending remains false.

The earlier direct-charge probes lost battles. Their failure did not establish an
unwinnable game. The new controller makes deliberate firing and positioning
choices using the same gameplay rules. It is one reproducible strategy, not an
optimal player or a balance guarantee. The preceding mission-settlement fix is
needed for the actual return after post-victory exploration.

Release checks: **792/792 tests**, zero failures or skips (190,646 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (199 requirements, all 50 original and 87 parity rows,
38 evidence records). [PR #61](https://github.com/fsodano/granaderos/pull/61) merged
after [exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36394524991/job/108837669091)
passed on `bd9ad39e6684170f543788b26afc76b1d4b8a77d`.

## Limits

The created officer uses a valid player-selected profile and paid support. This
does not prove a solo or entirely unpaid campaign. Only this seed and these force
choices are accepted. Other starts, the north, Cuyo, the final historical campaign,
an independently authored full campaign and sustained performance remain open.

These are simulation, replay and save checks. They do not establish live-browser
usability or frame rate. The separate advanced/prototype failures remain recorded
against those sources. This delivery adds verification; it changes no gameplay
rules, prices or combat difficulty.

A later [local-recruit opening checkpoint](local-recruit-opening.md) verifies a
created officer with actual local recruits and no bulletin hires through saved
San Lorenzo completion and a subsequent sector visit. It preserves actual paid
care and losses; the earlier scope and figures above remain dated evidence.
