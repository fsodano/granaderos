# Loaded civilian breath recovery

Source: `8573561eddc9dcc1701d18fea13f68bb6bdb4586`.

An authored resident with zero energy remained unconscious indefinitely, even
with adequate health and actual time passing in its loaded sector. A living,
present resident now recovers ten energy after each civilian phase, up to 100.
That phase occurs once per completed combat round or six exploration seconds.
Recovery happens after the actor's movement opportunity, so waking cannot also
grant movement during that same phase. The ordinary next phase can resume its
routine, meeting or conversation.

Recovery changes energy and derived consciousness only. It restores no health,
dressings, action points or posture, does not erase injury attribution or stop
bleeding, and cannot wake a living resident below 15 health. Dead or departed
residents do not recover. A saved partial six-second interval retains its
progress; splitting elapsed time cannot duplicate a recovery step.

The campaign's existing identity acknowledgement preserves recovered energy
through active save, scene departure, later visits, local recruitment and return
after dismissal. Unloaded residents do not receive strategic recovery merely
because the campaign clock advances. Bulletin candidates keep their existing
off-map arrival policy and serving soldiers keep their separate recovery rules.

## Acceptance

Four new cases cover real harm history, waking after the phase without movement,
critical and dead residents, departed presence, the energy cap, split saved time,
actual combat/exploration clocks and a complete authored-resident route. The
route starts a healthy resident at zero energy through its content package,
spends ordinary paid hire and travel actions, observes initial incapacity, then
advances actual sector time. It saves and leaves at ten energy, advances six
strategic hours without an off-map grant, returns and hires the recovered person
through the normal adjacent conversation. Dismissal and another saved visit keep
the recovered energy; the authored starting value remains zero.

The finite-treatment case spends both carried dressings to stabilize a one-health,
zero-energy resident at 15 health. That treatment itself grants no breath. A
later ordinary ambient step restores ten energy and consciousness while keeping
the patient prone, the regained health unchanged and both dressings spent.

The focused NPC/condition group passes 26 checks; the care/civilian/synchronization
group passes 24 checks. These groups overlap and are not an additive total. The
final four-case recovery file passes after adding explicit damage attribution and
the complete stabilization/waking boundary. Release checks pass **858/858 tests**, zero failures or skips (205,715 ms);
type checking; production export (722 files, 632 asset references); 36 baseline
checks; and the documentation audit (215 requirements, all 50 original and 87
parity rows, 54 evidence records). Exact-head GitHub CI is required before merge.

## Limits

Ten energy per loaded phase is current Granaderos tuning, not a claim of exact
classic JA2 recovery thresholds. This delivery does not add unloaded civilian
simulation, automatic sleep, civilian fatigue capacity, medical responses or
physical kit custody. Prepared compact encounters isolate clock and harm
boundaries; the separate authored route uses normal campaign presence. Simulation
checks do not establish browser usability, frame rate or all-seed balance.
