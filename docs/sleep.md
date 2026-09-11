# Sleep and automatic rest

Sleep is independent from a soldier's assignment. The personnel panel offers **Dormir / Despertar**. A sleeping doctor, student, instructor, repairer or militia trainer keeps the assigned task and its progress, but performs no work until awake. A player can wake a soldier early. Fully rested soldiers cannot be ordered to sleep.

The classic manual describes a separate bed column, automatic sleep during downtime, manual waking, and slower recovery while idle (Map Screen assignments and Sleep, printed pages 38–40; [official manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf)). These are gameplay references, not instructions to the implementation agent.

## Granaderos rules

These numbers adapt the existing 0–100 energy and fatigue scales; they are not claimed as JA2 formulas.

- Safe, stable, nondeployed staff automatically sleep at 10 energy or less, or 80 fatigue or more. Patient and Rest already provide recovery and do not need automatic sleep.
- Sleep restores 12 energy and removes 8 fatigue each hour. Both full energy and zero fatigue are required to wake automatically. Work resumes in the following hour. Manual waking does not grant recovery.
- Idle, active staff restore 3 energy and remove 1 fatigue each hour in a safe sector. This does not restore health. Militia work is not idle time, including its completion hour.
- Doctors, practice, teaching, repair and militia work consume 3 energy and add 2 fatigue per productive hour. An hour that causes exhaustion does not also count as sleep.
- Sleeping staff can receive the existing slow natural recovery, one health point per six stable hours. Sleeping patients receive their existing patient care instead; Rest and Patient never receive two energy recoveries. Critical wounds still need medical care. Sleep does not stop bleeding.
- Explicit waits stop when automatic sleep starts, finishes or is interrupted by danger. An unchanged sleeping state does not repeatedly stop the clock. Other assignment problems can still produce their own notice.
- Sleeping soldiers block voluntary travel and deployment until awakened or left in another squad. Forced defense/withdrawal wakes them. Traveling and tactically deployed soldiers receive no strategic sleep recovery.
- Dead, captured and dismissed soldiers cannot retain sleeping service state. Boolean sleep state and transition notices are validated on load. Save/reload continues the same hourly results.

## Verification and remaining scope

`tests/sleep.test.mjs` covers campaign orders, work interruption/resumption, recovery rates, militia progress, forced defense, travel, unsafe sectors, lifecycle cleanup and save continuation. `tests/sleep-render.test.mjs` checks independent controls and preserved assignment display. Existing assignment-wait and medical-care tests cover the affected timing rules.

Audit A02 remains partial. The follow-on `fatigue.md` implementation adds fatigue-limited energy capacity and hourly marching costs. Individual sleep requirements and a fuller collapse/recovery model remain open. Existing strategic Rest/Patient roles remain available. This increment does not claim full JA2 parity.

### Browser check — 2026-09-11

In the local game with separate QA storage, imported a campaign with Cabral practicing mechanics at 76 energy / 16 fatigue. Clicked Dormir, requested six hours and confirmed a stop at hour 2 with 100 energy / zero fatigue, the same practice assignment and no practice credit. Advanced one working hour, ordered sleep again, then opened a fresh page and continued the saved campaign. Cabral remained asleep at hour 3 with 97 energy and his assignment selected. Manual wake followed by one hour resumed practice at 94 energy, showing 3/40 accumulated mechanics credit. The checked page reported no warning or error logs.

Validation: all 1,045 repository tests passed in the isolated gameplay checkout, along with type checking, production build and whitespace checks. The build exported 278 files with 189 verified asset references. Concurrent art and recruitment edits were excluded from this verification and commit.
