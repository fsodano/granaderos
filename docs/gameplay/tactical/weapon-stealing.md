# Taking a held weapon

Patusco's guide, printed pages 64–66, describes a risky adjacent grab with empty hands, Ctrl-targeting and a cost that consumes the remaining AP. It also warns that the victim can still fight. The guide's duplication bugs and claims of guaranteed success for particular characters are not implemented.

## Controls and consequences

Select **Manos libres**, then Ctrl-click or Ctrl-Enter on an adjacent conscious enemy. The normal empty-hand target action still punches. The existing **Recoger equipo** cursor also attempts a grab on a conscious enemy, so the choice is available without a modifier key. Corpses, unconscious people and surrendered people retain ordinary finite looting. There is no new permanent action button.

A grab requires at least 28 AP and consumes all remaining AP on success or failure. The preview shows the full cost. In exploration it consumes two seconds instead. Either result costs eight energy, creates melee noise, changes facing and uses the common reaction rules. A soldier must be standing or crouched, unmounted, capable and free of entanglement. The target must be visible, adjacent, conscious and unmounted. Walls, furniture and blocked diagonal corners prevent the grab.

Success transfers the actual primary or blade currently in the target's hand into the attacker's primary hand. Loaded rounds, condition, ignition failure, instance identity and mounted fitting state move with it. Reserve ammunition and every other carried object stay with their owner. The displaced primary goes into the attacker's pack. If that cannot fit, the attempt is rejected before a random draw or any cost. A missing primary needs no temporary pack slot for the incoming weapon.

The target loses that exact hand item. Repeating the request cannot duplicate it. A disarmed enemy with a remaining primary or secondary blade can pay the ordinary equipment-selection cost to draw it. Urgent field aid retains priority over drawing a backup. The grab does not kill, knock out, surrender or capture the victim.

## Tuning and evidence

The 28-AP minimum, eight energy, two exploration seconds and probability formula are Granaderos tuning. Attack uses strength/dexterity/agility weights 0.4/0.4/0.2; defense uses 0.5/0.3/0.2. Chance starts at 50, adds 0.6 times the skill difference, three points per experience-level difference, 15 for lack of awareness and 15 for a knocked-down defender. Attacker exhaustion subtracts 0.25 per missing energy point; defender exhaustion adds 0.2. Final chance is bounded to 5–95%. The HUD does not publish this percentage because defender attributes and energy are private.

Thirteen tests in `tests/weapon-stealing.test.mjs` cover successful and failed grabs, finite equipment and fittings, capacity, invalid orders, blocked geometry, legacy object weapons, modifier/cursor routing, private information, enemy backup selection, exhaustion, a real saved interrupt and a campaign-bound save. Existing inventory and campaign suites check the common equipment custody paths. This new test file does not establish a played campaign victory or a new campaign report path.

Live verification uses an imported controlled fixture, recorded in [the browser evidence](../../verification/ja2-live-verification.md). Enemies can now select a prepared firearm from their own pack through a paid capacity-checked swap; see [AI field equipment](ai-field-equipment.md). Enemy-initiated theft and a complete loadout policy remain incomplete. The chance values are not an exact JA2 implementation.
