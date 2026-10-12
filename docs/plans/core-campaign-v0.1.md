# Shipping campaign: version 0.1

Updated: 11 October 2026.

Status: partial fixes implemented. End-to-end campaign verification remains
incomplete. No complete current-source campaign result is claimed.

The shipping campaign is `campaigns/granaderos/`, selected by the normal
browser launcher. The launcher starts the compiled installed package at seed
1812, with 3,200 pesos, Retiro controlled and no serving personnel. A legal
created character and paid hires may be used. The loose seed-8 route and
32,000-peso funded fixtures remain separate regression cases.

## Required evidence

| Requirement | Source of the rule | Evidence needed |
| --- | --- | --- |
| Installed start | Campaign manifest, package compiler and `web/app/page.tsx` | Fresh default-seed installed start, correct identity, verified resources, creation and paid hiring. |
| Coastal progression | Historical scenario and mission definitions | Actual Buenos Aires, San Nicolás and San Lorenzo victories, physical income agreement, finite recovery and saved settlement. |
| Northern progression | Historical scenario and Yatasto mission | Actual territory, paid care, travel, recruitment and physical conference completion. |
| Cuyo preparation | Historical foundry and phase-IV conditions | Finite owned artillery, transport, living required actors, paid foundry and army, fortified passes and pehuenche agreement. |
| Campaign victory | Historical phase-V conditions | All thirteen localities controlled, commander recruited, blockade cleared, no unresolved enemy group or open scene, and one ending record. |
| Genuine failures | Headquarters and indispensable-actor loss rules | Real defeat and settlement preserve casualties and admit the official save. |
| Save and continuation | Official save codec and campaign dispatch | Active battle save/replay, saved victory, post-victory income, real service expiry and tactical reentry. |
| Browser playability | Production launcher, desk, strategic and tactical components | Visible start, recruitment/creation, deployment, orders, save/continue and ending/continuation paths on the final export. |
| Release regression | Supported full runner and local gates | Complete unfiltered Node suite, docs and baseline audits, typecheck, nested export, available Python/C++ checks and clean diff. |

All route proof must use ordinary orders and actual battle outcomes. Do not
assign money, health, supplies, territory, random state or victories to make
the route pass. Preserve actual permanent losses. A losing controller is a
failure receipt; it is not proof that a game mechanic is broken.

## Current work

- [x] Correct artillery instructions. Version 0.1 uses finite recovery from
  conquered arsenal chests, rather than disabled equipment trading.
- [x] Restore the historical held-bayonet behavior in the installed package.
  A real deployed comparison found 50 damage/reach 2 where the original loose
  secondary bayonet uses 24 damage/reach 1. Keep the fixed primary definition
  separate and preserve authored overrides.
- [x] Update route hiring receipts for immediate and delayed arrivals. Keep
  exact service starts, paid durations, debits and real waits.
- [x] Retain opening paid survivors through their actual first service expiry.
  The unchanged baseline ending deployed only the created officer at San
  Nicolás after the five day hires had left service.
- [x] Preserve explicit returned equipment without inheriting the starting
  weapon's metadata. A missing or replaced physical hand must survive the
  official save round trip.
- [x] Recover and share actual finite dressings and ammunition. Keep spent
  supplies, elapsed discovery time, paid service and permanent casualties.
- [x] Review the production opening in the browser. Creation, a paid hire,
  Retiro orders, export, page reload and Continue passed on a fresh origin.
- [ ] Complete the installed default-seed route and its saved continuation.
- [ ] Complete the final production browser review and full release gate.

## Recorded checks and remaining limits

The first unfiltered baseline completed on frozen `main` at
`575bd01810eb893332696f5dc50fb89cc59c33e0`. All 1,004 selected Node files
ran: 7,371 tests passed, 71 failed and one was skipped. The exit code was 1.
All 14,483 tracked source hashes remained unchanged. Its report and passive
failure captures remain in the primary checkout under
`.cache/core-campaign-2026-10-11/baseline-575bd018/`. These are local diagnostic
records, not a passing release receipt.

The held-bayonet fix passed 39 baseline assertions, 15 deployment/contact/
catalogue tests and 60 weapon/fitting/inventory/save tests. Its comparison
preserves the original `0.1` held profile of 24 damage, 16 AP and reach 1.
The fixed primary bayonet remains at 50 damage and reach 2. The instructions,
hiring and opening-service changes passed 12, three and four focused tests,
respectively.

Twelve test fixture files were corrected without changing stock abilities,
arrival times, mechanics or compiler validation. Their three existing check
groups passed 17, 22 and 34 tests, with no failures or skips. Authored controls
now explicitly select optional abilities, delays and their own residents.
Care and save checks retain actual supply costs, casualties and replay.

The ending check at `2e81b6ddb107bc4af2b1c85411441ba7aea8274e` failed both
cases. The loose seed-8 route stopped when no conscious medic could reach a
remaining field dressing. The installed seed-1812 route reached San Lorenzo,
then stopped on a fixture assertion that replacement hires had not arrived.
All 679 pinned runtime, shipping-package and ending-import files remained
unchanged during this run. Neither result proves the campaign ending. No
complete passing full suite or final production browser campaign review has
been recorded for this batch.

Changes use `fix/...` branches and PRs into `main`. The historical `0.1` tag
retains its original source and scope.

## Route recovery batch

PR #342 fixes a real roster projection error: returned raw equipment could
inherit metadata from a character's starting weapon. The corrected projection
keeps the actual physical hand, preserves displaced authored equipment and
still rejects forged metadata on an absent hand. Seven equipment and saved
ownership tests passed.

The route helpers now use actual paid arrival receipts, recovered enemy
dressings, shared unused rear ammunition and ordinary rest before a long
detour. Test fixtures explicitly provide their optional projectile settings,
current world context and arrival delay. No stock abilities or victory rules
are relaxed. All 44 selected UI and Campaign Studio checks passed with their
source files unchanged. The downloadable post route supplies explicit finite
physical sources and passed its two route tests; the four affected files
passed in two recorded runs, not one combined run.

The earned installed/default-seed checkpoint now prepares twelve paid
soldiers and two supplied physicians for Tucumán. The subsequent actual
assault won after 210 ordinary orders and seven turns. Its actual fallen
soldier remains dead, and the settled save reloads. The northern helper then
recovered officers, a provincial gun and finite dressings, healed the actual
injured support and saved the pending Salta assault. These are bounded
checkpoint results. The following actual Salta assault also won after 265
orders, but post-battle first aid did not stabilize officer Quiroga (ID 9). That failure
is retained. These results do not prove a fresh complete campaign ending.

The production opening review used build `0.1.0 · 66560194cd5b`, from
`12de741add7ee16fedb15c5595264a7c259389e2`. A legal created character, a
1,134-peso weekly hire and normal Retiro movement and posture orders passed.
Export and page reload followed by Continue retained both soldiers' exact
equipment, health, position, treasury and service. The browser error log was
empty. All 2,267 pinned build inputs remained unchanged. The later commits
to this batch change route tests and documentation; final ending and
continuation browser review remains open.

Two earned hospital tests passed with all 624 pinned inputs unchanged. They
keep Córdoba occupied, heal all four actual patients at controlled Tucumán,
spend the real officer fee, paid physician, fortifications and finite
dressings, then save and replay an ordinary rural sleep tick. The later return
still fails at its actual hour-408 Tucumán raid.

The full release regression, later hospital return and complete Cuyo route
remain open. Bounded post-Salta care and Cuyo defense checks are recorded
below. Earlier native raid defeats remain recorded failures. A passing
checkpoint or a merge does not establish complete campaign acceptance.

## Complete regression receipt for this batch

The supported unfiltered `npm test` run completed on clean
`0f2f8ae99ef6aa1e2baed353edb9e7a381ddc0c2`: all 1,013 selected files ran,
with 7,468 tests passed, 13 failed and one skipped. Its exit code was 1.
All 14,497 pinned repository files remained unchanged through the run and
subsequent local gates. The receipt, complete report and passive failure
captures remain in the managed worktree under
`.cache/core-campaign-2026-10-11/release-0f2f8ae9/`.

Thirty-two of the forty previously failing file names now pass. Eight long
route files still fail: opening playthrough, fresh ending, campaign recovery,
coastal, northern, Cuyo, historical loss and the Cuyo battery defense. Their
current causes must be read from the new results; a repeated file name does
not establish an unchanged cause. In particular, the recovery now reaches
the later actual hour-408 guard defeat instead of attempting travel through
occupied Córdoba.

One additional inventory test authored the fixed bayonet while its soldier
carried the loose secondary bayonet. That fixture is corrected separately
after this complete run, retaining its mounted inventory, hand change and
saved metadata assertions. Its complete file passed 1/1 with all 923 pinned
inputs unchanged. This does not turn the recorded full run into a passing
result.

Runner integrity and shard coverage, documentation and baseline audits,
typecheck, nested production export and diff checks all passed. The export
verified 1,413 files and 1,045 asset references, with the same
`0.1.0 · 66560194cd5b` identity as the reviewed browser build. Supplementary
primary-checkout Python checks passed 15/15, and the standalone strict C++17
rule check passed. All 69 native inputs and 42 shared candidate input hashes
still match their recorded receipt. This is not a Windows engine build.

## Timely aid and travel follow-up

PR #343 changes route test helpers and adds earned checkpoint regressions.
It does not change the runtime, installed campaign, resource definitions or
victory requirements.

The complete installed Salta first-aid test passed 1/1. The nearby physician
recovers two existing dressings from known enemy remains and spends one in
three seconds. Quiroga survives with 15 health and no bleeding. Ordinary
payment, travel and conference orders then complete Yatasto. Earlier deaths
remain permanent, and the resulting campaign reloads through the official
save codec. This proves the earned checkpoint continuation, not a fresh
complete installed campaign.

All seven tests in the three affected battery files passed, with all 593
pinned inputs unchanged. Native route previews now select rural rest stops
before the crew becomes exhausted, including interrupted journeys. The
earned regression preserves the actual later occupation and looting of
Córdoba, remote wounds, finite equipment and exact saved order replay.

The complete earned Cuyo battery defense test passed 1/1 after the guard
booking update. The local reserve defeats the original raid through ordinary orders,
preserves its four actual deaths, stabilizes the three surviving casualties
with five existing dressings and delivers both original guns. Battle and
first-aid orders replay through official midpoint saves. Four separate paid
hiring and guard-booking checks also passed, including a current installed
immediate arrival with its actual quote and exact service duration.

All nineteen tests in the five affected coastal files passed, with all 647
pinned inputs unchanged. Created, hired and local forces complete their
coastal routes with actual victories, casualties and saved continuation.
The helpers keep the mission commander in reserve, stabilize unconscious
survivors before strategic time resumes, select a physically reachable cache
carrier and inspect friendly remains through ordinary movement and look
orders. Paid care assertions use actual wounds, vacancies, hire quotes and
arrival receipts. Finite equipment and permanent deaths remain enforced.

These are bounded results. The full opening, later hospital return, complete
installed ending, final browser continuation and passing full release gate
remain open. The earlier unfiltered regression receipt is unchanged.
