# Strategic nervous isolation — 2026-10-05

This bounded V06 change extends the existing explicit `nervous_isolation`
ability. Fresh Ángela Cejas content already opts in. Older pinned definitions
that omit the ability stay neutral. Personality prose cannot enable it.

## Actual consequence

An awake, capable, serving actor below 50 morale loses up to one personal
morale point at an actual strategic hourly transition without military
companionship. A moving actor needs a capable serving member of that exact
party. Another party at the stored origin does not count. A stationary actor
can receive support from a capable stationary operative in the same actual
world cell, across squads. A paused route is stationary at its admitted cell;
a ready assault is at its completed target, not its still-stored origin.

The first loss can occur at the next actual hourly transition. Continuous time
uses whole-clock-hour boundaries; a whole-hour wait retains its current
seconds. No full initial hour of isolation is required. Later positive
losses require at least 3600 actual seconds since the last positive loss.
An uninterrupted episode can lose at most 20 points. Its active condition
also stops morale recovery from rest or patient assignment. Medical healing,
energy recovery, finite supplies and other ordinary systems still operate.
Sleep, incapacity, higher morale, expiry and deployment pause new losses;
they do not reset the episode. Deployed actors neither receive this strategic
charge nor provide offscreen support based on stale issued health.

Real capable regrouping at a subsequent hourly transition clears the episode
budget. It refunds no morale. Pure inspection, imports and loads do not clear
or apply it. The first actual positive loss writes one named campaign-log
message per episode. It is authored text, not recorded speech or a new popup.

The optional personal receipt is
`strategicIsolation:{loss,lastHour,lastSecond?}`. Loss is finite and positive,
at most 20; the last charge cannot be in the future. The capability must exist
in the pinned definition. Fractional final losses are valid. Historical
receipts remain valid after expiry or injury. No zero-loss receipt is created,
and no new field is added to old records merely by loading them. The receipt
stays strategic; tactical issue receives the actual lower personal morale.

## Source boundary

The [pinned Stracciatella morale implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/04869c8e339ead1de9fefb25b7ad206b9b786825/src/game/Tactical/Morale.cc#L154-L195)
distinguishes a solitary moving squad from an offscreen stationary actor with
no same-sector teammate. It limits a short-term modifier and records a
personality quote once. Granaderos uses its own hourly cadence, personal
morale loss, capability checks, exact-time receipt and episode reset. The
one-point loss and 20-point budget are explicit game tuning. This is not
exact classic morale parity or a medical model.

## Evidence and limits

The new subsystem cases declare initial low morale and secured travel context.
They prove bounded rest, fractional timing, actual queued travel/timed return,
separate parties, completed assault targets, real sleep, exact paid expiry,
strict optional receipt admission and deployment exclusion.

The independent paid route reuses the explicitly declared seed42 clinical
arena and its original pre-kinetic Brown Bess profile. Actual hostile wounds,
a real miss, finite first aid, retreat and captivity earn Cejas's 43.7 personal
morale. No executed health, equipment, RNG, cash or outcome is assigned. A
separate initial omission control executes the same legal orders. This is
a bounded prepared-arena acceptance, not a fresh kinetic opening, conquest or
complete stock-campaign proof. The fresh kinetic acceptance remains separate.

The paid run keeps eight actual personal morale losses: 43.7 becomes 35.7.
Sosa's paid six-hour arrival supplies companionship before that hour's morale
transition; regrouping clears the episode without refund. The ordinary paid
renewal then gives 37.7 versus the omitted control's 45.7. An actual partial
reload, nearby regroup, new turn, completion, scout movement and look permit
a loaded observed hostile shot. That far shot is clamped at 1 percent in both
branches. It spends 7 PA, one cartridge and one condition point with the same
RNG progression. The discharge adds zero seconds because the current combat
round has already paid its time; preceding turn/action time remains real.
It is not evidence of a lower native rounded chance. A separate pure declared
three-cell flat lane, using the earned actor records, shows 64 versus 65
percent. It neither fires nor modifies the paid route.

Both 48-order histories replay through official paired saves. Final treasury
is 3032 pesos after paid 36/60/36/36-peso service costs. Actual return/reentry
keeps personal morale 32.7 versus 40.7, six Cejas rounds, ten Sosa rounds and
nine confiscated Acosta rounds. Guard care uses Acosta's actual two dressings;
no captured health or supply is reset. Existing tactical fear acceptance keeps
its original 43 orders, with five earned strategic losses before its real
replacement arrival and the corresponding lower second-deployment morale.

Underground fear, wider evolving opinions, prolonged panic, early departures,
other notice paths and recorded character voices remain open. This change
adds no renderer, cannon, 3D asset, shop or modern equipment work.

## Frozen validation receipt

The candidate is based on `2bd8bb50f1910303433b53a7eaf7e69c979ba682` in
the isolated `codex/strategic-isolation` worktree. The exact production source
SHA256 is `c9cf0cf71bf5a3c43f9b4e0ced1d2e0ee104aeec833af4d7dea134509772da01`.
The 885 test/support paths have SHA256
`827376bdb47c98affa752c9cff6ee8febf7931b11cc130a2cdc57488b415fec7`.

- The 11-file affected check closed with 148/148 passing tests and no failed,
  skipped or cancelled tests.
- The complete, unfiltered short-suite process closed with 4938/4938 passing
  tests and all 709 selected files finished. Its report has `complete:true` and
  zero failed, skipped, cancelled or todo tests. The unchanged partition is
  717 total files: 709 short and eight existing extended files. The extended
  campaign routes were not run for this bounded change.
- Typecheck, production build, documentation and baseline audits, shard
  self-test, shard coverage/partition checks and diff checks all closed with
  exit status zero. The static export checked 1133 files and 1033 asset
  references and identifies this same `c9cf0cf71bf5` production source.

The preserved first affected diagnostic is
`/tmp/granaderos-strategic-isolation-affected-final.log` (145/148, with three
test-only metadata/disclosure failures). The corrected affected receipt is
`/tmp/granaderos-strategic-isolation-affected-corrected.log`; the complete
short-suite log is `/tmp/granaderos-strategic-isolation-quick.log` and its
machine report is `.cache/test-times/quick.json` in the isolated worktree.
Earlier paid scout/reload diagnostics remain in `/tmp`; the accepted route
does not force a hit or substitute the controlled forecast for paid actions.
The frozen input manifest is `.cache/strategic-isolation-inputs.json`.

These receipts establish this bounded behavior and save compatibility. They
do not establish a complete native campaign, fresh kinetic clinical outcome,
recorded character voice or full video parity.
