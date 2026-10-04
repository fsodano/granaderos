# Paired pistol fire

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Two loaded, usable pistols in the two physical hands now fire through the ordinary targeting cursor. Right-click to aim, right-click again over the target to add aim, and left-click to fire. There is no extra paired-fire mode. The existing red star still means close combat. That mode uses the selected gun for a strike.

Each gun fires one charge. A double-barrel pistol retains its other charge. The pair uses the larger discharge cost and aim increment of the two guns, with one shared turn/preparation cost. The cursor shows the total AP and both hit chances. Paired aiming applies a 20-point accuracy deduction before range scaling and the final chance bounds. A custom recruit can choose ambidexterity instead of riding, night or teaching specialty; this removes only that deduction. No historical character has been assigned this trait.

Both shots use the original selected point and aim for their accuracy and shared costs. Single-ball pairs also capture the intended absolute height before either gun fires. The second ball keeps that ray after first-shot death, knockdown or unhorsing, while checking the bodies actually present at discharge. It can still strike a fallen body where the original ray crosses it. Seeded misses scatter from that original point and retain its intended height. Point fire captures its intended civilian identity once; later reactions cannot assign a new intentional victim. Authored cone-pistol loads retain their separate existing cone model.

Each gun uses its own condition, ignition roll, projectile power, cover penetration and wear. Successful discharge removes one actual charge and one condition point. Failed ignition preserves that gun's charge and condition, while the other gun still resolves. Experience and militia credit belong to the real actor. Both shots complete within one action before reactions, end-of-combat checks and the action clock advance.

A stored gun never joins the shot. An empty, jammed or broken second pistol leaves ordinary main-hand fire available, without the paired accuracy deduction. An empty main pistol retains the requested reload-click behavior, even if its other hand is loaded. Shift+R or Alt+R follows the [automatic two-pistol reload plan](paired-pistol-reload.md): main hand first, then the second if its complete load fits. With a full main gun, the reload shortcut can continue the second directly. R selects running. Change hands to reprime a failed second pistol; automatic paired reprime remains separate. Placing a pistol in a pocket lets the player fire the remaining gun alone.

Exploration consumes the shot's normal time and ammunition without spending AP. Testing also found an old empty-gun preview error: it treated displayed zero AP as unavailable reload work in exploration. The preview now checks the actual reload plan. A click loads from finite reserve ammunition without firing in the same action. With no reserve, the cross and refusal remain.

Enemy shot selection now evaluates both known projectile paths and their expected effects. It can choose the second gun's useful shot when the main gun cannot penetrate cover. It does not inspect hidden opponents or their private supplies. The shared [automatic reload plan](paired-pistol-reload.md) is now used by enemy maintenance too. Broader automatic equipment selection remains partial.

## Reference and adaptations

The pinned classic-compatible source charges the [larger of the two base firing costs](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Points.cc#L1163-L1168), [deducts AP once](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Weapons.cc#L607-L624), and applies the [two-pistol deduction unless ambidextrous](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Weapons.cc#L2094-L2101). Its [constant is 20](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Weapons.h#L117). These support the control and tradeoff model.

Granaderos retains its 100-point AP scale, weapon-specific aim increments, readiness, black-powder ignition, partial loading, damage formulas and physical collision rules. Taking the larger aim increment, the main-empty reload contract and excluding an already failed second cazoleta are explicit adaptations. This is an equipment choice, not a claim that paired pistols were standard Argentine military doctrine. Artwork and a dedicated paired-pistol animation remain separate.

## Verification

On 4 October, the strengthened original-aim case passed death, knockdown, unhorsing, supported elevation and seeded second-shot scatter. It checks the actual ray, charges, wear, AP, time, RNG, ordinary/presented equality and JSON continuation. Two mounted `Battlefield` cases check the same falling-target orders with input held until one final state commit, concealed-reserve filtering and reduced motion. Independent review found no blocker. Typecheck and production export `f25fa952d0ff` pass, with 1,133 static files and 1,033 verified asset references. The current joint short-suite checkpoint is recorded in the [video review](../../verification/ja2-video-review-2026-10-03.md).

The current unsaved browser arena used the real controls, workers and production styles. A seed-127 paired leg order displayed 95%/95% and 20 AP. The first shot unhorsed the guard for 30 damage; the second kept its original mounted-leg ray and struck the ground. Final state: 70 HP, prone, 80 AP, main/second loads 0/1, eight spare cartridges and six elapsed seconds. The complete state matched an ordinary order. Browser warnings/errors were empty. The temporary tab and generated files were removed; no player campaign was imported or saved. The standing variant still takes an actual second 22-point injury where the same original ray touches the fallen body.

The initial paired-fire checkpoint passed all 2,172 tests with no skips, typecheck, production build, static export verification and diff checks. It preceded the later height correction and is a historical result.

Twenty-five new tests cover shared costs and atomic rejection, each gun's load and condition, partial reload preservation, first-shot death/knockdown, firearm cover, primary/secondary chance, custom profile persistence, a genuine saved interruption, enemy actions, knowledge boundaries, render controls and exploration reload. A fresh custom recruit buys an actual finite pistol, arranges the guns through the real pockets, loads both from reserve, fires, and returns through full saves and sector reentry without refilling either load.

The initial paired-fire checks below preceded the [automatic reload update](paired-pistol-reload.md). Those live checks used a disposable practice scene with the production Battlefield, inventory and reducer. It does not access the user's campaign storage:

- The ordinary right-click cursor showed 8 AP and 78%/66%; one added aim step showed 11 AP and 86%/74%.
- Confirmation spent 100 → 89 AP. Each double-barrel pistol changed from two charges to one, conditions 81% → 80% and 57% → 56%, and reserve stayed eight.
- Save and reload retained both guns. The next shot spent 6 AP, emptied both remaining charges and left 83 AP even though the target died during the pair.
- R spent 55 AP to load two main-hand charges, left the other gun empty and reduced reserve eight → six.
- An already failed second pistol stayed at two charges and 57%; the primary fired once for 8 AP and became one charge at 80%.
- Exploration showed no AP expenditure. A secondary ignition failure kept that pistol's load while the primary fired. After the primary emptied, a direct firing click reloaded two charges from reserve eight → six and did not shoot in the same action.
- The exhausted-ammunition setup showed the refusal and empty reticle.

No browser warnings or errors were reported. Broader gameplay parity remains incomplete; see the current [audit](../../verification/ja2-parity-audit.md).
