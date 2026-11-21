# Assignment notices and strategic waiting

On the strategic campaign screen, explicit time advancement pauses when a soldier's assignment finishes or becomes blocked. This covers the assignment part of parity requirement A07 (time compression and event-driven pause triggers in the [parity requirements](../../requirements/ja2-parity.md)). The wider travel, contract-warning and production-event requirements remain open.

The original [JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed pages 39–42, describes assignments that cannot make progress and important events stopping time compression. The stopping conditions below are Granaderos adaptations of those choices.

## Player behavior

An explicit **Avanzar** order stops when a new assignment finishes or needs attention. This includes medical care, rest, firearm repair, practice, paired instruction and the existing finite militia course.

If an assignment is already blocked or complete, the first wait reports it before advancing the clock. Otherwise the game processes the entire hour in which the event occurs, including income, supplies, wounds, morale and enemy movement. A notice shows the person or course, the reason, and the actual hours advanced out of the requested hours.

The next explicit **Avanzar** order starts from the current hour. It acknowledges the previous notice and uses the duration currently selected. The unused hours from the earlier order do not run automatically. The same unchanged shortage or completed task does not stop every subsequent click. Productive recovery or a changed assignment permits a later attention event to be reported again.

Notifications do not change assignments, move people, refill supplies, restore health or grant training. A patient waiting behind another patient can still make progress with an available local doctor and does not generate a new blockage each hour. A normal practice point is progress; reaching the supported skill cap completes that practice assignment. Rest is complete only when it has no remaining health, energy, fatigue or personal morale benefit under the current rest rules. Clinical patient completion still means full health and no bleeding; further morale recovery can continue through deliberate rest.

## Clock and persistence boundaries

Early stopping applies only to explicit waits. Travel and tactical synchronization process their complete existing durations. They retain their ordinary status and log feedback; assignment stop notices do not apply to those command paths. Encounter and defeat controls retain precedence when an assignment event occurs in the same hour.

Saved attention data consists of a version, bounded task markers and the latest grouped notice. Markers use stable task bindings and reason codes rather than translated text. Old saves receive an empty attention record. Validation checks saved identities, codes, quantities and hours without requiring historical notice data to match a person's current assignment. The public campaign view exposes the notice and excludes internal suppression markers and task bindings.
