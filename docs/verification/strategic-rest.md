# Explicit strategic rest

Source: `807843a3f29750dc227423275f4b28c1371c35de`.
[Player guide](../gameplay/characters/strategic-rest.md).

Squad management now offers **Descanso** beside active service, doctor and
patient. It shows current energy, fatigue and progress. A resting person remains
in place, cannot march or deploy and cannot instruct militia. Rest uses the same
serving, safe, exact-cell eligibility as medical care. Other squads can travel
while the resting squad recovers.

Each actual safe hour restores energy and reduces fatigue. The reference need is
eight hours, plus 1/2/4 below 75/50/25 percent health and minus one for the authored
night-vision trait, bounded to 4–12. Recovery is `floor(96 / need)` energy and
`floor(64 / need)` fatigue per hour, capped at 100 energy and zero fatigue. This
is explicit Granaderos tuning, not historical physiology or full JA2 sleep parity.
There are no implicit historical-ID sleep profiles.

Patients also recover energy and fatigue while waiting for a doctor. Rest can
restore one health point after six continuous safe hours only when there is no
bleeding and health is at least 15. Partial hours survive saves. Reissuing the
same assignment preserves progress; changing assignments or losing safe presence
clears it without a grant. Existing supplied daily recovery remains unchanged.
Contract expiry clears the assignment and partial hours before that hour's work.

## Acceptance

Six simulation tests cover an exhausted doctor's rest and return to finite care;
six-hour healing with midpoint saves and repeated assignment; bleeding and critical
limits; patients without doctors; blocked deployment and militia work; cancellation;
prepared occupation; invalid saved partial hours; contract expiry; and one squad's
rest during another squad's actual twelve-hour march. Their initial exhaustion
and wounds are declared prepared state, not a claimed combat route.

The real injured-resident medical route now also rests the physician after actual
care expenditure. Energy improves without granting another dressing or changing
the patient's health. Dismissal, world re-entry and save retain the patient's
recovery. The mounted campaign test selects rest after actual treatment and a
paid dressing purchase, advances one hour, reads recovered energy/fatigue, saves
the rest assignment and returns the doctor to work.

Release checks: **827/827 tests**, zero failures or skips (205,713 ms); type
check; production export (722 files, 632 asset references); 36 baseline checks;
documentation audit (209 requirements, all 50 original and 87 parity rows,
48 evidence records); 159 changed-document local links. Exact-head GitHub CI
is required before merge.

## Limits

This accepts explicit rest and patient energy recovery. Automatic sleep/wake,
collapse, configurable individual sleep needs, fatigue-limited global energy
capacity, advanced marching effort and strategic bleeding remain open. The current
tactical and daily recovery are retained; this does not certify their advanced
parity. Critical military first aid, automatic bandaging, militia care and the
separate northern medical-relief failure also retain their own acceptance.
Simulation and mounted-DOM checks are not live-browser or performance acceptance.
