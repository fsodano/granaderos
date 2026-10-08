# Healing patient cue and continuous visual clock

A paid heal order used the same unbound gesture for self care and an adjacent patient. The body also repeated its complete 1.4 s motion in both 300 ms prepare/result frames. In the public reach fixture, standing hands stay at least 0.632/0.655 m outside the patient torso bounds; prone hands stay at least 0.305/0.301 m outside them. Actual wrists stay at least 0.817/0.823 m from the standing torso skin and 0.521/0.506 m from the prone torso skin. This is a visible contact defect.

This groundwork carries an explicit self mode or a current admitted patient snapshot. An observed heal target receives its unit/NPC namespace in the recorder. The renderer requires one matching current body, matching saved cell/surface, finite placement and normal room readability. The cue refreshes posture, yaw, appearance, action and body heights from the current admitted visual. It retains no patient model or private future pose. A missing, hidden, ambiguous, mismatched or unperformed target supplies no patient cue. Self treatment carries no external body target; identical unit/NPC IDs remain distinct.

Only a matched accepted prepare/result pair for the same observed healer gets the continuous interval flag. That flag carries no patient state. Its native prepare range is 0–25%; its result range is 25–100%. The existing 1.4 s native motion therefore runs once in 350 ms + 1,050 ms. Direct gestures, cues without a phase, failed/unpaired orders and hidden actor intervals keep their prior clock behavior. The simulation remains authoritative: AP, finite dressings, healing, randomness, saves and the reducer result remain exact. The compiler adds only four heal action timings per anatomy. All other profile values, complete banks and the full manifest remain exact.

The timing change reduces measured standing hand peak speed in the ordinary fixture from 12.784/13.557 m/s to 1.971/2.054 m/s. The unchanged prone entry crossfade still reaches 3.902/3.863 m/s. Complete weighted prone arm/sleeve skin still reaches −59.4/−86.6 mm. No physical hand contact, natural prone support or floor clearance is claimed by this cue/clock cut. Those defects require the next native hand-path and bounded target-fit correction.

Focused checks cover accepted ally/self/NPC care; hidden and missing targets; duplicate identity; changed current patient posture/yaw/surface; invalid/unperformed/unpaired records; preserved direct clocks; and exact gameplay results. The patient fields are presentation only and never enter the save or action model.

```sh
node --test tests/three-healing-presentation.test.mjs tests/actor-animation-clock.test.mjs tests/three-presentation.test.mjs tests/three-melee-facing-presentation.test.mjs
node tools/characters-3d/compile-locomotion-profile.mjs --check
python3 tools/characters-3d/verify-library.py
npm run typecheck
```

The cut is based on main `12b281c5` (PR #263). Its six overlapping source files and original profile are byte-exact that main revision. A guarded installer applies only those source deltas, adds the test/review, then regenerates the current profile. It never copies an old bank, manifest or complete profile. The current-main installer and its repeat keep all native banks and full manifest exact.

Four normal HUD routes passed: standing and prone, male and female, with 24 saved images and no browser errors. Use the public “Vendas, recogida y liberación” scenario; select the doctor with `1` or `5`, centre the camera, then press Enter on the adjacent injured ally. Portrait activation while dressings are held treats that person; the number key selects the doctor. Saved doctor/patient cells are E7/E8 and Q7/Q8. Each doctor pays 6.25 PA through the ordinary HUD. The focused suite passes 31 checks; native verification, profile idempotence and types pass. Images retain the visible patient-contact and prone-arm-floor defects stated above.
