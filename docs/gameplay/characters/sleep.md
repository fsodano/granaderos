# Sleep and automatic rest

On the strategic campaign screen, sleep is independent from a soldier's assignment. The personnel panel offers **Dormir / Despertar**. A sleeping doctor, student, instructor, repairer or militia trainer keeps the assigned task and its progress, but performs no work until awake. A player can wake a soldier early unless that soldier has collapsed from exhaustion. Fully rested soldiers cannot be ordered to sleep.

The classic manual describes a separate bed column, automatic sleep during downtime, manual waking, and slower recovery while idle (Map Screen assignments and Sleep, printed pages 38–40; [official manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf)). These are gameplay references for behavior.

## Granaderos rules

These numbers adapt the existing 0–100 energy and fatigue scales; they are not claimed as JA2 formulas.

- Safe, stable, nondeployed staff automatically sleep at 10 energy or less, or 80 fatigue or more. Patient and Rest already provide recovery and do not need automatic sleep.
- At 90 fatigue (the 10-point capacity floor), safe stable soldiers collapse into sleep. A halted onward march also causes collapse in members at the existing 80-fatigue travel threshold. Collapse prevents manual waking until maximum energy reaches 60 (fatigue at most 40). Ordinary low current breath alone does not set this restriction.
- The healthy eight-hour sleep profile restores 12 energy and removes 8 fatigue each hour. Individual profiles, wounds and night training change these rates as described below. Both full energy and zero fatigue are required to wake automatically. Work resumes in the following hour. Manual waking does not grant recovery.
- Idle, active staff restore 3 energy and remove 1 fatigue each hour in a safe sector. This does not restore health. Militia work is not idle time, including its completion hour.
- Doctors, practice, teaching, repair and militia work consume 3 energy and add 2 fatigue per productive hour. An hour that causes exhaustion does not also count as sleep.
- Sleeping staff can receive the existing slow natural recovery, one health point per six stable hours. Sleeping patients receive their existing patient care instead; Rest and Patient never receive two energy recoveries. Critical wounds still need medical care. Sleep does not stop bleeding.
- Explicit waits stop when automatic sleep starts, finishes or is interrupted by danger. An unchanged sleeping state does not repeatedly stop the clock. Other assignment problems can still produce their own notice.
- Sleeping soldiers block voluntary travel and deployment until awakened or left in another squad. Forced defense/withdrawal wakes them. Traveling and tactically deployed soldiers receive no strategic sleep recovery.
- Forced defense and danger can wake a collapsed soldier, but do not erase the need for recovery. After danger ends, that soldier sleeps again. Tactical wounds and fatigue still apply; strategic collapse does not invent unconsciousness in combat.
- Dead, captured and dismissed soldiers cannot retain sleeping or collapse service state. Boolean sleep and collapse state and transition notices are validated on load. Save/reload continues the same hourly results.

## Collapse and travel sources

The movement source handles exhausted soldiers after arrival in the next sector. The assignment source skips forced sleep while walking between sectors, makes an exhausted onward-travel group stop and sleep, and prevents manual waking after collapse until sufficient recovery. Mid-stage sleeping stops are therefore not part of classic parity.

Sources: [Strategic_Movement.cc, PlayerGroupArrivedSafelyInSector](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Strategic_Movement.cc), [Assignments.cc, sleep and travel checks](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Assignments.cc), [Assignments.h, maximum-breath thresholds](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Assignments.h). The 10-point floor and 60-point collapse recovery threshold follow the source. Granaderos retains its existing 80-fatigue onward-travel threshold, hourly travel costs and rest rates as explicit tuning.

On queued arrival, contact is resolved before sleep eligibility. No sleep recovery is awarded for the hour spent marching. The remaining route stays paused for an explicit resume order after recovery. Direct travel also stops and collapses exhausted members before another stage. A final arrival at the capacity floor can cause collapse without creating a new journey. Saves, player-known state and personnel controls retain the recovery requirement.

## Individual sleep needs

The classic source uses a character profile's sleep need, adds 1/2/4 below 75/50/25 percent health, subtracts night-operations and martial-arts trait levels, and clamps the result to 4–12. Its recovery rate is inversely proportional to sleep need. See [Assignments.cc, CalcSoldierNeedForSleep and RestCharacter](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Assignments.cc). These are game rules, not medical advice.

`game/sleep-needs.js` gives the Granaderos roster explicit base profiles from six to ten hours; unspecified profiles and the custom officer use eight. The assigned numbers are fictional game balance values, not claims about the historical figures. Existing `night_vision` training subtracts one hour. Wound thresholds follow the source's strict quarter-health boundaries, so exactly 75%, 50% and 25% belong to the healthier band. Granaderos has no supported martial-arts trait, so none is invented for this rule.

The current requirement is clamped to 4–12. Hourly rest removes `floor(64 / need)` fatigue and restores `floor(96 / need)` current energy, subject to the existing capacity ceiling. The constants retain the prior eight-hour baseline; they are a Granaderos adaptation. “Hours of reference” is the profile parameter, not a countdown promising that a soldier will finish sleeping after that duration. Actual completion still requires full energy and zero fatigue. There is no hidden fractional recovery balance.

All sleep and Rest/Patient recovery paths use the same personal rate. A sleeping Rest/Patient receives it only once. Treatment can improve the wound band before that hour's recovery. The personnel panel shows the base, wound increase, night-training reduction and current hourly values before sleep is ordered. Sleep and work status descriptions show the same values. The health bands and traits are derived from the soldier's saved state and restored roster; no new mutable sleep field or save migration is required.

This leaves existing waking, idle recovery, working-hour effort, travel effort and collapse thresholds in place. It does not reproduce the source's extra exertion and recovery multiplier below 50 maximum breath. The changing recovery duration is deliberate: for example, a severely wounded standard-profile patient gains eight rather than twelve energy per hour. A wounded collapsed traveler can therefore need longer than six hours before manual waking is allowed.

## Remaining work

A02 (rest, sleep, energy restoration and fatigue limits on work and marching in the [parity requirements](../../requirements/ja2-parity.md)) remains partial. Fatigue-limited energy capacity and hourly marching costs follow the rules in [fatigue](fatigue.md). Strategic collapse prevents immediate waking and premature route resumption. Vehicle-passenger sleep and a more detailed tactical collapse model remain open. Existing strategic Rest/Patient roles remain available.
