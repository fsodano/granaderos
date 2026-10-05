# JA2 video gameplay requirements — 3 October 2026

This is a working-branch review of the user's complete gameplay objective. It does not declare full JA2 parity or campaign completion. The source is [StefaNonsense, *Why Jagged Alliance 2 CRUSHES Modern RPGs*](https://www.youtube.com/watch?v=6WtKA16osqE), published 19 May 2025, duration 20:45. The full English transcript was exported through the video's own browser transcript on 3 October. The reference footage was also sampled at 10:53, 11:21 and 6:21. Those frames show the presented combat/character scenes; they do not independently prove every narrated formula or an actual recruitment-refusal transaction.

The existing [parity audit](ja2-parity-audit.md) supplies broader acceptance conditions and source references. Its older numerical test and economy checkpoints are historical records. The [October playtest trace](../development/playtest-feedback-2026-10-03.md) records the current shop-free economy and latest input, map and combat presentation changes. Runtime code, saved state and current acceptance checks take precedence over an old status paragraph.

## Scope

Preserve the player's choices and consequences across the entire video: distinct people, progression through use, limited owned equipment, physical shots, meaningful positioning, lasting wounds, relationships, exploration, strategic freedom and consequential quests. Small commits are delivery steps; they do not replace this objective with an animation-only or formula-only target.

The user's later instructions control adaptations. Use the Granaderos historical setting and Spanish interface. On 4 October, the user assigned map and cannon visuals to a separate 3D-assets effort and asked this assistant to stop cannon-fire work. No cannon staging changes were made. Keep this delivery focused on gameplay rules, saved consequences and tests; the future 3D presentation remains separately owned. Town income follows full control and a conversation with the local port representative. Ordinary equipment shops and Bobby Ray's are deferred. Science-fiction creatures, instant-regeneration items, modern stimulants, rocket weapons, laser sights and modern armor are excluded. Period alternatives must preserve a relevant choice without inventing historical evidence or a magical protective garment. On 4 October, the user also clarified that tactical options must fit 1810–1820. Door-mounted explosive charges are not planned without reliable evidence for this setting; keys, locks, crowbars, windows and route choices are the current alternatives. The video's promotional, modding and preservation commentary is context, not a request to reproduce third-party websites, exploits or Arulco's story.

## Requirement map

| ID and video time | Player choice or consequence | Current evidence and outstanding acceptance |
| --- | --- | --- |
| V01 · 0:48–1:11 | Different soldiers, physical gear, house/corpse loot, locks, traps and optional objectives support different approaches. | Roster, physical inventory, paid environment interactions and persistent loot exist. `environment-interactions.js` supports keys, picks, prying and discovered alarm/injury traps. Manual adobe/wood passage now requires a real equipped crowbar, paid approach/use, finite tool wear and observed ground-level contact; rubble and custody persist. This is declared period game tuning, not a claim about classic JA2 crowbar demolition. One packed, serviceable linen shirt now becomes three actual dressings through a paid 20-AP preparation order. Fresh Retiro supplies one identified shirt through its real chest; ownership, source debit, staleness and saves remain finite. This is explicit game tuning, not a historical medical claim. Broader period-appropriate crafting and trap choices remain open, subject to reliable support for this setting. Door-mounted explosives are not an active requirement; the user explicitly ruled out copying that approach without period evidence. Preserve actual approach, discovery and saved custody. |
| V02 · 1:18–1:51 | Hiring, funds and correspondence belong to the world. | The period desk, prepaid contracts, visible funds and received letters implement this adaptation. Shops are deferred by the user. The reachable story editor now exposes finite initial ammunition and care without inactive shop controls; imported older commerce fields remain preserved. See [finite campaign editor](finite-campaign-editor-2026-10-05.md). New communications must preserve real events and receipts, not grant equipment or outcomes through text. |
| V03 · 1:55–2:44 | A custom character's answers affect attributes, specialties and later identity. | `character-profile.js` and creation orders provide the survey, budget and trait admission. New version-2 commissions now require at least 15 health, matching the existing consciousness threshold; the real creator uses that same bound while other attributes still admit zero and the budget stays 550. Public rejection is atomic, old valid low-health profiles remain unchanged, and a minimum-health officer can save, take a real paid step and return with finite owned equipment. Existing questionnaire checks cover movement, night vision, instruction and temperament; wider later consequences remain part of acceptance. |
| V04 · 2:48–4:24 | Strength, dexterity, agility, wisdom and experience affect actions; use develops skills; experience affects salary and awareness. | Shared costs, load, fists, tools, care, initiative and contract quotes contain these effects. `skill-training.js` uses wisdom and a separate saved practice seed; practice and capped progress persist. Movement, shooting, care and work have events. A capable intended player now receives one ordinary agility-practice attempt after an actual paid hostile single-ball miss passes close before its physical stop. Hits, redirected injury, misfires, rays stopped before the player, distant rays, point fire, pellets and cannon fire give none. Ordinary/presented execution, saved replay and campaign settlement preserve the same result. The tighter distances and credit amount are declared Granaderos tuning; they do not claim the exact classic growth formula. |
| V05 · 4:32–5:05 | Specialties make night work, stealth, paired weapons, roofs and blades useful alternatives. | Current character abilities, sight, paired-pistol and melee rules provide period choices. Check every exposed trait against a real action, costs and saves; unsupported trait text does not prove the mechanic. The existing concealment specialty now follows each resolved pellet load, including alternatives and authored firearms, rather than weapon ID 1807. A selected single-ball load is neutral; legacy fallback and explicit omission keep their existing admission rules. Exact load-choice, finite-fire, mixed-hand, public-forecast and saved-replay checks are recorded below. Guerrilla defense now uses the target's actual tactical surface; a paid roof-arena shot and official replay verify actual upper cover and neutrality of unseen ground beneath it. See [upper-surface specialty evidence](elevated-specialty-cover-2026-10-04.md). Modern automatic weapons are not a period substitute. |
| V06 · 5:15–6:56 | A companion relationship can force a roster choice; contextual personality can affect performance. | Shared-service cohesion and temperament exist. Authored `serviceRefusals` prevent a new hire or renewal while a named rival actually serves. The fictional default Inés Aguirre/Gaspar Villalba disagreement gives a roster choice; the hiring, renewal and editor controls disclose it. Authored favorable preferences now give up to +3 temporary morale when a capable named companion actually deploys, within the existing total +5 team-support cap. The fictional Aguirre/Lagos preference and authoring rules are described in [service relationships](../gameplay/characters/service-relationships.md). Exact paid terms and already accepted arrivals remain valid; older pinned packages without a preference remain neutral. Confirmed deployment-return and strategic military-bleeding deaths admit one saved named companion-loss letter. A confirmed notice now survives temporary sleep, critical injury, exhaustion or an unresolved deployment; actual eligible recovery delivers the existing letter once. Saved admission, continuous paid renewal and cancellation on ended service are recorded in [confirmed-loss recovery](confirmed-companion-loss-recovery-2026-10-05.md), with no old-death backfill or additional morale penalty. A capable issued participant who directly witnesses a preferred military companion die now receives one saved, clipped additional morale loss of up to 6 and a short named notice. Fatal physical hits and untreated tactical bleeding use the same observed transition; hidden or old deaths do not backfill it. The original support receipt stays fixed, and the actual return retains the loss. New default Cejas content also gives one explicit contextual care effect: paid effective first aid to another directly observed living person reduces her current shock by up to 2, using ordinary dressing, action and treatment rules. Older pinned packages without the ability stay neutral. See [care composure](../gameplay/characters/care-composure.md). These amounts are declared Granaderos tuning. An explicitly authored contract conscience now records one complaint after a directly witnessed intentional noncombatant killing, preserves the paid term and rejects later renewal or rehire. The real return sends one named received letter. See [service objections](../gameplay/characters/service-objections.md). Fresh Cejas content also declares nervous isolation: below 50 morale and without a capable nearby military companion, a real new player combat turn adds up to 2 ordinary shock after normal recovery. Regrouping stops further additions without refunding shock. Existing accuracy and interruption rules use the actual result. See [nervous isolation](../gameplay/characters/nervous-isolation.md). Fresh fictional Teresa Godoy (126) content now declares enclosed-room fear: at an actual new player combat turn inside an intact supported room, normal recovery runs first and the actor gains up to 2 ordinary shock. Exiting or opening a real wall breach stops further additions without refunding shock; older pinned omissions stay neutral. Supported ground and explicitly authored upper platform rooms use current structural geometry. See [enclosed-room fear](enclosed-room-fear-2026-10-04.md). The same explicit nervous ability now also has a bounded strategic consequence: a capable serving actor below 50 morale loses up to one point at an actual hourly transition without an actual same-party moving companion or same-cell stationary companion. A saved episode loses at most 20 points, suppresses active morale-rest recovery and resets only on real capable regrouping, without a refund. Exact positive charges are at least 3600 seconds apart; deployed actors are excluded. See [strategic isolation](strategic-isolation-2026-10-05.md) for declared tuning, paid-route evidence and legacy neutrality. An explicitly authored paid-contract ability now refuses renewal while saved personal morale is below 30. Ordinary recovery to 30 clears that reason; the full paid term remains valid. Fresh fictional Cejas content opts in, and old pinned omissions remain neutral. Hiring uses its existing quote, while actual renewal controls use the shared renewal quote and disclose the reason. Temporary deployment support cannot replace personal morale. See [poor-morale renewal](../gameplay/characters/poor-morale-renewal.md) and its [verification record](poor-morale-renewal-2026-10-05.md). The fixed threshold and lack of a buddy override are explicit game tuning. Underground fear, wider changing opinions, other death-notice paths, prolonged panic and early departures remain separate requirements. |
| V07 · 7:00–8:19 | Weapon handling, weight, range, condition, fittings and regional protection have tradeoffs. | Physical carried weight, typed charges, readiness, condition, aim, range, bayonet custody and three worn regions exist. Unfinished loading is now visible separately from ready charges in the hands and roster, using each physical gun's retained work rather than a forecast of the next order. See [retained loading display](retained-reload-display-2026-10-05.md). Actual physical injury now wears only the actual recipient's garment in the struck region, using clipped HP loss. Worn and packed garments use the existing finite hourly repair queue after weapons and tools. Condition-zero clothing remains owned; a serviceable packed linen shirt can instead be consumed for dressings. Historically supported ballistic protection remains open; cloth supplies no new bullet damage reduction. Tactical firearm maintenance now spends finite carried repair materials, capped by actual wear and available stock. The real inventory control shows the gain, material cost and refusal reason. A fresh paid native hire acquires the Retiro kit, earns three condition points of wear through three real discharges and restores them for three kit points. Saved continuation, return and reentry preserve the remaining 97 points and depleted chest. An explicitly declared older reserve plus real kit reaches zero through actual maintenance without a refill; numeric reserve custody is checked at active/save/resume/return boundaries. This proves bounded maintenance, not a full campaign. Modern scopes, suppressors, ceramics and ballistic vests are not copied into 1812. |
| V08 · 8:20–9:31 | Stance and cover change exposure and shooting; weak cover differs from hard cover. | Shared muzzle/body heights, posture, material resistance, furniture, window geometry and authored terraces affect real shots and forecasts. Smoke/concealment affect observation separately. The guerrilla defense correction uses occupied surface cover, with bounded paid-shot/save evidence; it changes no cover material or projectile rule. Continue verifying UI, AI and actual orders against the same physical rules, including heights and hidden information. |
| V09 · 9:32–10:26 | Head, torso and leg shots trade accuracy, injury and mobility; owned attachments change handling. | Three body regions, leg knockdown/unhorsing and the existing physical bayonet fitting are implemented. Wider period-appropriate attachments require an explicit choice and source, not renamed modern equipment. Live regional consequences and saved injuries remain part of acceptance. |
| V10 · 10:53–11:48 | Each bullet has a real trajectory; intervening cover loses or stops damage; misses can injure unintended people. | Single-ball shots continue beyond the resolved aimed/scattered cell. One glancing contact with an exposed explicit vertical stone face can redirect the path with half its remaining force; cumulative distance and drop do not reset. Their original absolute-height slope remains through twice effective range; beyond it, shared deterministic drop can change the struck region or cause a ground stop. Ordered body contacts spend force and can permit seeded passage; a failed passage, material stop, solid floor/ground, finite range or map edge ends the shot. Paired single-ball shots capture their intended point and absolute height before either discharge; first-shot death, knockdown or unhorsing cannot move the second ray. Each shot still checks current physical bodies. Fixed-seed legal orders check successive injury, paid costs, exact intersections, typed civilian/soldier IDs and saved replay. Knowledge-filtered forecasts include conditional passage and warnings for known people beyond the first contact. One discharge presents successive observed impacts without exposing concealed bodies or changing the final order. Shot loads now resolve nine finite weighted pellet paths from the actual selected load, including cover, intervening bodies and unintended people. Forecasts, warnings and enemy choices use observed geometry; injuries retain finite costs and saved custody. Cannon work belongs to the separate 3D effort. The remaining physical requirements in V11 remain open. |
| V11 · 11:15–11:42 | Surface deflection and projectile/cover properties affect the final impact. | Body penetration now follows the primary-source structure of spent force and a conditional passage roll. Granaderos uses explicit head/torso/leg resistance and passage-chance values; these are game tuning, not historical lead-ball measurements or the exact classic formula. Cover and body losses accumulate separately. Material force now falls progressively over actual crossed depth, including oblique paths and height clipping. Same-object intervals merge; separate overlapping objects add resistance. A body receives the remaining force at its actual contact, and force exhaustion stops inside the material. Resistance per tactical distance is explicit game tuning. Authored primary and alternative loads can now increase material resistance beyond their selected range. Fresh defaults opt in; older pinned omissions remain neutral, and an omitted alternative value does not inherit the primary value. The factor stays fixed through a continuous material span and retains spent distance after reflection. Paid shots, observed-only forecasts, editor controls and exact saved replay establish this scoped rule in [range-dependent penetration](range-material-penetration-2026-10-04.md). Single-ball drop after twice effective range now uses exact quadratic height clipping and arc-length material debit in actual fire and observed forecasting. The range-scaled reference-height constant is explicit Granaderos tuning, informed by the verified classic/Stracciatella distance-stepped rule. Far contacts use their actual struck region; near-miss learning uses the actual curve before its terminal stop. Physical pellets now use the same exact drop after twice their actual selected effective range, with a finite three-range tail. Single balls and physical pellets now share one bounded glancing reflection from an exposed vertical stone face. The 0.3 incidence threshold and half-force retention are explicit game tuning. Unique entry faces, cumulative range/drop, spent force, known off-axis bystanders and clipped observed presentation use the shared path. Optional pinned mass and muzzle-speed profiles now set a kinetic-energy launch budget, with a separate authored injury cap. Fresh Brown Bess ball and shot profiles opt in; older pinned omissions and omitted alternatives remain neutral. The conversion of 20 joules per reference impact point is declared Granaderos tuning. It does not calibrate tactical distances, material strength or wounds in SI units, and mass or speed does not set flight time, range or drop. See [kinetic impact scope and evidence](kinetic-projectile-impact-2026-10-05.md). Optional same-load air retention now reduces energy over exact free-flight arc intervals while active material keeps its independent linear resistance. Fresh Brown Bess ball/shot coefficients are explicit range-normalized game tuning; old pinned omissions remain neutral. Known forecasts, paid finite firing and saved return cover the bounded rule; see [air-energy scope and evidence](firearm-air-drag-2026-10-05.md). SI atmosphere/distance calibration, other surface reflections, fragmentation and the wider physical acceptance remain open. See [stone ricochet](../gameplay/tactical/stone-ricochet.md). The reviewed classic/Stracciatella source shows impact effects and body passage but did not confirm a reflected projectile path. The video's narration alone is not proof of that formula. |
| V12 · 11:53–12:18 | Travel can produce danger, discoveries and local opportunities. | Persistent strategic enemy groups and actual contact exist. One optional [finite roadside chest](../gameplay/campaign/roadside-discoveries.md) now uses an explicit pinned definition, physical discovery and pickup. Its used crowbar and linen shirt remain owned through saves and return visits; old omitted packages stay neutral. It grants no arrival reward. A local recruit's [direct reply now follows actual service terms and refusals](local-recruitment-dialogue-2026-10-05.md), including unpaid service; it cannot promise a contract that every quote rejects. Wider caches, optional encounters and local opportunities still require authored encounters and saved outcomes. Giant-cat encounters are not inferred as required Argentine content. |
| V13 · 12:23–14:00 | The player chooses routes, daylight or night entry, specialists, retreat/recovery and alternate access. | Independent squads, timed approaches, placement, night sight, paid exits, care and persistent encounters exist. Campaign phases retain historical progression. An acquired crowbar can open a saved, traversable ground-level adobe/wood passage at the existing 25/45-AP cost. Broader route freedom and historically supported alternate access remain open. Door-mounted explosive charges are not planned without reliable evidence for the 1810–1820 setting; keys, locks, crowbars, windows and route choices are the current approach. A complete legal campaign must retain money, ammunition, wounds, casualties and paid travel; the short suite alone does not prove it. |
| V14 · 14:09–14:56 | A quest can have competing resolutions with different persistent rewards and civic consequences. | Physical deliveries, escorts, failures and authored mission outcomes exist. Fresh two-poncho errands now offer two actual beneficiaries, Retiro or Ensenada. First accepted custody fixes the destination; full delivery and adjacent confirmation give eight points of support only to that town. Actual militia admission supplies a territorial consequence. Older pinned 40-peso-or-support definitions remain valid. A physical partial delivery can now opt into adjacent withdrawal: delivered objects stay with the selected recipient, remaining objects stay owned, and one disclosed clipped local-support cost seals the errand without reward or refund. Fresh Retiro uses four points; older omitted definitions stay neutral. See [competing beneficiaries](../gameplay/characters/competing-beneficiaries.md) and [withdrawal acceptance](errand-withdrawal-2026-10-04.md) for separate native-route and declared-boundary evidence. Port income is unchanged. Broader authored quest outcomes remain incomplete; this does not copy the chalice quest. |
| V15 · 16:37–17:00 | Individual lines, jokes, reactions and discontent give people a distinct presence. | Authored personal greetings, contextual text banter and event cooldowns exist. Confirmed companion-loss letters and a brief witnessed-loss notice add saved named text reactions. The witnessed loss also changes existing morale and accuracy rules. Effective manual care by an explicitly capable caregiver now gives a brief named tension-relief notice from the actual paid result; loading does not replay that notice. See [care composure](../gameplay/characters/care-composure.md). An authored conduct objection supplies one saved named complaint, a received letter and a real future-service consequence. The first actual nervous-isolation event in each deployment adds one brief named notice; loading or inspecting inventory creates none. The first actual enclosed-room fear addition in a deployment gives one brief named notice. Initial loads, saved imports and unchanged receipts create none. See [enclosed-room fear](enclosed-room-fear-2026-10-04.md). Actual firearm close passages now admit transient own-player reactions only after physical resolution; distant cover stops, ignition failures and hits cannot supply that near event. Optional authored near/interrupt lines have no enemy-contact fallback, and event sampling no longer counts animation frames. Six fresh paid characters opt in; older pinned omissions stay silent. See [physical near-miss feedback](physical-near-miss-feedback-2026-10-05.md). Distinct recorded voices, broader event-specific speech and wider discontent remain open. Text, a generic sound or the relationship rule alone does not prove voice-work acceptance. |

## Delivery and proof

For each implementation, use actual legal orders and authoritative final state. Preserve limited charges, owned items, AP, energy, time, wounds and casualty history. Check rejection before mutation, save/reload continuation, hidden-state equivalence and the mounted player controls where applicable. Label imported or prepared scenes explicitly; a controlled fixture is not an earned fresh campaign.

The user requests small commits and pushes with affected checks plus the short suite; do not repeat extended simulations for each batch. Keep the original long-route failures visible and revalidate full campaign acceptance when the integrated objective is ready. The current draft PR and a green short suite do not close the remaining rows above. Update this record with actual implementation and acceptance evidence, not intent.

Close combat now has a separate paid contact frame before authoritative injury is displayed. Punches, blades, mounted charges, counterattacks and braced interception retain ordinary final HP, AP, energy, time and RNG. Nineteen focused presentation cases also check canceled attacks, unknown actors, typed civilian targets and one final mounted commit. The current atlas has no crouched strike artwork; legal crouched attacks retain their real stance. Living hit-reaction sequences remain open presentation work. Cannon staging is deferred to the separately owned 3D effort at the user's request.

## Officer-creation health checkpoint — 4 October 2026

The previous new-officer order accepted a version-2 550-point profile with zero maximum health, commissioned an `alive` record at zero HP, and admitted sector entry; official save/reload then rejected the invalid service sheet. Positive values below 15 admitted an officer who would always be unconscious. New commissions now require at least the existing `CRITICAL_HEALTH` threshold of 15. Both the actual creator and public campaign order apply the same creation-only check before issuing anything. The health range and accessible help use 15–85. Other attributes keep 0–85 and the exact 550-point budget.

Reconstruction is deliberately separate: old valid version-2 profiles with maximum health 1 or 14 load at their original health with unchanged finite ammunition. No save is healed or given equipment to satisfy the new bound. Legacy omitted-profile creation retains its 300-peso price and 78 HP. Public zero/14-health rejection changes only the error; treasury, contracts, issue markers, inventory, squad, clock and seed remain equal. Minimum-health creation with a zero medical attribute issues the ordinary 1+9 charges once and proves actual paid movement, full saved replay, return and reentry without ammunition or clothing duplication. Existing model and mounted creator tests were strengthened; the affected five-file run passes 214/214 with no skips.

Browser QA used the real CharacterCreator in an explicitly labelled unsaved fixture. Keyboard adjustment stops health at 15; strength 85 and agility 65 retain the exact 550-point budget. The real completed questionnaire and submit commissioned Elena Testigo, then the fixture issued a normal visit, paid one reachable movement and completed full save/replay/return checks. The final result retains 15 HP, 10 owned charges and 3,200 pesos. Browser warnings/errors are empty. Production styles were used. The temporary tab, server and three generated preview files were removed without reading or writing a player campaign.

The frozen combined gameplay source plus this creation fix passes **4,653/4,653 short tests, zero failures, cancellations or skips**, all 660 selected files complete in 301.21 seconds, `complete: true`. Eight established extended files remain excluded from 668 total files. Typecheck and production export **c34e1eacc703** pass (1,133 files and 1,033 asset references); the current source digest matches the built digest. Documentation, baseline and complete shard-coverage checks pass. This is valid character admission and continuation evidence, not a complete fresh campaign or full-video acceptance. Cannon and map graphics remain separately owned.

## Body-passage checkpoint — 4 October 2026

The frozen body-passage, ordered presentation and near-miss source passes affected checks, independent review, type checking and the production export (`f476e0961f4e`, 1,133 files and 1,033 asset references). The final joint short run completed all 659 selected files: **4,623/4,623 tests passed, zero failures, cancellations or skips**, in 247.58 seconds. Its timing report has `complete: true`; no test-name filters were applied. The established profile excludes eight extended files from 667 total files. Documentation, baseline and complete shard-coverage checks pass. These results do not replace the earlier open extended campaign acceptance.

Obsolete first-body-stop, per-person ammunition-ceiling and forced casualty/posture assertions were replaced with actual ordered injuries, global finite ammunition custody and saved replay. The opening and artillery-recapture controllers use existing legal cover, aid, posture and firing choices with their original requests, soldiers, gear and seeds. The paid casualty fixture now selects a soldier who actually died; it cannot force a particular death. Independent review also found and corrected a reverse-order bodyguard injury: a guard already struck by that ball cannot intercept a later contact and receive a second injury. Ordinary, presented and saved execution retain distinct 49/21 damage receipts and no duplicate interception cost.

The established-front rescue retains its original paid six-person force, gear, seed and arrival positions. A known safe shot is preferred when its chance × damage factor is at least 90% of the proposed shot; any known prisoner risk prevents firing if no comparable safe alternative exists. All three prisoners reach Jujuy alive through physical exit orders after 757 seconds. Four rescuers survive; the actual deaths of 123 and 114 persist. Ten personal cartridges and six cannon loads are spent, treasury remains 2,666 pesos, and four evacuation saves retain the route. Complete battle/campaign replay and intermediate saves grant no health or supplies. This proves the declared fixture, not a fresh campaign or stealth escape.

Browser QA used a separate unsaved arena, the real `Battlefield` controls and current workers with compiled production CSS. The seed-11 shot displayed the first guard at 51 HP before the continuing ball injured the second; the final result was 51/79 HP, 89 AP, an empty gun, two spare cartridges and six elapsed seconds. The continuation showed no second muzzle flash. The seed-45 stopped shot left the first guard at 45 HP and the second at 100 HP with the same paid costs. Both complete results exactly matched ordinary orders; browser warnings/errors were empty. The final build was checked again after the bodyguard correction. The temporary tabs and generated fixture files were removed; no player campaign was imported or saved.

## Preferred-companion checkpoint — 4 October 2026

Authored favorable preferences now supply up to +3 temporary morale when a capable named companion enters the same issued deployment. The fictional, directed Inés Aguirre/Petrona Lagos preference supplies a roster choice; Lagos gains no reciprocal preference. Actual participants determine eligibility, including coordinated assault and local defense. Earned cohesion has priority, combined support cannot exceed +5, and total morale cannot exceed 100. Several companions do not stack. A saved positive bonus names its original source; later injury, death or expiry does not rewrite that original receipt. Return removes the issued support once and preserves actual tactical and strategic morale changes. Older pinned packages remain neutral.

Hiring, dossier and assignment controls disclose the preference and applied support. Authors can set up to three stable named preferences, including their reasons. Self, unknown, duplicate, contradictory and malformed records reject; references protect their targets from deletion. Existing model, mounted controls and editor tests were strengthened rather than copied. Seven distinct acceptance cases use actual paid hires, arrivals and renewal; finite firearm actions; official saves and repeated return; coordinated assault and defense; actual critical injury, death and expiry. The real shot forecast changes from 56% to 57% for the declared ordinary arena without changing ammo, AP, time or RNG. Isolated direct morale values test only cap admission.

Browser QA used an explicitly labelled unsaved fixture prepared through two paid hires, their six-hour arrivals and one paid renewal. The actual assignment menu names Petrona Lagos. Actual sector entry issues Aguirre at 85 from personal morale 82 with +3 sourced to Lagos, and the hiring card shows the applied receipt. Actual return retains personal morale 82. Assigning Lagos to another squad through ordinary orders before entry issues Aguirre at 82 with no support. Treasury remains 2,192 pesos; complete order, campaign/battle save and replay results are equal. The test wrapper was corrected to save a pending campaign together with its battle; no production rule changed for that correction. The corrected run had no new browser warnings or errors. Current workers and compiled production styles were used. The temporary tab, server and five generated preview files were removed without reading or writing a player save.

The frozen source passes the complete short suite: **4,647/4,647 tests, zero failures, cancellations or skips**, with all 660 selected files completed in 308.90 seconds. The report has `complete: true`, without test-name filters; eight established extended files remain excluded from 668 total files. Affected engine checks pass 58/58; affected model, mounted UI and editor checks pass 91/91 (overlapping groups). Independent source/test review found no blocker. Typecheck and production export **61fa7f1b1114** pass (1,133 files and 1,033 asset references), and the current source digest equals the built digest. Documentation, baseline, shard self-tests/complete coverage and whitespace checks pass. Extended simulations were not repeated for this batch.

This initial-deployment support is declared Granaderos tuning. It does not reproduce classic JA2 hourly profile-opinion averaging. Evolving relationships, late-join or hourly support, companion-specific death reactions, fears and recorded voices remain open under V06/V15. The full-video objective and earlier extended campaign acceptance remain open. Cannon and map presentation stay with the separately owned 3D effort.

## Paired-pistol aim checkpoint — 4 October 2026

The [paired-pistol geometry correction](../gameplay/equipment/paired-pistol-fire.md) freezes the intended point and absolute height for both single-ball shots before discharge. Real target identity remains available for typed miss exclusion, intentional harm and near-miss eligibility; physical collisions still use the bodies present when each ball fires. This introduces no saved fields or additional random draws. The existing original-aim test was strengthened to check death, knockdown, unhorsing, supported elevation, seeded scatter, paid resources, ordinary/presented equality and valid JSON continuation. Two mounted control cases add input hold, one final commit, hidden-reserve filtering and reduced motion. The existing tiny-chance rendering case now also checks that the target label uses the same `<1%` format as the aiming panel.

The frozen current source passes affected checks, independent review, type checking and production export `f25fa952d0ff` (1,133 files and 1,033 asset references). The complete short run passed **4,625/4,625 tests, with zero failures, cancellations or skips**, across all 659 selected files in 243.85 seconds. Its report has `complete: true`, without test-name filters; the established profile still excludes eight extended files from 667 total files. Baseline, documentation and complete shard-coverage audits pass. Extended campaign simulations were not repeated for this small batch, and their earlier open acceptance is unchanged.

Current browser QA used a declared unsaved arena with the actual `Battlefield`, workers and production styles. A seed-127 paired leg order showed 95%/95% and 20 AP. The first ball dealt 30 damage and unhorsed the guard. The second retained the original mounted-leg ray and struck the ground. The final result was 70 HP, prone, 80 AP, main/second loads 0/1, eight retained spare cartridges and six elapsed seconds. The complete result matched the ordinary order; browser warnings/errors were empty. The temporary tab and generated preview files were removed without importing or saving a player campaign. Standing-target checks still allow the original ray to touch the fallen body for an actual second injury; the correction does not force a miss. Authored cone-pistol loads retain their separate existing model. The remaining full-video requirements above remain open.


## Physical quest-choice checkpoint — 4 October 2026

Fresh Retiro campaigns pin a fictional cash-or-support choice to the existing two-poncho errand. Both usable garments must first leave real owned slots and remain with the sargento. The player then chooses a 40-peso reimbursement without a civic reward, or waives it for the existing +8 local loyalty reward without cash. Closing the panel and repeated clock synchronization keep the delivery pending. Completion saves its chosen branch; repeated, opposite, premature or invalid resolutions reject atomically. Actual recipient death before resolution fails the errand without a refund or reward, including when full delivery and death first reach the campaign together. A later death or occupation does not revoke a completed outcome.

The ordinary fresh campaign and the fresh default editor package pin the new definitions. Older campaigns and packages with omitted definitions retain the legacy automatic delivery rule. Ordinary authored physical errands without a choice remain automatic. Authored city deliveries can enable this bounded choice and set the reimbursement; it cannot coexist with an automatic reward. The editor prevents removal of generic residents referenced by explicit errands and names the dependencies. Undo, JSON import and saved launch retain valid definitions and dialogue quests. Generic contacts keep their own names when independent authored people exist.

Actual-action checks deliver the two once-issued ponchos from soldiers 1000 and 113, preserve empty source clothing slots and recipient custody, and cover save, departure and reentry for both resolutions. A declared controlled Buenos Aires/Retiro checkpoint at 42 loyalty compares the consequences after actual departure: cash retains 42 and rejects militia training; local support reaches 50 and admits the existing 60-peso course for three recruits. The course does not instantly create a garrison. Its cost, participants, saved choice and unchanged port agreement persist. This controlled checkpoint does not prove conquest or a fresh campaign victory. An actual late conversation, 600-second rest and physical gift across an hour boundary also check the reply's current seconds. Civic completion receipts must be dated at the quest's actual completion hour.

Browser QA used an explicitly labelled unsaved replay fixture prepared through two paid hires (110 and 112), actual approaches and two once-issued worn ponchos. No gear, health, money or saved outcomes were added. The actual Battlefield conversation could close and reopen with the choice pending. Local support retained 1,730 pesos and changed town loyalty from 53 to 61; the alternate cash choice changed funds to 1,770 and retained loyalty 53. Each branch retained 2/2 receipts and passed complete save equality, and completed reward controls disappeared. Browser warnings/errors were empty. Current workers and compiled production styles were used. The temporary tab and five generated preview files were removed without importing or saving a player campaign.

The frozen source passes the complete short suite: **4,637/4,637 tests, zero failures, cancellations or skips**, with all 659 selected files completed in 258.05 seconds. The report has `complete: true`, without test-name filters; eight established extended files remain excluded from 667 total files. The first diagnostic run exposed six stale synthetic context fixtures; all were corrected without relaxing save, map, initiative or continuation assertions, then the complete short suite was rerun. Typecheck and production export **38c4cdf7e03c** pass (1,133 files and 1,033 asset references). Documentation, baseline, shard coverage and whitespace checks pass. Extended simulations were not repeated for this batch.

This is the first competing-reward quest slice. Different beneficiaries, wider authored outcomes and territorial consequences remain open under V14. The full-video objective and earlier extended campaign acceptance are still open.


## Renewal reward clock checkpoint — 4 October 2026

A paid renewal now keeps its service purchase separate from the existing morale and foreign-standing rewards. Both rewards use the same rolling 86,400-second eligibility check. The saved hour and optional nonzero seconds date the last eligible reward. Earlier paid extensions neither grant a reward nor reset that date. A capped morale value still records the payment date, and a later whole-hour payment removes the earlier optional seconds. Old records without seconds keep their recorded whole-hour date. Malformed, orphaned or future payment dates reject on restore; failed funding, stale guarded orders and named service refusals preserve the complete campaign.

Actual fresh-campaign checks retain quoted costs, finite owned gear, health, ammunition, training, assignment, campaign RNG and exact contract expiry. They verify same-instant renewal, the earlier 23-hour boundary, 86,399 seconds, exactly 86,400 seconds and the next day, with complete saved replay. The existing whole-hour pay test was strengthened rather than duplicated; the existing forty-second renewal notice now uses its mounted real button. A shared coastal-route helper now uses the same reward eligibility check instead of selecting payment through an obsolete whole-hour subtraction. Its funds, force, gear and success assertions were not changed, and the long route was not rerun for this batch.

Browser QA used a separate unsaved fixture prepared from fresh seed 42 through an actual 476-peso weekly hire of Morel and ordinary strategic clock orders. The real Recruitment button paid 68 pesos for each one-day extension. Payment at 6:59:59 changed funds from 2,724 to 2,656, morale from 80 to 82 and foreign standing from 20 to 25. Payments at 30:00:00 and 30:59:58 left those rewards at 82/25 while buying their full service terms. Payment at 30:59:59 changed funds from 2,520 to 2,452 and rewards to 84/30. Each result passed complete save and action-replay equality. Current production styles were used, browser warnings/errors were empty, and the temporary tab, server and three generated preview files were removed. No player campaign was imported or saved.

The final frozen source passes the complete short suite: **4,641/4,641 tests, zero failures, cancellations or skips**, with all 659 selected files completed in 304.03 seconds. The report has `complete: true`, without test-name filters; eight established extended files remain excluded from 667 total files. Affected checks, independent review, typecheck and production export **f9c0c7fbaa33** pass (1,133 files and 1,033 asset references). Documentation, baseline, complete shard coverage and whitespace checks pass. The source digest still matches the tested browser build. Extended simulations were not repeated for this small batch; the earlier full campaign acceptance remains open. This separate change is based on the frozen feedback PR rather than modifying its reviewed head.


## Combined gameplay checkpoint — 4 October 2026

The read-only combination check was followed by an isolated candidate containing the unchanged heads of PRs #143 (`7603c47e`), #144 (`e38633c5`) and #145 (`2258dbba`). No code conflict or resolution was needed. The actual combined source at `223c254d` passes the complete short suite: **4,651/4,651 tests, zero failures, cancellations or skips**, all 660 selected files complete in 301.00 seconds, with `complete: true`. Eight established extended files remain excluded from 668 total files. Typecheck and production export **45c8fc068f75** pass (1,133 files and 1,033 asset references). Baseline (38/38), documentation, shard self-tests/coverage and whitespace checks pass. These tests were local; extended campaign simulations were not repeated.

An actual paid pair in Retiro verifies the shared morale path. Aguirre's renewal at 06:00:17 gives personal morale 82; Lagos supplies temporary +3, issuing 85. A real look and full campaign/battle save preserve the receipt. Renewal while the visit is pending rejects atomically under the ordinary battle guard. Actual return retains 82. Subsequent paid extensions before 86,400 seconds retain the same reward date and morale; exactly 86,400 seconds admits the next +2. After 24 hours together, the next deployment issues 88 from personal 84, earned cohesion +1 and companion support +3. Actual return retains 84, treasury 1,940 pesos and the payment seconds; every declared full save is equal. No gear, health, ammunition or money was granted for this proof.

This candidate is an unpublished integration checkpoint, not a merge into main, deployment, fresh campaign completion or full JA2 parity. The remaining requirement map remains authoritative, including physical shot-load pellets and contextual personality work. Map and cannon visuals stay with the separately owned 3D effort.


## Physical shot-load checkpoint — 4 October 2026

Native and authored shot loads use nine finite rays from one paid discharge. Their equal force shares sum to the configured load. A frozen center and absolute aiming height determine every lateral and vertical ray. Shared material, floor, ground, body and range intersections spend or stop each share in physical order. All paths resolve before injuries, so a foreground soldier killed by an early accumulated injury still shields the bodies behind the other simultaneous rays. Fractional force accumulates by typed recipient and actual body region before injury rounding; tiny shares receive no forced minimum injury. Eligible impact practice follows each actual wounded soldier once. A physically contacted bodyguard cannot redirect a later group, while its own separate physical contacts remain valid.

Actual selected load metadata controls admission. A ball-loaded trabuco uses the ordinary single-ball rules; a compatible musket or authored pistol loaded with shot uses the pellet rules. Named targets, empty-point shots and mixed paired pistols preserve their paid charges, ignition checks, readiness, wear and elapsed time. Paired shots retain their original center and absolute height after the first discharge changes the target. Existing saves keep their owned ammunition and seed. Their next shot-load order uses the new resolution and draw sequence; an outcome from an older build is not a promised replay of that new mechanic. No new persistent pellet owner or save version is introduced.

Observed-only previews enumerate the same direct and possible scattered-center paths without random draws. Their probability means at least one pellet contacts the selected body, and their mean force is conditional on contact. It does not promise that every pellet hits, or hits the selected body region. The HUD retains bounded aggregate values and known-person warnings. Enemy choices use nominal expected injury from the actual ray regions and avoid known friendly lanes. Unrevealed-room bodies do not alter these forecasts or suppress another visible person's warning. Actual private collisions still spend force without exposing names, impact receipts or a private flight endpoint.

The released [classic JA2 firing source](https://github.com/dariusk/ja2/blob/876ccf5dfdad7e6821c5b26d6d783132ea1ab7a2/ja2/Build/Tactical/LOS.c#L3267) and [Stracciatella firing source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/04869c8e339ead1de9fefb25b7ad206b9b786825/src/game/Tactical/LOS.cc#L3094) create multiple buckshot bullets around a shared adjusted direction. They supply the finite-projectile structure and nine-pellet reference. Granaderos' equal one-ninth force shares, spread tangents, cell-wide body silhouettes, resistance and range are explicit game tuning. They do not reproduce JA2's damage adjustment or establish measured 1812 firearm ballistics. Reflected ricochet, material thickness and supported mass/velocity remain open under V11. Existing fan presentation is retained; cannon and map assets remain with the separate 3D effort.

Browser QA used two declared unsaved seed-45 arenas with the actual Battlefield, current workers and production styles. In the foreground case, the real aiming control showed 0% contact for the rear soldier. Actual fire injured the foreground soldier from 100 to 69 HP and retained the rear soldier at 100 HP. An alternative Brown Bess shot load warned about the visible lateral resident before actual fire left both resident and target at 88 HP. Each order used 12 PA, one loaded charge, no spare charge, one condition point and six seconds. Complete ordinary/presented state and validated battle replay matched. Browser warnings/errors were empty. The temporary tab, server and four generated preview files were removed; no player campaign was imported or saved. These arenas prove the bounded order and interface behavior, not a campaign victory.

The first complete short run found 77 failed checks across 35 files. Prepared care fixtures now declare their intended single-ball training weapon and twelve compatible charges rather than inheriting a native shot load. The shared custody battle now uses its actual owned gun through ordinary crew, movement, fire and reload orders; its six battlefield shots leave one reserve, and the later peaceful shot spends that last round. Consumer exhaustion, transport, display and reload checks retain the actual remainder instead of assuming seven unused rounds after victory.

The unchanged abandoned-gun recapture uses an existing legal tactic and retains three real deaths. The guarded rescue gives the strongest marksmen their actions first after contact, clears the guards with both finite guns and physically evacuates all three prisoners while retaining two actual relief deaths and complete saved replay. Each real firearm shot is checked against the contemporaneous known-prisoner lanes; safer tactics no longer have to invent a dangerous preferred candidate merely to satisfy a warning counter. Separate direct and mounted shot-load checks establish actual warnings and private-room neutrality.

A second complete run passed 4,662/4,663 checks; its remaining disabled-patrol assertion incorrectly required cartridges when the actual local combat used rifle-butt strikes. That check now preserves real injury, paid AP, finite per-person ammunition, victory and full saves. All corrections use declared fixtures or legal orders rather than assigning a success result, restoring health or replenishing ammunition.

The final frozen game and test source passes the complete short suite: **4,663/4,663 checks, zero failures, cancellations or skips**, all 661 selected files completed in 273.75 seconds, with `complete: true` and no name filters. Eight established extended files remain excluded from 669 total files. Independent review and affected engine, HUD, custody, care and rescue gates pass. Typecheck and production export **b5c059c78f01** pass (1,133 files and 1,033 asset references); the current production source digest still matches the browser-tested build after the test-only corrections. Documentation, baseline (38/38), complete shard coverage/self-tests and whitespace checks pass. This branch retains the earlier combined-gameplay validation record. Extended campaign simulations were not repeated; this is finite firearm resolution and bounded continuation evidence, not complete campaign or historical ballistic acceptance.

## Combined creation and shot-load checkpoint — 4 October 2026

An actual isolated merge at `79b11aff9452508ffc1800b0b22503cc61dceb00` combines the unchanged published heads of PR #146 (`95f9e591`) and PR #147 (`b9bab8f2`) with their existing #143–#145 base. No code conflict or resolution was needed. The combined source passes **4,665/4,665 short tests, zero failures, cancellations or skips**, all 661 selected files complete in 309.44 seconds, `complete: true`, without name filters. The eight established extended files remain excluded from 669 total files. Typecheck and production export **e4b9b4be6012** pass (1,133 files and 1,033 asset references); the current production source digest matches the export. Documentation, baseline, shard self-tests/coverage and whitespace checks pass.

A separate legal continuation creates a 550-point, 15-HP officer with zero medical skill, pays the ordinary week contract for native shot-load hire 100, waits for the hire, and visits Retiro. Both soldiers fire their actual issued weapon through ordinary point-fire orders. Each starts with ten owned charges and retains nine after fire, complete official save/replay, actual sector return and reentry. Ordinary and presented results are equal. The officer remains at 15 HP, both guns retain condition 99 and an empty chamber, and treasury remains at its actual post-hire 2,948 pesos. No health, equipment, ammunition, money or successful battle result is granted for this proof.

The candidate preserves the original published PR heads and main. It provides joint creation/firearm continuation evidence. It does not establish a complete fresh campaign or full-video acceptance. Cannon and map graphics remain with the separate 3D work.

## Material-depth checkpoint — 4 October 2026

Firearm cover previously spent one fixed material allowance per unique object, regardless of its crossed footprint. A 52-force ball crossing one or three cells of the same wood therefore retained 28 force in either case. The shared material sweep now merges adjoining intervals for each object and spends its resistance progressively over actual three-dimensional tactical ray length. Separate overlapping objects add loss. Zero-length penetrable corner contacts spend none. Ground and floor slabs retain their immediate solid stops.

Before each physical body contact, the ray spends only the material it has already crossed. A body inside a larger footprint receives that remaining force; conditional passage can then continue into the rest of the material. If force is exhausted between contacts, the terminal point lies at the actual interior exhaustion point. The bounded cover preview and older bounded flight API use the same arithmetic. Ordinary single balls, physical pellet loads, paired frozen intent and observed forecasts retain their existing firearm admission, charge, ignition, wear, time and random-draw rules. Geometry introduces no random draw or saved interval state.

Existing saves retain their owned equipment, ammunition and random state. Their future shots use the new material-depth outcome and body-passage eligibility; a changed physical path can also change which later passage rolls occur. Current ordinary/presented execution and restored replay must match. A future shot from an older build is not promised to keep its former result.

A declared flat seed-45 geometry probe uses a 52-force ball aimed from `(1,3)` to `(10,3)` through wood starting at `(4,3)`. The one-cell crossing spends 24.0133296317 force along the descending ray and delivers 27.9866703683 at the target. A three-cell crossing exhausts the same allowance at `x = 5.6654639651`, inside the wood, and reaches no target body. The small vertical slope is part of the crossed length. These are explicit Granaderos reference units and resistance tuning, not metres, measured material densities, projectile mass or muzzle velocity. Reflection, gravity, supported mass/velocity and the wider V11 acceptance remain open. Cannon, map and 3D presentation remain separately owned.

The first affected draft passed 90/96 checks. Its six old assertions assumed a full coefficient debit or an immediate stop at the material's entry face. Those checks now retain paid orders, real injuries, finite cartridges, ignition, wear, presentation order and complete replay, with analytically calculated crossed-depth loss and interior endpoints. An exact-zero boundary regression prevents rounding dust from reaching a body or drawing passage RNG; a real positive remainder remains valid. Paired clipped-hay fire retains the original aiming height after an actual mounted target falls. Each physical pellet spends its own oblique depth. Private props still alter real injury while leaving public forecasts, known-person warnings, names, material cues and endpoints unchanged.

The separate prepared acceptance arena uses the public weekly hire of soldier 110 for 420 pesos and the actual assault issue, seed, weather, gear and finite enemies. Its declared inputs alter positions, passive posts and nonblocking cover before battle creation; it is not an opening-victory proof. An actual wet-weather ignition failure is retained. Normal fire, reprime and retry spend 51 AP, one owned round (ten to nine), one condition point and the existing combat-round time. The same issued target retains 56 HP through thin cover and 68 HP inside deeper cover. Official intermediate saves and full replay match ordinary and presented execution. The soldier then pays to run to the real north boundary and exit. Actual retreat settlement retains the target's 68 HP, no deaths, the survivor's 85 HP and 68 energy, unchanged paid contracts and treasury of 2,780 pesos. Reentry retains nine rounds and condition 99. No successful result, health, gear, ammunition, AP or random state is assigned during execution.

Independent interval and privacy review passes. The final affected 18-file gate passes 153/153 checks with zero failures, cancellations or skips; the separate near-miss learning checks pass 14/14. Typecheck and production export **b198779e10a1** pass (1,133 files, 1,033 asset references), and the production digest matches the current source.

The first complete short run finished all 662 selected files and reported 4,666/4,672 passing checks, six failures, no cancellations or skips, in 310.87 seconds. Two checks still expected the old fixed cover percentage or a zero-depth corner stop. The four other failures concerned real changed battle outcomes and casualty identity; they were not dismissed as obsolete assertions.

The small wet settlement fixture now declares public starting seed 17 with three earlier service records from the explicit pre-redesign save fixture, three ordinary paid reinforcements, nine issued defenders, wet conditions and the original controller. This is settlement evidence, not a fresh-player victory. Actual victory at turn seven and 90 orders retains deaths 3, 4, 10 and 110, and survivors 113 at 80 HP and 115 at 15 HP. The separate loss at the same public seed pays for a bounded exposed advance before holding fire; actual enemy actions kill all three players by turn two. Validated saved input, the same legal orders and campaign settlement reproduce each result. No actor, gear, health, ammunition, AP or successful outcome is assigned during either battle.

The authored San Lorenzo mission keeps its survival requirement. Ordinary nearby first aid stabilizes the bleeding commander with carried dressings before resuming the existing regroup tactics. Actual victory at turn five retains the commander at 45 HP through settlement, deaths 4 and 10, ammunition 59 to 47 and dressings eight to four. Complete saved replay, known attack targets, real casualty custody and duplicate-report refusal remain checked. The contract-expiry case keeps all real Buenos Aires deaths, including the formerly hard-coded replacement 136, and chooses an actual living eligible replacement at the current quote. Its saved paid hire of 119 costs 210 pesos and retains the original dead body and death timestamp. No shared campaign or battle driver changed for these corrections.

The final frozen source passes the complete short suite: **4,672/4,672 checks, zero failures, cancellations, skips or todos**, all 662 selected files completed in 274.56 seconds, `complete: true`, without name filters. Eight established extended files remain excluded from 670 total files. The entire test, helper and fixture digest remained unchanged during this run. Production source still matches export **b198779e10a1** after all test-only corrections. Documentation, baseline (38/38), shard self-tests and complete 670-file shard coverage, and whitespace checks pass. These are local bounded gameplay and continuation checks. Extended campaign simulations were not repeated; complete fresh-campaign, full-video and historical ballistic acceptance remain open.

## Crowbar passage checkpoint — 4 October 2026

The former manual breach opened an adjacent blocked tile without a carried tool and emitted explosion noise. The same order now uses the shared environment admission and resolution. A real equipped positive-condition crowbar can open only an observed ground-level wall with explicit adobe or wood material. Turn-based work retains the existing 25/45-AP ability cost; exploration spends its corresponding time. The selected tool loses up to three condition points. A legacy tool stack splits only one member; a full inventory rejects before spending or changing topology. The final usable tool remains owned at zero condition.

Ordinary held-item selection pays a known approach before use and revalidates after movement. Contact, enemy reaction, exhaustion or another obstruction can stop the action before tool wear or wall changes. Direct breach orders remain local. Unseen adobe, stone and absent-wall requests have equal public previews and refusals. The wall control exposes material and cost without hidden room, contents, open/closed or trap fields. Manual impact noise replaces the explosion. Traversable rubble removes the wall's original collision, sight and ballistic overrides. Stone, doors, windows, floors and roofs remain outside this manual action; repeating it on rubble cannot charge again.

The earned acceptance chain begins after an explicitly admitted phase-2 scenario in Tucumán. It does not claim a fresh campaign victory or route to Yatasto. The ordinary 420-peso hire leaves treasury at 2,780, arrives through the actual contract rules and receives its normal finite kit. Nine legal orders then approach and open the authored Yatasto chest, take its single crowbar, equip it, approach the original adobe wall, open the passage and walk through it. The chain spends 86 seconds, including three seconds of breach work. The crowbar changes from 100 to 97 condition, chest tools from four to three, and one loaded cartridge plus nine reserves remain unchanged. Every actual order matches ordinary and presented execution. Official full replay, save, sector return and reentry retain one worn crowbar, chest depletion and the rubble passage. The existing repair queue admits that saved tool; no repair kit or repair operation is granted.

Eight core cases check costs, finite stack wear, the broken-tool boundary, rejection atomicity, unsupported surfaces, hidden equivalence and interrupted approach. The affected core gate passes 115/115 checks; the distinct HUD and mounted-panel gate passes 64/64, and the acquired-tool/save/mounted-map gate passes 2/2. A real panel click uses the shared paid action; missing or broken tools disable it. Independent review finds no blocking issue. Typecheck and production export **3289d5f0b7fc** pass. The crowbar passage is declared Granaderos period game tuning, not evidence of classic JA2 crowbar wall demolition. Crafting, explosive alternate entry, broader route freedom and full-video acceptance remain open. Cannon and map graphics are unchanged.

The final frozen source passes the complete local short suite: **4,684/4,684 checks, zero failures, cancellations, skips or todos**, all 664 selected files completed in 311.29 seconds, `complete: true`, without name filters. Eight established extended files remain excluded from 672 total files. The full test/helper/fixture digest and production digest remained unchanged; current source matches export **3289d5f0b7fc**. Documentation and baseline audits, five shard self-tests, complete 672-file shard coverage, and whitespace checks pass. The four former bare-hand breach fixtures now declare an actual finite equipped crowbar and retain their ability-cost, ballistic-clearance and room-disclosure assertions. These are bounded local gameplay checks; extended campaign simulations and live browser wall controls were not repeated.

## Far-shot drop checkpoint — 4 October 2026

A single ball keeps its original horizontal direction and straight muzzle-to-aim slope through twice the selected load's effective range. Beyond that onset, its height loses `0.1 * extraHorizontalDistance² / (4 * effectiveRange)`. This is a continuous Granaderos adaptation of the distance-scaled vertical decrement in the pinned [Stracciatella actual flight](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/04869c8e339ead1de9fefb25b7ad206b9b786825/src/game/Tactical/LOS.cc#L4217-L4223) and [cover forecast](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/04869c8e339ead1de9fefb25b7ad206b9b786825/src/game/Tactical/LOS.cc#L2839-L2845). The reference-height constant and curve are game tuning, not SI dimensions, measured period muzzle velocity or exact classic numerical parity. The existing finite cap and legal farther aim points remain unchanged. Capped pellets and legacy cone paths retain their current geometry.

Exact quadratic roots clip body, material, floor and ground volumes. The shared material sweep spends analytic three-dimensional arc length before each ordered body contact. Same-object spans merge across the drop onset; separate overlapping objects add loss. Material exhaustion uses a bounded monotonic arc-length inverse and records the true interior point. Zero-depth penetrable tangents spend no force. Geometry reads no RNG, does not reset the source-cell exemption, and cannot injure a typed body twice. Far selected contacts use their actual head, torso or leg height. Forecasts show zero chance when the path does not intersect the selected typed body; AI values the actual struck region while retaining the requested aim in its order. Near paths and their existing forecast shapes remain unchanged.

Near-miss learning evaluates the exact fired curve before its actual terminal point. A lower ground-stop chord or sampled path cannot create a practice award. Pure runtime trajectory data is not saved. Samples are for inspection, with at most 0.0001 reference-height chord error and at most 1,418 points under admitted 128-cell map/range-one bounds; actual collision and force loss never use those samples. Frame projection evaluates exact heights at fixed quarter-cell progress and removes model metadata from admitted public shot events. An unseen intervening person cannot move, retime or refocus the first observed flight. The known-contact fallback supplies no invented hit, blood or downstream injury.

The bounded acceptance arena pays the actual weekly contracts for native hires 107 and 110: 588 plus 420 pesos, retaining treasury 2,192 and their issued finite kits. Flat 48×16 tiles, passive enemy positions, dry weather and representative seed 8 are declared before initial official save admission. This is a prepared firing arena, not an earned fresh-campaign victory. The ordinary torso-aim pistol order enters the standing enemy at `x=31.5`, height `0.4478074597`, rather than the controlled straight height `1.1048387097`, and hits legs. Actual HP falls from 100 to 75. The order spends 19 AP, one issued cartridge, one condition point and six game seconds. One loaded plus nine spare rounds become an empty chamber plus nine spares; condition 100 becomes 99.

Four ordinary combat orders fire, move both real hires to the north boundary and exit. Each ordinary result equals presented execution. Official saves and complete action replay retain the injury, actual seed, paid AP, contracts and finite property. Actual retreat settlement preserves the enemy's 75 HP and no player deaths; physical Retiro reentry retains the empty pistol, nine reserves and condition 99. All four orders total six existing combat-round seconds; movement and exit retain their normal AP and energy costs. No successful battle result, health, gear, cartridges, money, AP or random state is assigned during execution. A separate admitted arena moves only the actual unobserved NPC into the ray: its real HP changes from 84 to 45, the enemy remains at 100, and public forecasts, initial flight endpoint, duration and camera focus remain equal. Actual hidden harm saves and replays without a named cue or invented downstream injury.

Cannon, map and 3D graphics remain separately owned. No graphical cannon changes, long campaign simulation or live browser acceptance were performed for this slice. Pellet gravity, reflected firearm flight, supported mass/velocity and the wider video objective remain open.

The final combined affected gate passes **22/22** distinct new checks: twelve core geometry/cost cases, eight forecast/AI/near-miss/paired cases and two paid custody/privacy cases. The final consumer/presentation gate passes 79/79. The earlier engine gate passed 156/156 before the added oblique case; the complete final short suite includes that additional case. Independent review finds no blocking issue. No obsolete engine expectations required changing in this slice.

The final frozen source passes the complete local short suite: **4,706/4,706 checks, zero failures, cancellations, skips or todos**, all 667 selected files completed in 309.23 seconds, `complete: true`, without name filters. Eight established extended files remain excluded from 675 total files. All 839 test/helper/fixture inputs remain byte-identical to the pre-run freeze. Typecheck and production export **e0fb9cf419bc** pass (1,133 files and 1,033 asset references), and the production digest remains unchanged. Documentation and baseline audits, five shard self-tests, complete 675-file shard coverage, and whitespace checks pass. These results validate the combined current candidate, not full-video, full-campaign or historical ballistic completion.


## Garment-care checkpoint — 4 October 2026

Real physical injuries now wear only the military recipient's worn head, torso or leg garment. The debit is `ceil(actual HP lost / 5)`, capped by its remaining condition. The helper is pure; the actual injury seam selects a bodyguard first and supplies clipped loss afterward. Misses, empty slots, overkill and later bleeding cannot wear another garment. Condition-zero garments stay owned. Clothing supplies no new bullet-damage reduction; historically supported protection remains open.

The continuing carried-equipment repair queue now appends worn and packed garments after weapons, fittings and tools. It retains the existing finite hourly budget and toolkit debit. Individual packed garments precede legacy bulk stacks; a split at the 1,000-key limit rejects before spending. A paid native hire of 110 costs 420 pesos and retains 2,780 pesos. Declared initial wear affects only his native hat and poncho. Real Retiro discovery and pickup acquire the shirt and 100-point toolkit; normal equip packs the poncho. Actual repair restores eleven condition over six hours at two points per hour, spending exactly eleven toolkit points. Health, ten owned cartridges and money remain unchanged. Official saved continuation, completion, return and reentry retain repaired identities and 89 toolkit points. This is prepared native-wear evidence, not an earned combat route.

Fresh Retiro's finite armory chest now contains one identified 0.6-kg linen shirt. One packed shirt in at least 50% condition can become three 0.2-kg dressings through the actual inspected inventory control. Preparation pays 20 AP in combat or two seconds in exploration, lowers a raised gun and performs no care. Normal extraction/addition validates capacity before payment. The control pins owner, key, exact record/count and pocket fingerprints; changed or replacement property requires reinspection. Worn, held and cursor shirts require ordinary packing first. The recipe, weights, condition threshold, wear and repair rates are explicit game tuning, not historical medical evidence or cloth armor.

A separate fresh native hire of 112 pays 1,050 pesos and retains 2,150 pesos. Real Retiro approach, opening and pickup acquire the one shirt. Four legal wear/stow/equip/preparation orders spend five seconds in total and change two owned dressings to five. Ordinary and presented execution, full official saved replay, actual return and reentry preserve the consumed shirt, ten rounds, health and money. A saved older opened chest without a shirt retains its contents. Prepared wounded-actor checks then prove ordinary hand preparation and first aid consume a dressing separately and stop bleeding without ordinary HP restoration. Mounted component checks exercise the actual inventory callback, 20 AP and stale-source refusal; no live browser campaign was changed.

The affected twenty-file gate passes 138/138 checks, zero failures, cancellations or skips. Independent review finds no blocking issue. The final frozen source passes the complete short suite: **4,730/4,730 checks, zero failures, cancellations, skips or todos**, all 673 selected files complete in 311.25 seconds, `complete: true`, without name filters. Eight established extended files remain excluded from 681 total files. All 845 test/helper/fixture inputs remain byte-identical to the pre-run freeze. Typecheck and production export **269804ef9fd4** pass (1,133 files, 1,033 asset references), with unchanged production digest. Documentation and baseline audits, five shard self-tests, complete 681-file shard coverage and whitespace checks pass. Existing equipment-repair and cache checks were extended; no obsolete engine expectations needed removal. The combined #150 candidate is unchanged. Cannon, map and 3D graphics remain separately owned. Broader crafting, historical ballistic protection, extended campaign and full-video acceptance remain open.


## Confirmed companion-loss checkpoint — 4 October 2026

The directed Aguirre/Lagos preference now admits a named received letter after a
validated deployment return or a newly confirmed strategic military-bleeding
death. Pinned names and preferences decide the reaction, not the source of a
temporary morale bonus. Actual serving, conscious senders are eligible; unresolved
deployed health is not inferred from a stale campaign record. The existing
correspondence system retains a stable sender/deceased identity. No migration or
save-load scan generates retrospective letters.

This is a bounded text reaction. Existing tactical team morale, ordinary casualty
morale and support removal remain unchanged. There is no extra grief penalty or
recorded voice. Immediate tactical reactions, detained/resident death notices,
evolving opinions, fears and later departures remain open under V06/V15. Cannon,
map and 3D presentation stay with the separate assistant.

The paid native acceptance hires Aguirre for 588 pesos and Lagos for 336, then
renews Aguirre for 84, retaining treasury 2,192. Two actual point shots and one
reload spend two owned cartridges and six seconds. Eight rounds and condition 98
remain. Lagos actually dies; validated return keeps Aguirre's existing morale 58
and receives one letter at hour six. Ordinary and presented execution agree, and
full official saved action replay matches. A stale settlement rejects atomically;
two retained-corpse visits preserve the same letter, morale and ammunition.

A second actual route spends 35 tactical orders and 36 seconds, returning Lagos
alive at 14 HP with three bleeding. Fourteen ordinary hours cause death. Saved
one-hour continuations equal a fourteen-hour batch, with one letter at hour 20.
Aguirre retains morale 76, nine rounds, condition 99 and treasury 2,192. Two more
saved hours do not repeat the death or reaction. No health, death, equipment,
ammunition, money, outcome or random state is assigned during these routes.
Mounted received-correspondence controls select an actual arrival letter and the
loss letter without changing campaign state. Old pinned preferences and
unconfirmed tactical losses provide no loss letter.

The affected eleven-file gate passes 93/93 checks. Independent review finds no
blocking issue. The final frozen source passes **4,741/4,741 short checks**, with
zero failures, cancellations, skips or todos. All 675 selected files complete in
314.64 seconds, with `complete: true`; eight established extended files remain
excluded from 683 total files. All 847 test/helper/fixture inputs remain unchanged.
Typecheck and production export **f3f8b951504a** pass (1,133 files, 1,033 asset
references). Documentation and baseline audits, five shard self-tests, complete
683-file shard coverage and whitespace checks pass. The existing paid companion
casualty test was strengthened; no obsolete engine checks required removal. These
results cover this bounded reaction, not the remaining full-video requirements.

## Falling pellet-flight checkpoint — 4 October 2026

The former physical shot-load cap ended every ray at one effective range, before
the shared two-range gravity onset. The new explicit three-range limit allows a
normal resolved near-centre shot to keep a falling tail. The actual selected
load still decides range and force; the aiming range, nine force shares, spread,
accuracy and random-draw rules stay unchanged. The existing exact curve, arc-depth
material loss, physical body regions, ground/slab stops and world bounds resolve
each pellet. Known-only forecasts, warnings and enemy choices use that same
resolver. This limit is authored game tuning, not a copied JA2 range constant or
measured muzzle velocity. See [physical shot loads](../gameplay/tactical/physical-shot-loads.md#falling-pellet-tails--4-october-2026).

The acceptance starts with actual week hires 100 and 110 (252 + 420 pesos),
real arrival and assault admission, and the issued ten shot charges. A declared
flat 48×16 arena and authored representative seed 8 are admitted before any
execution. The empty requested point (11,3) naturally resolves to that same
centre. A later standing enemy is contacted at distance 26.5 before the cap of
30: the original straight height 0.605 becomes 0.499375, changing torso to legs.
The actual shot causes three leg damage and bleeding, spends 26 AP and six
seconds, reduces charges from ten to nine and gun condition from 100 to 99,
and leaves 2,528 pesos. Four ordinary orders match presentation and full saved
replay; real retreat, casualty records and Retiro reentry retain those injuries,
contracts, pockets and finite charges. No player died in this run. The fixture
changes initial geometry only; it is not a fresh campaign victory or balance
proof. No health, gear, outcome, money or RNG was changed after execution.

Reflected flight, supported mass/velocity and the wider full-video requirements
remain open. Cannon, map and 3D presentation remain with the separate assistant.


The six new geometry cases, five consumer cases and one paid shot-load case
pass. The full affected group passes **171/171**, including existing firearm
consumers and the corrected retained-stock/rescue boundaries. Depleted-gun tests
now spend the actual loaded and reserve charges through ordinary orders; a
surviving operator pays a real approach. The rescue controller chooses the best
affordable known-prisoner-safe shot rather than waiting for nearly equal impact.
Its complete saved replay clears the guards and physically evacuates all three
prisoners at their actual 15/84/72 HP, retaining the three actual relief deaths
and exact carried ammunition. No health, gear, RNG or outcome is assigned to
make an acceptance route pass.

The final complete short suite passes **4,753/4,753**, with zero failed,
cancelled, skipped or pending checks. It completes **678/678** selected files;
the established profile excludes eight extended files from 686 total. Typecheck
and the same-source production export **415fca9846c2** pass (1,133 files and
1,033 asset references). The baseline audit passes 38/38; documentation audit,
five shard self-tests, complete 686-file shard coverage and whitespace checks
pass. Obsolete one-range and fixed-combat-result assumptions were replaced by
physical reach, real retained stock and paid safe orders. No engine assertion
was skipped or removed to report green. This is bounded firearm acceptance,
not a full legal campaign or complete video objective.


## Finite roadside discovery checkpoint — 4 October 2026

One optional fictional chest now belongs to an explicit versioned discovery definition. A new stock campaign pins its used crowbar at 60% and linen shirt at 75%; plain new campaigns retain a detached snapshot. Omitted old packages and plain saves stay disabled. Deployment context is copied before the map and finite-stock baseline, and pending, active and retained scenes must match on official admission and return. Existing cell props override fresh metadata, so a prior visit cannot receive a new chest or replacement contents. This is one finite discovery under V12, not a complete optional-encounter system.

Pickup previews and the real mounted inventory retain a canonical complete selected-stack token. A changed quantity, condition, identity or shifted index rejects before cost or debit and requires reselection. The exact token remains valid through an official weapon save/load that reorders its fields. Closed contents remain private. The container selector, paid local use, auto-approach and pickup also use the shared interior-discovery rule; line of sight alone cannot expose an undiscovered room's contents. Doors and exterior walls retain their existing admission.

The actual default seed-45 route pays 252 and 420 pesos for native hires 100 and 110, waits for both six-hour arrivals and marches fourteen hours to cell 24,27. Normal squad formation separates the second explorer. Actual approach, looking, opening and two guarded pickups remove the two canonical identified objects. A second squad finds the retained chest empty. The carrier pays another fourteen-hour march to Retiro, sleeps seven actual hours, and returns over fourteen hours for reentry. At hour 55, second 191, treasury is 2,528 pesos; the two soldiers retain their original 70/85 HP, zero bleeding and ten rounds each. The original pocket records and displaced poncho remain owned. The crowbar stays at 60%, the worn shirt at 75%, and the chest stays empty. Thirty-two recorded events reproduce the complete official campaign and scene; ordinary and presented tactical execution agree.

A separate continuation from the truly acquired shirt checkpoint consumes that packed shirt into three finite dressings through the existing paid recipe. It spends two exploration seconds and changes no money, ammunition or health. Complete saved replay and reentry retain the consumption. This branch is never combined with the main continuation to keep both the shirt and the dressings. No health, money, gear, seed, location or successful result is assigned during either route.

Eight older synthetic fixture files now declare the matching discovery context beside their existing errand context. Their original equipment, health, outcomes, geometry, byte limits and assertions remain intact. The twelve-file context gate passes 90/90 checks; the separate paid route passes 1/1. Broader period-supported discoveries, optional encounters, quest consequences and full campaign acceptance remain open. Door-mounted explosive charges remain outside the active plan; future equipment must fit 1810–1820. Cannon, map artwork and 3D presentation remain separately owned.

The final frozen game and test input passes the complete short suite: **4,764/4,764 checks, zero failures, cancellations or skips**, all 680 selected files completed in 327.78 seconds, with `complete: true` and no name filters. Eight established extended files remain excluded from 688 total files. The final owned content/action gate passes 7/7, the container/interface/privacy gate 86/86, and the context gate 90/90; independent source and consumer reviews find no blocker. Typecheck and production export **06311759d7ea** pass (1,133 files and 1,033 asset references). Documentation, baseline (38/38), shard self-tests/complete coverage and whitespace checks pass. The production digest matches the frozen source. Extended campaign simulations and a browser playthrough were not repeated for this small batch; the actual mounted component checks and paid route establish their stated bounded behavior. The full-video objective remains open.

## Witnessed companion-loss checkpoint — 4 October 2026

A capable issued participant who directly observes a preferred military companion's positive-HP to zero-HP transition now loses up to six additional morale once per directed pair. Actual sight and room disclosure are captured before fatal injury or tactical bleeding changes the body. The complete pinned preference list decides eligibility even when the morale cap admitted no support. A small saved record retains the actual clipped loss. Existing physical-hit casualty loss, tactical bleeding behavior, issued support removal and confirmed-loss letters remain separate; the letter adds no further loss. The number is explicit Granaderos tuning.

The existing accuracy rule uses the lower morale without changing action costs or the AP budget. A named notice uses the existing four-second feedback expiry. Mounted checks prove expiry, duplicate silence and saved replay. Critical living companions, hidden deaths, incapable witnesses and retained old bodies admit no new reaction. Real local recruitment extends the issued participant list without new support or preferences. An authored mission-ally preference also survives actual death, the existing strategic health mirror and validated mission defeat return. Older omitted context remains neutral. Active saves, sync, automatic-combat resume and actual return preserve earned records; edited or erased records reject.

Native paid Retiro routes retain finite equipment, contract costs and complete ordinary/presented saved replay. Two actual point shots kill Lagos and leave Aguirre at 61 tactical morale and 52 after return, eight retained rounds, condition 98 and treasury 2,192 pesos. The untreated tactical-bleeding route uses 65 legal orders and 66 seconds, retains nine rounds and condition 99, and returns Aguirre from tactical 79 to personal 70. Paid corpse reentries add neither another loss nor another letter. No health, ammunition, money or successful outcome is granted during execution.

A separately declared flat, dry performance arena compares the current issue with an older pending-context control prepared before first admission. The same 21 legal orders, two point shots, reload and normal aimed fire leave morale 61 versus 67 and public contact forecasts 12% versus 13%. Both normal shots cost 10 AP and retain the same final seed 2146095206, seven rounds, condition 97, 56 seconds and the witness's actual 72 HP. Physical retreat returns personal morale 47 versus 53. This prepared arena proves the morale consequence and equal paid costs; it is not an earned opening victory.

The first complete short run passed 4,778/4,779 checks. Its one failure exposed a lightweight NPC-only gift probe that intentionally lacks full battle units. Grief validation now runs there only when both a pending battle and full units are present; mandatory active save, sync, talk, return and resume validation remains intact. The same existing gift test now also covers an immutable no-pending probe. Independent review and the final affected gift/core gate pass 69/69; feedback/UI checks pass 23/23; paid acceptance checks pass 10/10. These groups overlap the complete suite.

The final frozen source and tests pass **4,779/4,779 short checks, zero failures, cancellations or skips**, all 683 selected files complete in 290.52 seconds, with `complete: true` and no name filters. Eight established extended files remain excluded from 691 total files. Typecheck and production export **400b9e9c4764** pass (1,133 files and 1,033 asset references), and the current source digest matches the built digest. Documentation, baseline (38/38), shard self-tests/complete coverage and whitespace checks pass. Extended simulations and live player-browser QA were not repeated. The player origin at localhost:3141 was untouched.

Door-mounted explosive charges are excluded under the user's period restriction. Current entry choices use keys, locks, lockpicks, crowbars and alternate routes. Future explosives require reliable evidence for this setting. Broader relationship complaints, contextual fears, departures, recorded voices and the full-video campaign acceptance remain open. Cannon, map and 3D presentation stay separately owned.

## Glancing stone-flight checkpoint — 4 October 2026

Single balls and each finite physical pellet now permit one reflection at a
unique exposed vertical entry face of explicit stone cover. Ambiguous corners,
zero-depth touches, shared interior faces and top/bottom contacts do not reflect.
The maximum absolute incoming direction/normal dot product is 0.3; a qualifying
entry retains half the current abstract force. The numbers are explicit game
tuning. Reflection precedes penetration debit, keeps the actual height and
vertical derivative, and spends the original total range and cumulative drop
onset. Cover settings cannot restore body or reflection loss. Later physical
contacts use actual regions and each typed body remains eligible only once per
ray. Reflection geometry makes no random draw.

The [primary lead-pellet experiment](https://kar.kent.ac.uk/107376/) supports a
real rebound phenomenon. It does not establish natural-stone musket-ball
coefficients for 1812. This is a bounded Granaderos adaptation; it does not claim
the reviewed classic JA2 source implements a reflected trajectory. Other
surface reflections, fragmentation and a supported mass/velocity model remain
open under V11. See [the rule and evidence](../gameplay/tactical/stone-ricochet.md).

Known forecasts and enemy choices trace the same rule. An off-axis known ally
can receive a warning. Private stone cover, furnishings and bodies cannot
provide a public bend, material cue, identity or endpoint. Supporting elevations
and actual upper-floor slabs remain in the transient known scene. Near-miss
learning evaluates the exact continued segments before their terminal stops,
rather than the chord from the original muzzle to the final point. Observed
single-ball playback emits successive clipped legs with one discharge; the
real injury arrives after flight. Mounted execution admits one authoritative
final result and holds input during playback.

The paid acceptance hires native soldiers 107 and 110 for actual weekly prices
588 and 420 pesos, waits for arrival and admits an assault. Its declared flat
32×16 firing arena, passive hostile posts, dry weather and seed 8 precede official
save admission. They are initial geometry, not an earned opening victory. One
real empty-point shot reaches the exposed stone face at (7.75,4.5), height 1.175,
with force 42, then retains 21. The same ball contacts the observed later torso
at (11.5,3.6667), height 1.05, after 10.756 of its 16 horizontal-distance budget.
The actual enemy falls from 100 to 81 HP. The shot spends 19 AP, six seconds,
one charge and one condition point; rounds become ten to nine and condition
100 to 99. Treasury remains 2,192 pesos. Two observed flight legs share one
muzzle discharge and precede the actual injury.

All four real fire/move/move/issued-exit orders agree through ordinary,
presented and full official saved replay. Real retreat settlement and Retiro
reentry retain contracts, enemy injury, pockets and finite equipment. Both paid
actors return alive at their native 72/85 HP with no bleeding. No health, money,
gear, successful outcome or RNG is assigned during execution.

The 3D renderer can proceed in parallel against current cell-centred XY,
tactical level and absolute body heights. It consumes normalized observed
`shotVisual` frames; later legs use `discharge: false`. Raw private segments,
obstacle IDs and force records stay in resolution and do not enter a save or
renderer input. Models, terrain, camera and animation work need not wait for
this gameplay merge. Cannon and 3D implementation remain separately owned.

The ten new core cases and five consumer cases pass. The core affected gate
passes 103/103; the eleven-file consumer/mounted gate passes 121/121; the
independent paid acceptance passes 1/1. These groups overlap the complete suite.
Independent core and consumer reviews find no blocking issue in this bounded
scope. The first complete short run passed 4,795/4,795 checks. A final paired-HUD
review then found that zero predicted target damage was described as a stopped
shot, although both pistols could deflect. The text now says no predicted impact
on the selected target. The existing consumer case checks both finite loaded
pistols, their neutral labels, retained ricochet/known-ally warning and immutable
preview. The same affected gate passes 121/121 after this two-file correction.

The next complete short run passed 4,794/4,795. Its only failure was the older
paired-pistol text assertion expecting the removed stopped-shot label. That
assertion now expects the neutral selected-target wording; its zero main-hand
chance, exact 42-force offhand remainder, 91% cover loss and different-hand
checks remain intact. The expanded twelve-file affected gate passes 129/129.
Production source remains unchanged by this test-only correction.

The final frozen source and tests pass **4,795/4,795 short checks, zero failures, cancellations, skips or pending checks**, all 686 selected files complete in 589.86 seconds, with `complete: true` and no name filters. The established profile excludes eight extended files from 694 total. The final run uses four workers; selection remains complete. Typecheck and production export **8033caeb7f9f** pass (1,133 files and 1,033 asset references), with the built source digest equal to the frozen source. Documentation, baseline (38/38), five shard self-tests, complete 694-file shard coverage and whitespace checks pass. Extended simulations and live player-browser QA were not repeated. The player origin at localhost:3141 was untouched. Wider personality, discoveries/quests, voices and full campaign/video acceptance remain open.

## Contextual care checkpoint — 4 October 2026

New default Cejas content now carries explicit `care_composure`. Effective first
aid to another directly observed living person reduces the caregiver's current
shock by up to two. Military patients must be on the same side; any room containing a civilian
patient must also be disclosed. A real owned dressing and the normal
medical action remain necessary. HP, bleeding or bandaged coverage must improve.
Self-care, ineffective care and rejected actions grant nothing. These are
Granaderos personality rules, not verified JA2 or historical numerical rules.

Recruitment, dossier, editor and allowed medical previews disclose the condition
and cap. Accepted manual care can show a short named notice with actual relief.
Its UI identity restarts the existing four-second timer even for equal messages.
The action-local notice is absent after a saved or worker clone; the current
manual care UI uses synchronous presented execution. No saved reaction ledger,
voice, strategic reward, extra morale, energy or AP is introduced. Older pinned
packages that omit the ability stay neutral. Pinned capabilities are checked
before active clock synchronization, settled clock updates and full return.
Stored resume snapshots are checked during restoration and before they can be
discarded by a later campaign or clock action.

The paid acceptance hires native Cejas (130) for 252 pesos and Acosta (110) for 420,
retaining 2,528. Real arrivals occur at hour six and the assault at hour eighteen.
Its prepared 48×16 arena declares a stone screen at 7,2, passive enemy posts and
representative seed 42 before initial official save admission. The original
four-enemy force, native health, skills and finite equipment remain. Two earlier
open-lane probes failed before care. This screened acceptance does not establish
a fresh opening victory or full-campaign balance.

Nineteen legal events and 24 tactical seconds produce one real enemy death and
no player deaths. Hostile attacks leave Cejas at 30 HP and Acosta at 36 HP, each with
three bleeding. Cejas's actual external care costs 20 PA and one dressing, leaves
Acosta at 36 HP, stops his bleeding and lowers her shock 2.125→0.125. Medical
practice and its random seed match ordinary care. Her conditional aim-one next-shot calculation
is 2% against the older pinned control's 1%, for an enemy directly visible to
her and her team. The pistol is empty: the actual public preview offers the
normal 32 PA reload and shows no attack chance yet. No paid post-care reload or
further discharge is claimed. Acosta's normal reciprocal care
costs 25 PA and one dressing and stops Cejas's bleeding without restoring HP.

The pistol and musket retain eight and nine of their original ten rounds,
condition 98/99, and one of each person's original two dressings. Ordinary and
presented execution agree. Every event replays through official saved orders;
the issued north exits charge 8 PA each. Validated Retiro return, stale-settlement
rejection and two actual visits/leaves preserve wounds, gear, terms and money.
Return-to-sector shock uses the existing transient rule; no saved calm reward
is inferred. The old pinned control has identical clinical costs, practice,
combat randomness, actual casualties and returned custody.

The core affected gate passes 82/82; the consumer/editor gate passes 173/173;
nearby unchanged feedback/civilian checks pass 18/18; the final context/clock gate
passes 34/34; and the independent paid acceptance passes 1/1. These groups overlap
the complete suite. The final frozen run passes **4,810/4,810 short checks**, with zero failures,
cancellations, skips or pending checks. All 689 selected files finish in 384.36
seconds with `complete: true`, eight workers and no name filters. The established
profile excludes eight extended files from 697 total. Typecheck and production
export **44a5c9460438** pass (1,133 files, 1,033 asset references); the built source
identity matches the frozen input. Documentation, baseline 38/38, five shard
self-tests, complete 697-file shard coverage and whitespace checks pass. Source
and all 861 test/support paths retain their frozen hashes. Extended simulations
and live player-browser QA were not repeated. The player origin at localhost:3141 remains untouched.
V06 fears, complaints, evolving opinions and later departures remain open. V15
recorded voices and broader discontent remain open. Cannon and 3D presentation
remain separately owned.


## Competing-beneficiary checkpoint — 4 October 2026

Fresh Retiro errands now let the same two finite ponchos go to either the sargento at Retiro or the port foreman at Ensenada. The first accepted garment fixes the recipient. The offer, held-item preview, selected-item preview and notebook disclose the decision. The other contact can refuse an actual physical offer without taking its garment. Full custody waits for adjacent quest confirmation and the selected sector's control before one reward. Retiro supports the Buenos Aires town; Ensenada supports its own town. This is fictional period content and declared game tuning, not a historical allocation claim. See [competing beneficiaries](../gameplay/characters/competing-beneficiaries.md).

The native seed-42 default campaign pays 252 and 420 pesos for soldiers 100 and 110 and waits for their actual six-hour arrivals. Eighteen recorded events stow, hold, approach and deliver their two original, 100%-condition ponchos, confirm through the actual contact, leave and reenter. Delivery takes nineteen tactical seconds. Treasury remains 2,528 pesos, both original health values remain 70/85 with zero bleeding, both retain ten cartridges and their actual contract terms, and every original pocket record remains owned. The exact garments remain at Retiro. Ordinary and presented execution agree on every tactical order; official saves and complete replay reproduce the result. This proves a fresh paid visit, not conquest or a full campaign victory.

The territorial checks declare a separate starting checkpoint before any paid order: Buenos Aires, Retiro and Ensenada are controlled; Buenos Aires/Retiro start at 34 support and Ensenada at 42. Actual academy progression during arrival adds eight points to the Buenos Aires town and keeps its real event. The Retiro delivery then moves 42 to 50 while Ensenada stays below the threshold. The Ensenada route instead spends the actual 24-hour march; ordinary daily politics move its support to 43 before delivery, which then reaches 51. Buenos Aires/Retiro remain below 50. These values are never reset during play. Only the chosen town admits the ordinary 60-peso course for three pending trainees; the other course rejects. No garrison is granted. Treasury is 2,468 pesos after the course, health and ammunition remain unchanged, and the port agreement remains unset. Both actual reentries retain the exact garments and single reward. The nineteen-event Retiro and ninety-one-event Ensenada replays prove this prepared checkpoint, not earned territory.

A fourth, separately declared secured checkpoint sends the same two paid hires to their ordinary Retiro and Ensenada arrival destinations. Normal squad selection, visits and physical approaches let soldier 100 fix the Retiro branch with one poncho. Soldier 110 then offers his original poncho to the actual other contact, who refuses it. The one-second exploration attempt retains that garment at 100%, creates no opposite receipt and retains 2,528 pesos. Twenty recorded events reproduce the result through official saves. This prepared courier route proves cross-sector refusal and finite ownership; it does not claim a native Ensenada conquest.

The same accepted choice is bound in the quest record, issued request and battle. Partial-choice deletion, a changed branch, conflicting resume maps and a forged choice through an already trusted zero-delta clock reject without changing time or items. A resume cannot authorize its own unsupported choice, including through a matching clone. Actual new and acknowledged supply receipts require a full tactical report before a clock-only call can discard the resume; refusal preserves the exact snapshot, time and items. Scene construction uses the already issued map for local custody checks, while campaign admission checks that map against the saved quest records. Older explicitly pinned cash-or-support and omitted legacy definitions keep their previous behavior. Authoring and mounted-control checks cover both contact references, saved launch, pending delivery and actual confirmation. The full-video objective, wider quest outcomes and extended campaign acceptance remain open.

Separate declared clinical arenas earn selected, unselected and both-unselected contact deaths with finite real pistol orders. They check failure identity and missing death evidence without claiming a native conquest. Partial and complete receipts acknowledged together with a selected death fail without a quest reward. Authored fixed contacts retain their stable death identity after a temporary relocation. The journal distinguishes an unchosen errand whose two recipients died.

The first frozen short-suite run completed all 691 selected files and reported seven failures in five files (4,824/4,831 checks passed). Three files still instantiated fresh dual-recipient definitions while asserting older single-contact death behavior. Those cases now pin the older definitions before their first orders; their death, health, seed, loyalty and save assertions remain. The expanded-map fixture now carries its actual initialized choice map, and the weather-resume fixture now supplies its actual campaign/request context. No production rule was relaxed to repair these fixtures. The failed log and timing report remain available separately from the final run.

The final frozen short suite passes **4,831/4,831**, with all **691/699** selected files complete, eight declared extended files excluded, eight workers, zero failures, cancellations or skips, in **305.05 seconds**. Type checking, production build, documentation/baseline audits, shard self-test/coverage and whitespace checks pass. The verified static export contains **1,133 files and 1,033 asset references**, with source ID **d3d829c2ac20**. All **863** test/support paths retain the final frozen SHA-256 **8178cbb61cb7c48faace6d99750670dc88f583cc49af8cd26bca2a88a4546b91**. Final production source and test inputs are unchanged after the run. Extended simulations and the separate 3D renderer were not rerun. The player origin and primary untracked references remain untouched.


## Conduct-objection checkpoint — 4 October 2026

Fresh default Inés Aguirre content now declares `civilian_conscience`. The condition is disclosed in hiring, dossier and authoring controls. A capable owned issued observer must directly see both attacker and a living explicitly classified noncombatant, with the interior revealed, before an actual intentional nonmilitia player impact takes the victim to zero HP. Common physical impacts and an existing intentional grenade target use the same consequence without changing their damage, ammunition, action cost, randomness or presentation rules. The perpetrator can also object to continuing such orders when capable and directly observing the victim. Military residents, armed people, prisoners, accidental or enemy attacks, delayed bleeding, hidden events and old corpses do not create it. NPC membership alone is insufficient. This is a fictional Granaderos character rule, rather than exact classic JA2 conduct parity or a historical psychology claim.

The first objection is immutable and retains typed civilian and attacker identities. It blocks future renewal and hiring, while accepted paid service continues. Full clock reports, conversations, stored resumes, actual returns and official saves validate retained evidence and pinned classification. A resume cannot authorize its own unsupported receipt; a clock-only action cannot erase the sole unreturned event. Only the owned issued squad gains witness authority. An actual newly paid local recruit with an explicit capability can join it; scene auxiliaries and retained bodies cannot. Older pinned definitions with the capability omitted remain neutral. A capable serving witness receives one named inbox letter on validated return. The ordinary deadline and equipment-return rules decide departure.

The native acceptance pays actual day contracts: Aguirre 84 pesos and Sosa 36, retaining treasury 3,080. Both arrive normally at hour 6 and travel normally for 12 hours to Buenos Aires. Flat geometry, passive posts and seed 42 are declared before the first official arena save. The native hostile force, resident, health, gear and terms remain finite; this is not an earned opening victory. Four real facón strikes take the port resident from 100 to 68, 36, 4 and zero HP. Eight legal orders, including movement and the issued Retiro exit, spend 29 tactical seconds. Both hires keep their original 72/70 HP and ten cartridges each; seed 42 and firearm condition remain unchanged.

Ordinary and presented execution agree. Every order replays through official saves. The real retreat settlement retains one complaint and one received letter, refuses renewal atomically and survives two ordinary Retiro entries. Service continues to the original hour-30 deadline, including its final second. Thirteen actual strategic clock actions pass through the warning and exact expiry; all twenty original equipment stacks return once at Retiro. The saved objection still refuses a later hire. Older pinned and screened-witness controls perform the same lethal actions without a reaction; later corpse sight does not backfill one. A separate actual paid local hire proves witness admission, save, synchronization and return. A real friendly conversation after an unsynchronized fatal impact proves that civilian acknowledgment cannot lose the admitted reaction.

The core, context and native acceptance gate passes 18/18. The separate UI/editor gate passes 106/106, including real saved correspondence, visible renewal reasons, ordinary dismissal, refused rehire and the shared authoring predicate. During integration, combined checks caught an early-retention ordering error in the checkpoint wiring; retention now occurs at each actual acknowledgment boundary after context validation. Two initial guard cases also used a visit-only return command for an assault; they now use the actual combat-result path. No production rule or test expectation was weakened to hide those failures. Final frozen short-suite and build results follow below.

The final frozen short suite passes **4,851/4,851**, with all **694/702** selected files complete, eight declared extended files excluded, eight workers, no name filters, and zero failures, cancellations, skips or pending checks, in **346.42 seconds**. The adjacent engine gate passes 75/75; the independent acceptance rerun passes 2/2. Type checking, production build, documentation/baseline audits, five shard self-tests, complete 702-file shard coverage and whitespace checks pass. The verified static export contains **1,133 files and 1,033 asset references**, with source ID **7c59f4a1391a**. All **867** test/support paths retain the frozen SHA-256 **43f577c8d8d0ae3cd0caa462d63c2ddfd772c513361af672e7ef74d254826a6a**. Production source and test inputs are unchanged after the run. Extended simulations and live player-browser QA were not repeated. This batch leaves the separate 3D renderer, player origin and primary untracked references untouched. Wider contextual reactions, recorded voices and full finite campaign acceptance remain open.


## Nervous-isolation checkpoint — 4 October 2026

Fresh default Ángela Cejas content declares `nervous_isolation`. A capable owned
soldier with the explicit ability, morale below 50 and no capable friendly
military companion within four same-surface tiles gains up to two ordinary
shock points at a real new player combat turn. All actors complete normal
recovery first. Regrouping stops new additions without refunding shock.
Existing firearm accuracy and interruption calculations use the result. This
changes no AP, HP, personal morale, experience, equipment cost or random draw.
Older pinned ability lists that omit the condition remain neutral. The classic
[source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Morale.cc#L154-L195)
checks low morale and isolation, but these timing, range and shock values are
declared Granaderos tuning. Underground and enclosed-room fear remain open.
See [nervous isolation](../gameplay/characters/nervous-isolation.md).

Hiring, dossier and authoring controls disclose the condition. The inventory
separates current tension from the conditional next-turn forecast. The first
actual fear event in a deployment shows one short named notice using the
existing four-second popup. Inspecting inventory or loading a save creates no
event. A successful file import starts a fresh Battlefield component session;
a real mounted Page test imports a later earned save of the same battle without
repeating its notice, then imports the pre-event save and plays the actual turn.
A rejected import keeps the current battle and active message. New deployment
clears the informational flag alongside the existing transient-shock reset.
Active official saves and interrupted-turn continuation retain the real shock.

The paid native acceptance hires Cejas for 36 pesos and Acosta for 60 on actual
day contracts, leaving 3,104. Both arrive at hour six and reach Buenos Aires
at hour eighteen through the ordinary twelve-hour march. The prepared 48×16
observation arena, stone screen at 7,2, passive hostile posts and seed 42 are
fixed before the first official save. Native force, health, skills, finite
ammunition and dressings remain. Earlier actual probes lost Cejas, suffered
untreated bleeding loss or failed to reach the condition; the outcomes were
not patched. Their retained summaries are labelled as summaries rather than
complete execution logs. This acceptance is not an opening conquest or a
full-campaign balance claim.

Real hostile fire, a further miss and paid self-care leave Cejas at 30 HP,
zero bleeding and 48.7 morale. Acosta reaches an actual unconscious 3 HP and
five bleeding, so he supplies no support. Cejas's normal shock recovery
2.125→1.0625 precedes the real two-point fear addition, yielding 3.0625.
The older pinned control stays at 1.0625. Actual finite pistol reload costs
32 PA; the loaded aim-one forecast is 7% against the control's 17%, both clear
of the chance floor. The paid 18-PA shot uses one cartridge and one condition
point and naturally misses in both controls with equal combat randomness.

The issued north exit and ordinary retreat leave Acosta in hostile custody
at 3 HP and five bleeding, holding his nine remaining rounds. At hours 19 and
20, existing finite custody care uses his two confiscated native dressings:
3→9→15 HP, bleeding five→zero, dressings two→zero. The accepted test follows
these actual receipts. A real 36-peso Sosa hire, six-hour arrival, 36-peso Cejas
renewal and twelve-hour return leave 3,032 pesos. Cejas retains 30 HP and her
ordinary 45.7 morale on reentry; deployment shock starts at zero. Paid
separation earns two shock at the next actual combat turn while hostile fire
leaves Sosa at 27 HP and three bleeding. His own dressing stops that bleeding
without restoring HP. Runs costing 30 and 42 PA bring the two soldiers within
three cells. Regrouping refunds nothing; the next real combat turn performs
normal recovery, shock two→one, with no further fear addition.

All 43 recorded events replay through official saves. Every tactical order
agrees between ordinary and presented execution and preserves its input. Two
actual Retiro visits retain wounds, personal gear, terms, captured custody and
cash. Final survivors have 30/27 HP, zero bleeding and one dressing each;
Cejas/Sosa retain seven/ten rounds and captured Acosta retains nine. One real
enemy death remains saved; no player died in this accepted route. The final
clock is hour 36, second 53, with seed 110225632. No enemy defeat or rescue is
claimed.

The acceptance exposed an existing save defect: dynamic prisoners were checked
as authored residents and discarded by placement synchronization. The narrow
presence fix validates prisoner shape and requires the exact capture identity
and sector in an existing custody receipt or current issued prisoner manifest.
Unknown prisoners, changed capture sequences, wrong sectors and duplicated
weapons still reject. The real default-content capture/reentry test retains
both legitimate sources and the exact health and custody receipts. Existing
detention health and equipment checks remain active. Early focused failures
also caught a test checkpoint that omitted the tactical scene for an issued
attack and a menu test that clicked the campaign-return button instead of the
menu-close button. Those tests now follow the actual admission and control;
no production rule was weakened to satisfy them.


The affected fear gate passes 60/60; the final UI/editor/feedback gate passes
108/108, including the actual Page file-import regression. Presence and
capture checks pass 12/12, nearby detention checks 30/30, and the independent
43-event paid acceptance 1/1. These groups overlap the complete short suite.
Two early core cases initially mistook a real interrupted enemy phase for a
new player turn; they now preserve that phase and resume through ordinary
orders and official saved continuation before asserting the exact fear or
regroup result. Companion recovery is checked in both roster orders.

The final frozen short suite passes **4,865/4,865**, all **697/705** selected
files complete, eight declared extended files excluded, eight workers and no
name filters. There are zero failures, cancellations, skips or pending checks;
`complete: true`, elapsed **349.55 seconds**. Type checking, production build,
documentation/baseline audits, five shard self-tests, complete 705-file shard
coverage and whitespace checks pass. Static export contains **1,133 files and
1,033 asset references**, source ID **2292bef41f82**, equal to the frozen source.
All **871** test/support paths retain SHA-256
**3e7f6ac80e64e305ef28f77935d84a78b7221057c2610d71dffdd01d4f8fc6f2**.
Production source and test inputs remain unchanged after validation. Extended
simulations and live player-browser QA were not repeated. The player origin,
primary untracked references and separate 3D/cannon work remain untouched.
V06 enclosed-room fear, strategic isolation, prolonged panic and wider evolving
opinions remain open. V15 recorded voices and broader event speech remain open.
Full finite campaign and full-video acceptance remain open.


## Load-specialty checkpoint — 4 October 2026

The existing `scatter_concealment` specialty now checks the resolved physical
pellet load instead of weapon ID 1807. It halves the target-concealment term
for a cone load in any firearm. A blunderbuss firing a single ball is neutral;
a musket or pistol firing an alternative shot load can benefit. An authored
single ray remains neutral even if it uses the shot ammunition family. Each
hand in a pistol pair uses its own resolved load. Material resistance,
visibility, charge ownership, AP, time and projectile rules remain unchanged.
The shared Spanish description discloses that scope in hiring and dossiers.
Legacy ability fallback is preserved; an explicit empty ability list overrides
it. This is a correction to an existing Granaderos specialty, not a new claim
about classic JA2 or historical shot accuracy.

The declared finite subsystem arenas give native and authored pellet forecasts
of 90% without the specialty and 92% with it. These are chances of at least one
pellet contact, not center-hit or multiple-hit guarantees. In a mixed pistol
pair, the ball hand stays at 36% while the pellet hand changes 86%→88%.
Single-ball controls have identical forecasts and actual paid outcomes with or
without the specialty. Ordinary and presented orders agree, and validated
tactical snapshots replay the same finite discharge. Hidden bodies and private
cover remain absent from public forecasts, warnings and projectile metadata.
These prepared arenas do not prove a fresh paid campaign or a conquest.

The mounted inventory case uses the actual unload, load-select, reload and
map-click fire controls. A pistol starts with a ball, changes to shot, pays
one real shot and returns to a ball. The forecast follows the current load;
AP, condition and typed ammunition are debited normally. Saved replay retains
the result. The old weapon-ID-only assertion was replaced by checks of selected
loads while the separate mud-riding and night-scouting cases remain.
Two early core setup failures incorrectly expected another six tactical
seconds after the same round was already charged, and supplied an offhand
weight that disagreed with its pinned definition. Their corrected fixtures
and assertions follow the existing rules; no runtime rule or seed was changed.

The affected engine checks pass **50/50** and the mounted UI checks pass
**13/13** without React act warnings. These groups overlap the final complete
short suite: **4,872/4,872**, all **698/706** selected files complete, eight
declared extended files excluded, eight workers and no name filters. There
are zero failures, cancellations, skips or pending checks; `complete: true`,
elapsed **351.21 seconds**. Type checking, production build,
documentation/baseline audits, five shard self-tests, complete 706-file shard
coverage and whitespace checks pass. Static export contains **1,133 files and
1,033 asset references**, source ID **efe31895022d**, equal to the frozen source.
All **872** test/support paths retain SHA-256
**0424475a2e9bc220590017b1b4d65b1ac474baf13de235c14eaccd74796ce3e1**.
Production source and test inputs remain unchanged after validation. Extended
simulations and live player-browser QA were not repeated. The player origin,
primary untracked references and separate 3D/cannon work remain untouched.
Tactical gun maintenance without repair materials, broader V05 physics and
full finite campaign/video acceptance remain open.


## Finite firearm-maintenance checkpoint — 4 October 2026

The exposed tactical repair order now uses the existing finite materials.
**Mantener arma** shows the actual condition gain, rounded-up material debit
and refusal reason through the same read-only preview used by the dispatcher.
It restores up to the original 30/40/45 points for ordinary, workshop-trained
or gunsmith-trained soldiers, bounded by damage and remaining material points.
The original 25/18 AP, exploration time and mechanical practice remain.
Numeric reserves are spent first, then physical packed kits in stable key
order. Exhaustion removes the kit and clears its held references. Failed
admission changes no stock, AP, time, practice or ballistic RNG. Charges,
ammunition, jam state, firearm identity and fittings remain unchanged.
Misfire clearing retains the separate implicit ignition operation; this change
does not issue loose flints or powder. Rates and kit sizes are game tuning.

A fresh default seed-45 campaign pays 420 pesos for native soldier 110 and
waits for his real six-hour arrival. Actual approach, opening and pickup acquire
the identified Retiro toolkit once. Three real empty-ground discharges spend
three owned cartridges and earn three condition points of wear, threatening
no observed bystander. Maintenance restores 97→100 condition for three points:
the kit keeps 97, rounds keep seven of ten, HP stays 85 and treasury stays
2,780 pesos. The native route spends eleven field seconds after pickup,
including two for maintenance, and ends at hour 6, second 22. Official saved
replay, return and reentry retain the same kit, gun, depleted chest and costs.
This is a bounded native acquisition/maintenance route, not a conquest.

A separate explicitly declared older checkpoint starts after the same paid
arrival, before its first official admission, with condition zero and two
existing numeric repair points. All later materials come from the real
100-point chest kit. Actual repairs and three finite discharges exhaust all
102 points; the final gun has condition 99 and seven rounds. A further repair
rejects without a refill. Return and reentry preserve numeric zero, the absent
kit and the depleted source. The scenario changes no resources after initial
admission and does not claim the worn checkpoint was earned in combat.

Accepted active checkpoints retain the last numeric remainder in the pending
deployment. Official saves, clock synchronization (including the settled fast
path), return and independently stored continuation snapshots reject invalid,
missing positive or increased reserves. A reserve of two that has actually
been spent cannot return as one at a later accepted checkpoint. Stored resumes
are checked before handoff or clock-only disposal. These are bounded custody
checks, not a claim that arbitrary save editing is fully prevented.

The old implicit free-maintenance assertions now declare finite stock in their
existing progression/readiness subsystem fixtures and check exact spending.
Their skill, ignition, charge and readiness assertions remain. The mounted
inventory cases exercise a 17-point physical kit and an eight-point old reserve
through the actual control, including explanations and disabled exhausted
stock. The mounted kit case checks a complete official save and action replay;
the numeric control preserves its validated tactical snapshot. Two early acceptance
diagnostics identified the normal refusal log and the initially weaker numeric
custody bounds; the assertion respects that log, and production validation now
closes both restoration and stored-resume gaps. No test expectation was relaxed
to admit free materials.

The older extended northern-route helper still assumes a free one-point repair
and unchanged material inventory. That top-up needs removal with its actual
wear retained, or actual kit acquisition and debit. Either choice needs its
time/practice consequences checked in a complete route rerun; this batch does not
claim that extended route passes. Full stock campaign/video acceptance, wider
physics, personality behavior and recorded voices remain open. Map and cannon
presentation remain with the separately owned 3D effort.

The final frozen source passes the complete short suite: **4,883/4,883**, all
**700/708** selected files complete, eight declared extended files excluded,
eight workers and no name filters. Failures, cancellations, skips and pending
checks are zero; `complete: true`, elapsed **351.25 seconds**. Affected engine
checks pass 121/121, mounted UI checks 57/57, strengthened custody/resume checks
41/41 and the two actual campaign acceptance cases 2/2; these groups overlap the
short suite. Type checking, production build, documentation/baseline audits,
five shard self-tests, complete 708-file shard coverage and whitespace checks
pass. Static export contains **1,133 files and 1,033 asset references**, source
ID **43cd0b3fc3cd**, equal to the frozen production source. All **874**
test/support paths retain SHA-256
**746654cba904d6d99b5a127b7a59dce131acdcc59f433f791b4fa05134995187**.
Production source and test inputs remain unchanged after validation. Extended
simulations and live player-browser QA were not repeated. The player origin,
primary untracked references and separate 3D/cannon work remain untouched.

## Enclosed-room fear checkpoint — 4 October 2026

[PR #166](https://github.com/fsodano/granaderos/pull/166) merged as
`b87e09319eedc733cf97c8b2210030e25a0b80b5`. Its reviewed head is
`5214ebf8e297d36780938888f97195a6c9a5b93c`; the merge retains the exact tested
tree `b6ff92395c3c07b2b7d3590a9826fa18a2b09e56`. The optional fresh Godoy
condition adds up to two ordinary shock after normal recovery in an intact
occupied room. Actual exit or wall breach prevents further additions. Its
brief named notice does not repeat on saved import. Older pinned omissions
remain neutral. See the [scoped evidence](enclosed-room-fear-2026-10-04.md) for
the ground roof metadata limits and supported upper platform geometry.

The paid acceptance uses Godoy's actual 294-peso weekly hire, six-hour arrival
and finite native equipment. It acquires the real roadside crowbar, spends a
real firearm charge, opens a paid wall breach and retains exact costs through
official saved replay, physical return and reentry. Separate paid climbs
exercise an enclosed upper platform and its open-air roof. The encounter room,
passive enemy screen and starting positions are declared before admission.
These are bounded prepared encounters, not a conquest or full-campaign proof.

The frozen gameplay tree passes **147/147** affected checks and the complete
short suite: **4,895/4,895** tests, all **702/702** selected files complete out
of 710, eight declared extended files excluded, six workers and no name
filters. Failures, cancellations, skips and pending checks are zero;
`complete: true`, elapsed **420.265 seconds**. Type checking, production build,
documentation/baseline audits, five shard self-tests, full partition coverage
and whitespace checks passed. The tested and built source is **a5441536eba7**
(full SHA-256
`a5441536eba7f7d28f90bc973e78346656c34ade723e3bd534545c8cd7d04b96`); all
878 test/support paths retain SHA-256
`79e7e18f86c20a60ae132689783b817fc89422d276adf371ff0edb3aff9a2580`.

The amounts and enclosure rules are Granaderos tuning, not an exact JA2
formula or a historical personality claim. Underground fear, strategic
isolation, broader personality consequences, recorded voices and full-video
acceptance remain open. This documentation follow-up changes no game or test
input and does not repeat the already-passed gameplay gates.
