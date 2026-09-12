# Pointer aiming

Implemented 11 September 2026 from the user request and supplied JA2 cursor screenshot. The screenshot is a visual reference; this change does not claim exact JA2 balance or sprite dimensions.

## Controls

- With a firearm equipped, right-click the battlefield to enter aim at level zero. Further right-clicks over a visible character increase aim through the affordable levels, up to four, then return to zero. A right-click away from characters returns to movement and clears extra aim. This also cancels the ordinary item-use cursor. Ground shots remain available by left-clicking before cancellation.
- Move the crosshair over the target's frame: upper quarter selects head, middle selects torso, and lower portion selects legs. Crouched frames are shorter. Prone, knocked-down and unconscious targets have one region, shown as Cuerpo.
- Left-click confirms the shot. Changing the cursor costs no AP and advances no time. The ordinary shot pays the displayed base cost plus extra aim. A miss still spends AP and ammunition; an ignition failure retains the charge under the existing rules.
- The cursor displays the region, total AP, remaining AP and four aim marks. Shared target help separates weapon preparation from discharge; keeping the weapon ready avoids paying preparation again. See [weapon readiness](weapon-readiness.md). Invalid shots use the warning color. Shot warnings remain in the shared target preview.
- Changing target or region resets extra aim. Changing the shooter, held weapon, position or turn also resets it. A completed shot resets extra aim.
- R reloads the equipped firearm or primes it after a misfire. Shift+R selects running. Alt+R remains a reload alias.
- Escape returns to contextual use. L selects paid facing. Confirm the same direction again to prepare a held firearm without firing; the preview shows its AP cost. F and the bracket keys provide keyboard aiming; a focused target uses arrow keys for regions and Enter to confirm. Prone targets ignore region changes.
- Right-click with other equipment enters ordinary item use. Equipped dressings still treat the selected person or the acting soldier. The lower panel no longer has aim-level or body-region buttons.

Ground shots use the existing fixed-height projectile rules and display Casilla. They can hit allies. A clicked hostile's body region comes from that click's position, not a prior panel choice. The simulation also rejects head/leg requests against prone or fallen targets, and enemy shot selection only considers torso for those targets.

## Verification

`aim-cursor.test.mjs` checks free cursor changes, affordable aim limits, exact AP/ammunition use, frame fractions at different zooms, prone restrictions, hidden target admission, invalid-shot rollback and medical item use. `aim-cursor-render.test.mjs` checks SVG labels and aim marks, actual scene pointer/focus/key handlers and confirmed shots. The existing combat-strip render checks verify removal of panel aim/body buttons and the fixed person hit frame.

A user-requested live demonstration in the local San Lorenzo skirmish confirmed right-click entry and an extra aim step: Barcala’s torso shot changed from 11 AP / 70% to 16 AP / 78%, while his current AP stayed at 100. The demonstration exposed a native mouse-focus outline and AP labels beneath the combat log; both were corrected. Prone restrictions and confirmed shot costs are covered by automated checks; live verification of prone targeting remains pending. The frame proportions and aim reset behavior are explicit Granaderos interface choices.

## Empty firearm clicks

A firing click with an empty held firearm performs one reload. The same rule applies to a character target, a ground shot, and contextual firearm use. The cursor shows a reload arrow and the reload AP cost. Reloading works within the available AP and capacity. Completed charges remove their cartridges from reserve. Unfinished work continues on a later order; the reticle shows the immediate cost and the AP still required. See [loading across turns](reload-progress.md). Extra aim and body-part selection do not add to this cost. A second click is required to fire.

When the empty firearm has no reserve ammunition, the cursor shows an X and **Sin munición**. The rejected attempt consumes no AP, ammunition, or tactical time. A loaded last round can still fire with zero reserve ammunition. Jammed weapons still require re-priming with R. Contextual close-range bayonet attacks and other equipped items keep their existing behavior.

Live verification in the separate `?qa=1` San Lorenzo battle confirmed the no-reserve case. Barcala dropped his remaining 11 reserve cartridges through the equipment panel, paying 4 AP (47→43). His last loaded round still fired for 11 AP (43→32). The next firing attempt retained 32 AP and zero ammunition. Right-clicking the field displayed the X cursor with **Sin munición** and **No quedan cartuchos**. The test tab was left at that state for inspection; the normal campaign save was not used. The earlier live reload check, including reserve ammunition 12→11 and AP 89→47, is recorded in [firearm range verification](shot-range.md). All 23 focused empty-gun, aiming and reticle checks pass.

The shot total also includes [turning toward the selected position](shot-turning.md). The preview, extra-aim limit and right-click aim cycle use that complete cost. Moving the cursor remains free.
