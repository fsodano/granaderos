# Tactical dialogue interface

Special dialogue is independent of recruitment. Authored recruits, mission speakers, quest contacts (including completed quests), and explicitly marked special characters receive a compact portrait and choice panel over the tactical field. Existing appropriate portraits are reused; the sargento, posta contact and Belgrano currently use generic period portraits until dedicated art is provided. No art files were changed.

Ordinary civilians and enemies receive one short speech box, without conversation choices. Civilian work, danger and enemy surrender select suitable reply groups. Repeated requests vary the line without consuming the battle random generator. The box closes after ten seconds or with its close control. These lines are presentation only; they do not alter AP, ammunition, quests or enemy allegiance. No generative multi-turn conversation is added.

Click a civilian to address them. Press J, then select a visible adjacent person, to use the talk cursor, including on an enemy. J never dispatches a weapon action. Escape returns to movement or closes the special panel. A distant special character offers an actual movement order toward a neighboring tile; all conversation choices remain unavailable until range and other requirements are met. Movement can change the situation, and eligibility is checked again. Ordinary distant people give a player-facing range notice rather than a reply attributed to them.

The campaign checks visibility, consciousness, presence, range and the player control window. Only actual supported approaches appear. Completed delivery choices disappear. Recruitment, quests and Yatasto continue through the existing campaign reducer and retain their consequences. Closing or reopening a panel does not complete an encounter.

## Verification

Nine new model and component tests cover special versus ordinary classification, non-recruitable quest and mission characters, completed quests, unavailable speakers, hidden/distant targets, combat replies, independent reply variation, keyboard routing, portrait panels and speech boxes. The complete 1,450-test suite, typecheck, build and diff check pass.

A separate browser demonstration uses the production Battlefield and campaign reducers. A fresh officer physically approached the Retiro sargento. The new panel offered the uniform errand, delivered exactly ten textiles (240 to 230), removed the completed delivery option, and preserved the reply and quest through synchronized full save/load. Escape closed the panel and restored focus to the speaker. A controlled civilian fixture displayed two different short replies. A controlled adjacent-enemy fixture displayed a short refusal after J and click, with prepared load 1, twelve reserve cartridges and 100 AP unchanged. Screenshots confirmed the compact portrait/choices/text composition and the small standalone reply box.

This does not establish full dialogue or JA2 parity. Threaten, trade, carried quest-object handoff, branching personal reactions and additional authored conversations remain separate work. Existing quest deliveries still use campaign goods.
