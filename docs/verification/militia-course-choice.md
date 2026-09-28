# Choose militia instruction

Runtime/test source: `d19cef1dfcc7780f46abb04d33652f1a927c1012`.

The campaign now lets the player choose between forming three new cívicos and
promoting three existing cívicos to montoneros. Existing soldiers no longer
force every new order to be a promotion. The initial selection retains the old
suggestion; an explicit choice remains selected while viewing that locality,
including after a course completes. Changing locality resets the suggestion.
This is a local screen preference; the actual paid course remains saved by the
campaign.

The screen displays the selected course's real price and duration and blocks an
order when funds, capacity, supply, instructor or stable participants are missing.
It explains the obstacle. New veteran tuition is still unavailable. The existing
city, loyalty, physician, deployment and course-cancellation rules remain in force.
The view uses the same ordinary campaign orders and quotes; it cannot bypass them.

## Verification

Two new mounted production campaign checks pass in an **11/11** overlapping
group, including the existing local-care, wounded-promotion and authored-rank
screens. Types and all 36 reference comparisons pass. Complete regression passes **976/976**, zero failures or skips
(232,876.653 ms), on the source above. Production export passes with 722 files
and 632 asset references. The documentation audit passes with 232 requirements
and 71 evidence records, retaining all 50 original and 87 parity rows.

The main check starts with an actually paid cohort and a real wounded soldier
stabilized with finite care. It selects another civic course, pays 60 pesos,
completes the actual hours and preserves the first cohort unchanged. It then
selects promotion, pays 120 pesos and reserves the original three soldiers.
The visible wounded participant and the saved completed montonero retain the
same identity, 43/60 health, weapon definition, remaining ammunition, wear and
inventory. The two resulting groups have distinct roles: three new cívicos and
three promoted montoneros.

A separate prepared low-treasury boundary starts with 59 pesos, pays and returns
from a real visit, then displays the shortage for each selected course. Clicking
the disabled control leaves the saved campaign unchanged. That budget is an
explicit fixture boundary, not a claim that combat or training produced it.
Existing checks retain unstable-participant rejection, finite physician work,
course cancellation, actual instruction hours, capacity, supply interruption and
saved trainees.

The course panel is separated from the surrounding campaign component to keep
its selection and eligibility presentation together. These are mounted DOM
checks, not live-browser acceptance or performance measurements.

Exact-head GitHub CI remains required before merge. Prices, durations, cohort
size, allied autonomy, city redistribution and advanced defense routes remain
separate requirements.
