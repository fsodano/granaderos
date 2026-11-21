# Sector arrival placement

Between strategic campaign travel and the tactical battlefield, fresh hostile arrivals open an overhead placement screen before the battlefield. Select a soldier or its squad, then select a highlighted cell on the actual approach edge. **Distribuir** spreads the arrivals automatically; **Quitar selección del mapa** and **Quitar todos** clear draft positions. **Entrar al sector** becomes available when all arrivals have positions.

The reference is the [JA2 Stracciatella placement implementation at a06f4896](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TileEngine/Tactical_Placement_GUI.cc). It supplies clear, spread, group and done controls, limits placement to insertion sides, and requires every selected arrival to be placed. Granaderos retains these rules with its existing sector geometry and campaign squads. The overhead terrain display is functional UI; artwork is separate.

## State and costs

The browser requests interactive placement through the normal campaign handoff. Direct simulation and automatic resolution keep their existing automatic placement default. Peaceful visits, resident defenders and exact resumed encounters bypass the screen. Militia, mission allies, local civilians and bodies are not selectable arrivals.

Draft positions belong to `battle.deployment`, separately from the canonical campaign entry receipt. Selecting, clearing, spreading, saving and loading spend no AP, energy, ammunition, game time or random draws. Other tactical orders remain blocked. The screen shows terrain and the player's draft positions, with no enemy, civilian or loot markers. Hidden occupants do not alter the offered cells or draft result.

Arriving defenders receive their existing fort cover at the confirmed cell; fixed resident cover remains in place. Confirmation resolves each chosen position against actual occupancy on its own approach edge, then runs ordinary perception once. An occupied preferred cell uses the nearest free legal cell on that edge. Contact starts turn-based combat; no contact retains exploration and its normal energy/time costs. Immediate enemy initiative passes through the existing campaign clock synchronization before saving. A confirmed or resumed encounter cannot reopen the draft. The battlefield centers the selected arrival when it first opens.

Save validation checks the actual campaign members, approach receipts, squad manifest, legal terrain, duplicate positions and untouched encounter clocks. It preserves the existing requirement that a pending encounter has a matching battle snapshot.

## Remaining scope

Selected initial surface arrival positions are supported. Mid-battle reinforcement placement, underground insertion, immediate following of a departing subgroup and a full Retiro-only winning campaign remain separate parity gaps. Map sizes, group spacing, terrain colors, nearest-free collision handling and existing fort-cover rules are Granaderos adaptations.
