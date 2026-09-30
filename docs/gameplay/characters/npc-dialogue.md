# Tactical dialogue interface

Special dialogue is independent of recruitment. Authored recruits, mission speakers, quest contacts (including completed quests), and explicitly marked special characters receive a compact portrait and choice panel over the tactical field. Existing appropriate portraits are reused; the sargento, posta contact and Belgrano currently use generic period portraits until dedicated art is provided. No art files were changed.

Ordinary civilians and enemies receive one short speech box, without conversation choices. Civilian work, danger and enemy surrender select suitable reply groups. Repeated requests vary the line without consuming the battle random generator. The box closes after ten seconds or with its close control. These lines are presentation only; they do not alter AP, ammunition, quests or enemy allegiance. No generative multi-turn conversation is added.

Click a civilian to address them. Press J, then select a visible adjacent person, to use the talk cursor, including on an enemy. J never dispatches a weapon action. Escape returns to movement or closes the special panel. A distant special character offers an actual movement order toward a neighboring tile; all conversation choices remain unavailable until range and other requirements are met. Movement can change the situation, and eligibility is checked again. Ordinary distant people give a player-facing range notice rather than a reply attributed to them.

The campaign checks visibility, consciousness, presence, range and the player control window. Only actual supported approaches appear. Completed delivery choices disappear. Recruitment, quests and Yatasto continue through the existing campaign reducer and retain their consequences. Closing or reopening a panel does not complete an encounter.

## Verification

Nine new model and component tests cover special versus ordinary classification, non-recruitable quest and mission characters, completed quests, unavailable speakers, hidden/distant targets, combat replies, independent reply variation, keyboard routing, portrait panels and speech boxes. The complete 1,450-test suite, typecheck, build and diff check pass.

A separate browser demonstration uses the production Battlefield and campaign reducers. A fresh officer physically approached the Retiro sargento. The new panel offered the uniform errand, delivered exactly ten textiles (240 to 230), removed the completed delivery option, and preserved the reply and quest through synchronized full save/load. Escape closed the panel and restored focus to the speaker. A controlled civilian fixture displayed two different short replies. A controlled adjacent-enemy fixture displayed a short refusal after J and click, with prepared load 1, twelve reserve cartridges and 100 AP unchanged. Screenshots confirmed the compact portrait/choices/text composition and the small standalone reply box.

## Reply replay and local recruitment

The special character panel includes **Repetir respuesta**, matching the replay control in the user's reference. It repeats that character's last authored reply. Before any exchange, it repeats the greeting. Each character keeps a separate last reply in the campaign save. Speaking to another character does not replace it. The control is subject to the same range, visibility, consciousness and peaceful-conversation checks as other approaches. Ordinary civilians and enemies retain their single speech box and do not gain conversation choices.

Replay changes no quest, recruitment, mission, goods, loyalty, time or combat state. It returns the text only, with current choices; a completed delivery or recruitment stays unavailable. Save validation bounds remembered text and rejects conversation dates later than the campaign clock.

**Preguntar por sus condiciones** now reports the first current recruitment blocker: the chosen speaker's leadership, liberated localities, local control, or the character's regional commitment. When those checks pass, the character says they are willing to discuss service. Recruitment remains a separate order. Cabral, Dorrego and Paroissien now have valid local eligibility in a fresh officer campaign; the missing entries previously made them permanently unavailable even after a valid meeting. Physical presence, leadership, recruitment state and contract checks still apply.

Five new simulation cases cover replay before and after quest completion, separate speakers, campaign/full save restoration, all three fresh local recruitments, direct-response requirements, mission report replay, unavailable speakers and malformed saved replies. A component check covers replay after quest completion and when conversation is unavailable. The live production dialogue preview on port 3014 offered the uniform errand at 240 textiles, repeated it without delivery, completed it once at 230, then saved, restored and repeated the acceptance with 230 textiles and the quest still complete. A second fresh campaign physically approached Cabral, received the ready-to-join response, recruited him through the panel, then restored the full campaign and tactical save with Cabral still present in the squad. The full 1,543-test suite, focused validation checks, typecheck, build and static export passed.

This does not establish full dialogue or JA2 parity. Threaten, trade, carried quest-object handoff, branching personal reactions and additional authored conversations remain separate work. Existing quest deliveries still use campaign goods.

## Physical delivery update

The textile-delivery browser records above are historical. The Retiro errand now requires two actual carried ponchos, handed over through the equipped-item cursor. Its conversation displays received progress and confirms the delivery after the items arrive. See [carried quest deliveries](carried-quest-deliveries.md) for current ownership, save and live evidence.
