# Autonomous local militia

Local militia now fight under AI control. Hired soldiers and temporary mission allies retain player control. Militia remain on the friendly combat side, share friendly visibility, and keep their own identity, equipment, wounds, supplies and combat experience.

## Source and adaptation

The classic team sequence refreshes the active team and gives the player interface to `OUR_TEAM`; other active teams enter the AI list. See [JA2 Stracciatella, TeamTurns.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/TeamTurns.cc), `BeginTeamTurn` and `EndAITurn`.

Granaderos retains its existing two-side allegiance and 100-point AP system. It adds an autonomous militia queue after the enemy phase in a normal round. In enemy-first combat, militia act after the hired player's response and before the next round. These phase and AP details are adaptations, not a claim of exact engine equivalence.

## Combat and control

- Militia choose ordinary combat actions from their own awareness and equipment. When there is no contact in combat, they use the same bounded waypoint search as auto-resolve. Search routes exclude unseen opponents and do not use their positions as goals. Reloading, shooting, movement, medical aid and melee use normal costs and finite supplies.
- Militia use remaining AP during an interrupt. A mixed window still gives the player control of eligible hired soldiers. Militia-only windows complete automatically.
- Enemy reactions can interrupt a militia action. A further hired-soldier interrupt retains its parent reaction and the paid militia progress. Saving and loading resumes that same sequence.
- Direct militia orders and group movement are rejected before mutation. The interface shows militia status. An equipped dressing kit can still target a wounded militiaman, and hired soldiers can transfer supplies to militia.
- Local militia keep their post during peaceful exploration. Automatic bandaging does not issue orders to militia doctors. Combat AI may perform its own medical actions.
- Auto-resolve uses the same autonomous turn. Its manual-order counter excludes AI orders. On timeout, hired troops attempt physical withdrawal while local militia continue defense; unresolved combat stays available.
- Routed militia use the existing paid escape or surrender rules. Campaign return retains casualties, wounds, ammunition and earned promotions.

## Verification

Focused tests cover autonomous actions, finite reloads, mixed and nested interrupts, corrupt continuations, full campaign save/load, time accounting, promotion through actual combat, auto-resolve, manual-control rejection, support from hired soldiers, and rendered status controls.

The final isolated regression run passed all 1,232 tests. Type checking, the production build and `git diff --check` also passed. The isolated checkout excluded concurrent art and recruitment edits. Live training and control checks passed as detailed below; automatic combat remains unverified in the browser. No tactical militia command menu, peaceful patrol system, or strategic militia medical assignment is included.


## Live control verification — 11 September 2026

The existing `http://localhost:3000/?qa=1` campaign was used through normal controls. It contained Kerr and no garrison. No ordinary campaign storage was changed.

- Rested Kerr, selected En servicio, and paid 60 pesos for three new defenders. A 24-hour wait stopped at his contract warning. Paid a one-week renewal, then a six-hour request stopped after the remaining three training hours. The completed course took 22 working hours and produced three cívicos.
- Entered Retiro and paused exploration. All three militia status cards appeared under Guarnición local. Their IDs were 20000–20002; each had 60 HP, one loaded round and five reserve rounds. Only Kerr appeared in the hired squad strip.
- Clicked a militia figure on the map. Kerr remained selected. The garrison cards offered no manual selection buttons.
- Equipped Kerr's dressings. The garrison panel changed to Vendar a targets. Clicking a healthy militiaman kept every position and HP value unchanged and retained Kerr's two dressings. The game rejected unnecessary treatment.

The native file picker could not be operated because the computer-use tool denies control of the Codex app. Consequently, the controlled combat save below was not imported or tested live. No claim of browser combat, nested interrupts, casualty return or reload persistence is made by these checks.

## Reproducible defense demonstration

Run `node tools/build-militia-demo.mjs` to create `artifacts/militia-defense-demo.json`, or provide an output path as the first argument. The builder validates the complete save and its deterministic simulation before writing it.

Open the separate QA campaign at `http://localhost:3000/?qa=1`, use Menú → Importar partida, and choose that JSON file. This replaces the QA campaign. The scenario is an explicit regression fixture: a legacy hired squad, three veteran militia, a scheduled defense request and an authored open field. It is not a fresh-player progression record or the normal Retiro map.

Press Fin del turno without issuing any soldier orders. In simulation, all three militia fight automatically and win after six combat seconds. Each starts with six total rounds and finishes with four. The hired soldiers retain their positions, HP and ammunition. These expected results remain to be confirmed in the live browser.
