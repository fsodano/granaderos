# Sector arrival placement

Fresh hostile arrivals now open an overhead placement screen before the battlefield. Select a soldier or its squad, then select a highlighted cell on the actual approach edge. **Distribuir** spreads the arrivals automatically; **Quitar selección del mapa** and **Quitar todos** clear draft positions. **Entrar al sector** becomes available when all arrivals have positions.

The reference is the [JA2 Stracciatella placement implementation at a06f4896](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TileEngine/Tactical_Placement_GUI.cc). It supplies clear, spread, group and done controls, limits placement to insertion sides, and requires every selected arrival to be placed. Granaderos retains these rules with its existing sector geometry and campaign squads. The overhead terrain display is functional UI; this change does not replace artwork.

## State and costs

The browser requests interactive placement through the normal campaign handoff. Direct simulation and automatic resolution keep their existing automatic placement default. Peaceful visits, resident defenders and exact resumed encounters bypass the screen. Militia, mission allies, local civilians and bodies are not selectable arrivals.

Draft positions belong to `battle.deployment`, separately from the canonical campaign entry receipt. Selecting, clearing, spreading, saving and loading spend no AP, energy, ammunition, game time or random draws. Other tactical orders remain blocked. The screen shows terrain and the player's draft positions, with no enemy, civilian or loot markers. Hidden occupants do not alter the offered cells or draft result.

Arriving defenders receive their existing fort cover at the confirmed cell; fixed resident cover remains in place. Confirmation resolves each chosen position against actual occupancy on its own approach edge, then runs ordinary perception once. An occupied preferred cell uses the nearest free legal cell on that edge. Contact starts turn-based combat; no contact retains exploration and its normal energy/time costs. Immediate enemy initiative passes through the existing campaign clock synchronization before saving. A confirmed or resumed encounter cannot reopen the draft. The battlefield centers the selected arrival when it first opens.

Save validation checks the actual campaign members, approach receipts, squad manifest, legal terrain, duplicate positions and untouched encounter clocks. It preserves the existing requirement that a pending encounter has a matching battle snapshot.

## Verification

`sector-deployment.test.mjs` checks atomic drafts and rejection, fixed local actors, terrain restrictions, hidden-information independence, confirmation collision handling, exact JSON continuation and the 48-person limit. `sector-deployment-campaign.test.mjs` checks a fresh Retiro-only assault, full campaign saves, corrupt arrival receipts, peaceful/resident/resumed entry, and two real queued six-person squads entering from separate edges. Its controlled night-sight fixture checks immediate enemy initiative and the synchronized six-second clock; it is not an unmodified campaign encounter.

`sector-deployment-render.test.mjs` checks real component button events, group selection, clear/spread/confirmation, keyboard focus, eight squads shown six members at a time, the page launch switch and the four exposed tactical orders.

Live browser verification uses the production placement and battlefield components with the normal reducer, campaign handoff, clock synchronization and save encoder/decoder. The practice's first case hires two soldiers from a fresh Retiro-only start and issues the real Buenos Aires attack. The second case uses the established campaign fixture to queue two six-person approaches to San Nicolás; it does not establish that twelve soldiers were earned from a new campaign.

Live checks passed for mouse placement, arrow-key/Enter placement, incomplete and complete saves, group placement from south and west, named squad selection, clearing, automatic spread and confirmation. The six-person roster and all placement controls fit at 1280×720. After entry, the camera showed the selected soldier; one exploration step reduced Cabral's energy from 76 to 75 and kept exploration active. A saved confirmed encounter remained in the battlefield. The hidden-occupant and enemy-initiative cases are automated evidence.

The local practice is available at `http://127.0.0.1:3045/` while its preview server runs. It uses isolated in-memory practice state and does not read or replace the user's campaign storage.

The final complete suite passed **2,218/2,218 tests**, with no skips. Type checking and the production build passed; static export verified 960 files and 856 asset references. After the final compact-layout and initial-camera changes, all 18 arrival/tactical render checks and the repeated type/build checks passed. The live browser reported no errors or warnings.

## Remaining scope

This implements selected initial surface arrival positions. Mid-battle reinforcement placement, underground insertion, immediate following of a departing subgroup and a full Retiro-only winning campaign remain separate parity gaps. Map sizes, group spacing, terrain colors, nearest-free collision handling and existing fort-cover rules are Granaderos adaptations.
