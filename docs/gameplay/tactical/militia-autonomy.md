# Autonomous local militia

During turn-based combat and reaction interrupts, local militia fight automatically under AI control while hired soldiers and temporary mission allies remain under player control (during peaceful tactical exploration, militia hold their posts or run autonomous patrols). Militia remain on the friendly combat side, share friendly visibility, and keep their own identity, equipment, wounds, supplies and combat experience.

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

## Limits

No tactical militia command menu, peaceful patrol system or strategic militia
medical assignment is included. Militia remain autonomous on the friendly side.

## Reproducible defense demonstration

Run `node tools/build-militia-demo.mjs` to create `artifacts/militia-defense-demo.json`, or provide an output path as the first argument. The builder validates the complete save and its deterministic simulation before writing it.

Open the separate QA campaign at `http://localhost:3000/?qa=1`, use Menú → Importar partida, and choose that JSON file. This replaces the QA campaign. The scenario is an explicit regression fixture: a legacy hired squad, three veteran militia, a scheduled defense request and an authored open field. It is not a fresh-player progression record or the normal Retiro map.

Press Fin del turno without issuing any soldier orders. All three militia then fight
automatically and win after six combat seconds. Each starts with six total rounds and finishes with four. The hired soldiers retain their positions, HP and ammunition.
