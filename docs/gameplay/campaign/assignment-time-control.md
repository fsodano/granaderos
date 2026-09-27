# Assignment notices and strategic waiting

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Implemented for the current assignments. This covers the assignment part of parity requirement A07. The wider travel, contract-warning and production-event requirements remain partial.

The original [JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed pages 39–42, describes assignments that cannot make progress and important events stopping time compression. The stopping conditions below are Granaderos adaptations of those choices.

## Player behavior

An explicit **Avanzar** order stops when a new assignment finishes or needs attention. This includes medical care, rest, firearm repair, practice, paired instruction and the existing finite militia course.

If an assignment is already blocked or complete, the first wait reports it before advancing the clock. Otherwise the game processes the entire hour in which the event occurs, including income, supplies, wounds, morale and enemy movement. A notice shows the person or course, the reason, and the actual hours advanced out of the requested hours.

The next explicit **Avanzar** order starts from the current hour. It acknowledges the previous notice and uses the duration currently selected. The unused hours from the earlier order do not run automatically. The same unchanged shortage or completed task does not stop every subsequent click. Productive recovery or a changed assignment permits a later attention event to be reported again.

Notifications do not change assignments, move people, refill supplies, restore health or grant training. A patient waiting behind another patient can still make progress with an available local doctor and does not generate a new blockage each hour. A normal practice point is progress; reaching the supported skill cap completes that practice assignment. Rest is complete only when it has no remaining health, energy, fatigue or personal morale benefit under the current rest rules. Clinical patient completion still means full health and no bleeding; further morale recovery can continue through deliberate rest.

## Clock and persistence boundaries

Early stopping applies only to explicit waits. Travel and tactical synchronization process their complete existing durations. They retain their ordinary status and log feedback; this increment does not add assignment stop notices to those command paths. Encounter and defeat controls retain precedence when an assignment event occurs in the same hour.

Saved attention data consists of a version, bounded task markers and the latest grouped notice. Markers use stable task bindings and reason codes rather than translated text. Old saves receive an empty attention record. Validation checks saved identities, codes, quantities and hours without requiring historical notice data to match a person's current assignment. The public campaign view exposes the notice and excludes internal suppression markers and task bindings.

## Verification

The integrated logic suite passes 875 tests, excluding only the unchanged illustration-packing test file. Fifteen helper tests, 20 wait-integration tests and four notice-render tests cover exact medical and repair costs, supply exhaustion, skill caps, queued patients, blocked partners, militia completion, simultaneous events, deliberate continuation, repeated shortages, save/reload, information projection, travel duration and tactical clock synchronization. Existing cumulative-care scenarios issue further ordinary waits after a notice instead of assuming one request always consumes its maximum duration. The legal opening retains seed 8, the intended recovery interval, both victories and actual casualties.

Live browser verification used a fresh seed-19 officer and an ordinary march from Retiro to Buenos Aires. The march left fatigue 8 at hour 12. After assigning rest, a 24-hour wait stopped at hour 13 with fatigue 0 and a visible “1 de 24 horas solicitadas” notice. Health remained 78, energy 100, morale 80 and the rest assignment stayed in place. Reload retained the notice. Selecting six hours and pressing **Avanzar** advanced to hour 19, cleared the notice and retained the same personnel state. No troop-stat editing was used to prepare this check. Other assignment-specific browser flows remain covered by automated tests.
