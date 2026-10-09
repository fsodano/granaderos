# Playtest feedback — 2026-10-03

This is a chronological record of feedback and requests, not a record of implemented changes. Firm requests are separated from suspected causes and tentative ideas. Existing mechanics are noted as such rather than listed as missing work.

## Feedback, in order received

1. **Unit portraits:** The bottom-of-screen unit portraits feel too small and are cropped. Request: make them larger and ensure each portrait is fully visible.

2. **Inventory toggle:** Right-clicking a mercenary opens their inventory. Request: when that inventory is already open, right-clicking the same portrait should close it.

3. **Remove announcements:** Request: remove the floating diary/combat log and the enemy-contact and turn-combat announcements.

4. **Action failure feedback:** When a destination is blocked or the unit lacks AP, request: show a small cross at the attempted destination rather than a text notification.

5. **Stable layout:** Feedback panels should not push the UI down or otherwise shift the layout.

6. **Character visibility:** Characters sometimes disappear while moving or changing direction. Directional sprite loading is only a suspected cause, not a confirmed diagnosis. Request: keep characters visible throughout movement and direction changes.

7. **Preview AP before committing:** Request: show the AP cost before committing to movement, stabbing, punching, or firing. For movement, a live footstep route to the hovered destination should show the traversed cells and total AP cost.

8. **Movement-mode cursor:** The cursor should show icons for walk, run, crouch, and prone, together with AP cost. A solid white indicator means the action is doable; a blinking black-and-white indicator means there is insufficient AP. Yellow indicates stealth (via Z), **not** invalidity.

9. **Inventory reference and status indicators:** The inventory reference consists of 8 small pockets, 4 big pockets, and 2 hands; a male/female body figure with arrows to equipment; headwear, jacket, and pants slots; no face slots; carried weight; and no camouflage. Status colors: red for remaining HP, pink for treated/non-bleeding wounds, yellow for untreated wounds, blue for energy, and green for morale. At zero HP the character is dead/out of combat, with a small blood animation.

10. **Tentative equipment idea:** Replacing Camo with equipment-based morale boosters is a tentative idea only, not a defined mechanic or firm request.

11. **Inventory and overall interface:** Request: hover tooltips identify items; stack counts are visible; and previous/next character arrows are available inside the inventory. The whole interface should fit on one screen while retaining useful strategic information density. A 640x480 reference is inspiration for compactness, not a mandatory resolution. Toolboxes and extra item types mentioned or shown are unconfirmed and are not requirements.

12. **Weapon hands and condition:** Two-handed weapons occupy both hands. Item bars show condition, except ammunition bars show remaining ammo. Low condition may make an item unusable or cause malfunctions; exact thresholds and consequences remain TBD.

13. **Item-specific malfunctions and grenade status:** Request: support item-specific malfunctions, including a gun jam, with a small “Gun jammed” feedback popup that does not shift the UI. Grenades are already present in the browser game as **“Granada de arsenal”**, bought in the armory and not implicitly issued. The current `game/tactical.js` logic (lines 1624–1640) already supports condition-based duds becoming unusable ground objects. Do not describe grenades or dud handling as missing features, or treat reference imagery as a request to add grenades.

14. **Environment and minimap:** Request: hidden building walls and doors remain readable through outlines, and small environmental lights are present. The minimap should show the sector code/name and day/time.

15. **Toolbar controls:** Requested toolbar actions include grab/interact, turn left/right, talk, line-of-sight preview, and stance up/down for standing/crouch/prone. Skip ladder/climbing and extra mouth icons for now. Exact icon identities in the reference were partly speculative.

16. **Newest feedback — interiors:** Current character graphics are okay. Indoor houses/locations look too empty. Request: richer furnished interiors with visual detail, surfaces, and props comparable to the reference screenshots. Modern appliances, bazookas, and vending machines are visual references only, not instructions to add modern items to this historical game.

17. **Contextual dialogue and tactical HUD:** Request: spontaneous contextual character dialogue/banter, such as reacting to a spotted enemy, as in the Fusty reference. Clarification of item 3: remove the permanent large text blob, not brief useful enemy-in-sector or faint movement/noise-direction hints. Hints and chatter should appear and then disappear; timing/duration is unspecified. The reference also shows a top green player-turn bar and a compact, browser-fit tactical HUD with six mercenary panels plus minimap, each unit's visible-enemy count, a selected-unit indication, held items, and an end-turn button. Squad switching is low-frequency and was initially doubted, but is probably needed: this is tentative, not deleted and not a firm six-unit-only campaign limit. An icon to return to tactical view is requested; the triangle reference's precise navigation target is not fully clarified. Prefer compact meaningful controls over many large text buttons or excessive controls.

18. **Carmen conversation and dead portrait:** The Carmen conversation screenshot is an example of a pleasant timber cabin with stones and pines as richer environmental detail. Request: a dead mercenary portrait should show a skull and no misleading remaining-health display. NPC conversation options should include repeat/“come again,” friendly, direct, threaten, recruit, and exit/done as shown in the reference; dialogue should depend on the NPC, location, and quest/progression context. Capture these as requested concepts, not verification of existing mechanics.

19. **Wall occlusion readability:** The example shows obstructing walls becoming transparent/cut away when viewing an interior, with furnishings and mercenaries visible behind foreground walls; it also shows visibility around a closed door. Request: retain understandable wall/door boundaries through translucency or outlines. Exact gameplay line-of-sight and fog-of-war rules are unspecified. This is a rendering/readability reference, not authorization to reveal enemies through opaque walls.

20. **Richer graphics and environment:** Request: more environmental detail overall. Interiors, including ruined rooms, should feel deliberately furnished/structured, with kitchen- or bathroom-like layouts; also improve the visual treatment of windows, shadows, varied tree sizes, stones, and vegetation. Existing character art is still okay. Modern refrigerators and similar objects illustrate visual richness, not a request for anachronistic historical items.

21. **Character reactions and visual references:** Reiterating the references for richer furnishings, varied terrain types, and dialogue presentation, the user says occasional spontaneous character reactions are an important source of personality and fun—for example, when a mercenary spots an enemy, is nearly shot, is hit, or experiences a similar combat event. This extends item 17; avoid making every event trigger repetitive chatter.

22. **Interrupts, AP visibility, and skill feedback:** The interrupt reference shows a compact top interrupt banner (yellow in the supplied reference) and occasional related character dialogue, not dialogue on every interrupt. Request: show remaining AP clearly for each unit in the HUD (the example shows Nails at 19 and Wolf at 0), supporting player cost arithmetic. The user strongly likes the reference's precise placement and compactness. A brief notification on gaining a skill point, such as marksmanship, is also requested as shown in the reference. These are requests/examples, not verification of current mechanics; the fixed-layout/no-shift requirement still applies.

23. **Skill learning correction:** Skill progression should not be represented as an unmet-prerequisite checklist for unlocking skills. Skills are learned by doing/repetition, with Wisdom affecting the rate/chance: smarter characters learn faster; low Wisdom slows learning and may mean no learning. Exact Wisdom formula/cutoffs are unspecified. A skill below 35 is ineligible to be learned or improved; zero means no competence and cannot learn. The threshold is strictly below 35, so 35+ is eligible subject to other learning factors. Do not invent a prerequisite menu or guaranteed skill gains. Examples: repeated shooting trains marksmanship, and hits provide an additional improvement chance; repairs train the relevant repair/mechanical skill; bandaging/treating people trains medicine. Gunpowder-related skills might train through handling cannons/explosives, but the precise relevant actions/equipment are tentative and unspecified. Do not infer a new cannon implementation, substitute quest/achievement progression, or invent numerical chance formulas. The zero-skill comment does not authorize broad new combat-action restrictions beyond these learning rules.

24. **Occluded character visibility:** Reiterating the wall-occlusion example, mercenaries behind foreground walls/sections should remain visible via partial transparency, translucent silhouettes, or ghosting rather than disappearing. This complements item 19: retain readable wall boundaries and the visible location of known characters. This is visual occlusion handling, not an instruction to bypass actual fog-of-war or gameplay sight rules.

25. **Explosion and corpse references:** The explosion screenshot is a visual reference for how explosions look, not proof that the user has seen one in this game and not a request for modern explosives, cars, or weapons. Dead enemies should read clearly as corpses rather than dying/downed: bodies lying on the ground with a little blood or a blood stain, possibly varying by cause of death. Cause-specific appearance/details are unspecified. Keep this distinct from dead-character skull portraits and HP mechanics in item 18. Existing grenade mechanics remain as recorded in item 13; this is not a request to add grenades.

26. **Ground-item markers and input intent:** Show only one representative visible item/loot marker per grid cell even when multiple items occupy it; preserve the underlying items rather than deleting or merging data to reduce visual clutter. The example screenshot shows a toolbox/gun. Ctrl indicates pickup/grab intent, and Ctrl-clicking a cell attempts to take its item. Holding Shift while clicking/moving to a cell means move there and stand over it without picking up the item. Default unmodified-click behavior, automatic pickup, modifier-combination priority, new AP formulas, and item selection from a multi-item cell are unspecified; do not invent them.

27. **Per-mercenary enemy count reaffirmed:** Each mercenary should display how many enemies they personally currently see. This is a per-unit visible-enemy count, not one squad-wide or sector-total number. This was already captured in item 17; the explicit repetition is retained because the user was concerned it had been lost.

28. **Blood for both sides:** Reaffirming item 25, deaths of both player characters and enemies should leave clearly readable bodies and blood stains. The factory reference illustrates this; it is not a request to copy its modern equipment into the historical game.

29. **Inventory item inspection and attachments:** Right-clicking an item inside a character's inventory should open its explanation/description and relevant item details. For compatible weapons, provide one bayonet attachment slot; other attachment types are not requested. This is separate from right-clicking a character portrait to toggle the inventory. The detail view should retain the compact, stable layout requested earlier.

30. **One marker per occupied cell reaffirmed:** Separate occupied cells each get their own representative ground-item marker. One marker may stand for multiple items in that cell; do not collapse adjacent cells into one marker. Ctrl-click explicitly attempts pickup. Holding Shift while moving/clicking the destination means walk onto that cell without taking anything. This repeats and clarifies item 26 rather than introducing different controls.

31. **Enemy highlighting:** Make visible enemies easy to identify through a glow or strong highlight; the supplied Shadow/Yuki reference shows bright red silhouettes. The user thinks this may happen during the player's turn but is unsure, so the exact trigger/timing remains unconfirmed. This is a readability reference, not a request to reveal enemies outside the player's actual visibility.

32. **Strategic squad management and travel — must-have:** A strategic roster/map screen is an absolute must. The roster should show each character's name, squad/assignment, sleep/rest status, current location, and destination. Clicking the destination field should let the player choose where to send the selected characters/squad on the map, with a proposed route, travel ETA, and transport mode shown. Available transport modes and precise travel/rest rules remain unspecified; the modern reference's vehicles are not requests for anachronistic transport. This extends the compact browser-fit interface requirement, not a request to implement changes during feedback collection.

33. **Roads, horses, and assignments:** Roads shown on the strategic map should enable faster travel, and horses should speed travel compared with walking; exact modifiers are unspecified. Clicking Assignment should let the player choose a person's activity: on-duty/squad membership, doctor/patient, repair, training a selected subject, or transport/vehicle assignment with a choice of available transport. The screenshot shows Doctor, Patient, Vehicle, Repair, Train, and Cancel. Record these as UI concepts without inventing activity formulas, eligibility gates, modern vehicles, or a new transport catalog. Horses are an explicit travel-speed request extending item 32's previously unspecified travel modes. Sleep/rest remains as recorded in item 32.

34. **Contract renewal and departure UI:** The contract UI should follow the reference closely. A permanent/player-created character (for example, Fab) has no contract-based departure; hired mercenaries show the remaining time until departure (for example, Lynx has six days in the reference, not a fixed rule for every mercenary). Clicking contract/departure should offer one-day, one-week, or two-week renewal with clear prices; unaffordable choices should be greyed out and unavailable. The reference also shows Dismiss/Cancel. The interaction request is firm, but this is not verified as implemented. Permanent means no contract-expiry departure, not immunity to all possible narrative or death outcomes.

35. **Recruitment price balance:** Current hires feel far too cheap. Rebalance upward relative to starting funds so hiring choices and budget matter instead of cheaply hiring a large roster immediately. The user's current reference balance is about 18,000; they recall the initial amount may be about 30,000 but are uncertain. These are not approved exact starting-budget values or a new price schedule. Three hiring/contract-price screenshots are examples, not fixed historical-game amounts. Preserve differing recruit prices and a visible total contract cost. Exact tuning, target starting squad size, discounts, equipment, and medical-deposit policies are unspecified.

36. **Recruitment personality and contact presentation:** Opening/contacting a recruit should show a short, characterful phrase/greeting while the player evaluates skills and decides whether to hire. Era-appropriate alternatives remain open/tentative: (A) send a letter and receive an in-character reply, or (B) meet/contact the person at a local pub or other recruitment source and show an in-person phrase. The user has not chosen the source/location; do not require both alternatives. “Voice” here means personal, characterful wording, not mandatory audio/TTS, an AI dialogue system, video call, or modern videoconference from the screenshot.

37. **Continuous time compression and event interrupts:** Request: continuous accelerated simulation with run/pause/speed controls, not buttons that skip fixed ten-minute, two-hour, or day chunks. Automatically stop/pause on important events so the player can assess and resume: a sector is attacked; medical/bandage supplies run out and healing cannot continue; someone gains/learns a skill; militia training finishes; or a mercenary group arrives at a new sector. Exact speeds/time multipliers and other interrupt policy details are unspecified; no implementation or math decisions are defined. Explain the interrupt cause with useful feedback and retain the stable-layout requirement.

38. **Strategic log and waypoint confirmation:** The user likes a fixed bottom-left strategic history/event log. Clarification of items 3 and 17: remove the obstructive floating tactical diary/text blob, not all logs everywhere; a strategic log is wanted. While plotting travel, the first click sets a proposed waypoint and shows a small instruction. Clicking the selected/latest waypoint or destination again confirms the squad's travel, or the player may keep adding waypoints before confirmation. Keep the proposed route/ETA visible as in item 32. Specific cancellation/modifier interactions are unspecified. Preserve the distinction between planning/confirming and automatically sending the squad on every first map click.

39. **Combat pacing and readable action — core experiential priority:** In the current game, enemy turns resolve so quickly that the player cannot see their mercenaries being hit. Both commanded player actions and enemy actions need enough time and visual focus to watch them unfold and understand the result: who moves or attacks, who is targeted, and how the target reacts to being hit. The intended feeling is commanding small, believable people and observing their actions, not seeing an instant state change. Readable action and cause-and-effect are central to the game's appeal, not merely a request for arbitrary delays between already-instant outcomes. Exact animation durations, camera behavior, and playback controls remain unspecified. This is feedback to implement later, not authorization to change the game now.

40. **Remove unexplained indicators:** Remove the question-mark and circle indicators in the current game; their purpose is unclear to the player. The exact elements and their locations were not identified in this feedback, so confirm those before implementation rather than removing unrelated controls or markers.

41. **Combat balance and easy tuning — important gameplay priority:** Mercenaries currently die or lose their ability to act too quickly, leaving no room for meaningful decisions after being shot. Allow effective shooting from farther away and enough survivability/action opportunity for a shoot, take-cover, and reload loop. This is a mechanical balance concern distinct from readable animation pacing in item 39; slowing playback alone is not the solution. Relevant balance settings must be easy for the user to locate, understand, and tweak. Candidate controls include effective weapon range/range falloff, damage and survivability, hit/injury/AP penalties, action/reload costs, and cover effectiveness where applicable. Exact causes, numerical targets, and configuration format/interface remain unverified or unspecified; these are tuning directions, not authorization to apply arbitrary balance changes during feedback collection.

42. **Remove Tesorería, Cabildo, and Cuaderno:** Remove these entire interface sections/screens, not merely rename their labels; the player does not understand their purpose and does not want them in the game interface. Their underlying dependencies or data-removal implications have not been reviewed. Preserve the previously requested useful budget/contract information and fixed strategic event log rather than treating this as a blanket request to erase those mechanics or all history. No game changes are authorized during feedback collection.

43. **Correspondence is a received-message inbox only:** The correspondence/email-like screen should simply list correspondence the player has received, not act as a preloaded character/contact directory. The player does not need to know every character beforehand or select from the entire cast to browse their mail; unfamiliar correspondents can appear through incoming messages. This clarifies the inbox's scope without deciding the separate letter-versus-in-person recruitment presentation in item 36.

## Screenshot references

All 29 supplied attachment occurrences are archived as 22 unique original PNGs, deduplicated by raw-byte SHA-256. This includes the strategic maps, Assignment menu, contract and recruitment examples, time-compression control, and waypoint reference. See the [reference gallery](README.md) and [source manifest](images.json) for the saved files and complete upload-to-file mapping.

- **Lynx:** route/movement preview.
- **Molyhka:** inventory and house/interior.
- **Meltdown:** two-handed equipment and explosion.
- **Cleric:** bar and interior.
- **Larry:** cave and weapon-detail tooltip.
- **Fusty:** contextual chatter, player-turn bar, and six-unit HUD.
- **Carmen:** timber cabin, conversation, and dead skull portrait.
- **Scope:** textile-workshop interior and wall transparency.
- **Wolf:** prison interior, interrupt, and dialogue.
- **Raider:** explosion and corpses.
- **Raven:** ground loot.
- **Fusty (repeated example):** enemy-count display.
- **Trevor/factory:** bodies and blood stains for both sides.
- **Larry (repeated example):** right-click item details and attachment presentation.
- **Shadow/Yuki:** bright enemy highlighting in an interior.
- **Fab/Lynx strategic map:** roster, assignments/rest, location/destination, and plotted travel with ETA and transport mode; two views.
- **Strategic Assignment menu:** activity options for Doctor, Patient, Vehicle, Repair, Train, and Cancel.
- **Lynx contract:** renewal periods, prices, affordability, and departure time.
- **Bull/Dr. Michael/Igor:** hiring price and recruitment-contact examples.
- **Time-compression control:** continuous speed and pause controls.
- **Fab/Lynx map (waypoint):** proposed-route confirmation and strategic event log.

The user also verbally mentioned ruined-house/kitchen/bathroom imagery; no separate screenshot beyond the uploaded originals is inferred for it. Repeated `image-1.png`/`image-2.png` filenames and duplicate uploads are resolved in the manifest by message, attachment index, and content hash. All supplied references through the strategic log/waypoint message are saved, including its seven image attachments.

## Written path and validation

- Written path: `docs/references/playtest-2026-10-03/feedback.md`
- Validation performed: reviewed feedback through item 43, preserving earlier requests, qualifications, and order. The archive contains 22 unique originals and all 29 upload mappings; new PNG integrity and source-byte hashes were validated during archival, including all seven attachments in the latest strategic log/waypoint message. Only reference documents and images were created or updated; no game, UI, configuration, or commits were changed.
