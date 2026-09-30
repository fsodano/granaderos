# Autonomous artillery crews

Enemy soldiers and local militia now operate nearby friendly cannon emplacements through the same actions as the player. The optional hired-squad auto-resolve uses the same chooser. This is a Granaderos period adaptation of autonomous weapon use; it does not claim that classic JA2 had these field cannons.

## Decisions and costs

The chooser reserves the required nearest capable soldiers within six tiles, from one side and control group. Hired soldiers and militia cannot borrow each other's crew. A local approach uses a legal path of at most three steps and 24 AP, followed by a fresh decision. The AI does not move a cannon or recruit a remote crew. Close enemy contact and urgent medical needs take priority over the emplacement.

A crew can prepare an unloaded piece without a visible target. Reloading uses the actual remaining fraction and the least available crew AP. Only completion consumes a reserve round. A loaded piece fires only at a target the current operator can see, at ground level and within the gun's range. An out-of-arc target requires a paid pivot, with enough AP left in every assigned operator's budget to fire afterwards.

Solid shot and canister share their physical trace with the firing action. The chooser checks the whole penetrating line or canister cone. Known friends, surrendered/routed/unconscious people and visible civilians prevent an unsafe shot. Enemy private ammunition, inventory and energy do not enter the score. An unseen enemy does not enter the planned trajectory; the actual shot still resolves against the complete field. Reload, movement and target choice do not create ammunition or change gun ownership.

A serviceable enemy or militia emplacement keeps its required local crew when there is no visible target. Extra soldiers can use their ordinary AI. Exploration patrols also keep assigned crews at the post without spending AP or movement energy. An exhausted gun with no loaded or reserve ammunition releases the post. The optional hired-squad auto-resolve retains its search behavior, so a hired force can look for an unseen opponent.

## Shared turn budget

New enemy turns issue all participating soldiers' AP before any shared action. A helper cannot pay for a cannon action and then get those AP back when its own individual slot begins. The saved `enemyTurn.budgetsIssued` marker prevents a second issue after an interruption. Legacy queues without the marker initialize only their unstarted remaining members; completed members and an already-started current actor keep their existing paid budgets. The first contact preserves AP already spent on reactions.

During an enemy reaction, only members of that active reaction frame can provide crew AP. Player and militia reactions retain the existing eligible-unit rules. The AI does not approach an emplacement during an interrupt.

## Verification

The final complete suite passes **2,263/2,263 tests**, with no skips. It ran in two disjoint groups to avoid duplicating the campaign simulation: 2,255 general checks and all eight opening-route checks. Typecheck and the production build also pass. The campaign route uses paid prone setup, thirteen purchased dressings, sufficient paid replacements for two squads, and the existing coordinated-fire controller at Salta. Actual deaths and victory requirements are retained. See [the current northern route](../../verification/northern-route.md).

Thirteen chooser/execution tests cover all three cannon models, enemy and militia crews, finite shots, actual enemy/allied turns, denied direct militia control, partial work, pivot affordability, canister choice, line/cone safety, cover, upper-level and unseen targets, private-state independence, bounded approach, depleted posts, incapacitation and reaction authority. A hired scout leaving a loaded gun to find contact cannot be sent straight back to the same post on its next decision. Actual ambient ticks retain enemy and militia crews at loaded posts and release them when the gun is depleted.

Six enemy-budget tests cover first-contact budgets, second-round simultaneous issue, legacy continuation, saved marked queues, malformed markers and real shared cannon loading. The real loading case uses two wounded operators over three enemy rounds, with a player hearing interrupt and save/restore after each load. They spend 22, 22 and 16 AP each: exactly 60 each. One reserve round is consumed only when the load completes.

The existing stationed-artillery lifecycle was rechecked: all 26 persistence/reload cases pass, including return/reentry, partial work, defeat, capture, rescue and exact recapture. The former audit claim that returns rebuilt guns or ammunition was stale; that mechanism was already implemented. See [stationed artillery](../campaign/stationed-artillery.md).

Campaign verification also exposed an older return-validation fault. Peralta left the 64×48 Tucumán map at (42,47), then died from bleeding. The return check used a fixed 20×16 map and rejected his valid corpse record. It now uses the saved source sector or scene dimensions, or the matching pending deployment, while retaining the old compact bounds when no source dimensions exist. Bounds are checked before allocating the validation terrain. Two regressions preserve the exact corpse and equipment through reports, saves, source reentry and one-time destination loot, and still reject invalid coordinates and ammunition.

Live browser checks used the production Battlefield and the actual turn reducer in a labelled local practice. In the enemy case, one loaded swivel and one reserve round allowed the gunner to hit Acosta and Ledesma during the enemy phase; both ended at 30 health after their bleeding step. The journal showed cannon fire, and tactical save/restore retained both wounds. In the allied case, a militia gunner fired during the autonomous allied phase and won the controlled encounter while the hired spectator remained at 100 health. Saving retained the victory. The browser reported no errors or warnings.

The local practice at `http://127.0.0.1:3047/` uses controlled tactical state and the tactical snapshot validator. It does not read the user's campaign storage or claim a campaign victory. The campaign save and paid shared-work evidence comes from the automated budget tests.

## Crew posture

Operators and helpers must stand or crouch to fire, reload, pivot or drag a cannon. Prone soldiers do not count toward the required crew. Rejected orders spend no time, action points or ammunition. The reload control explains the required posture. An autonomous gunner first pays the normal cost to crouch, then plans a separate gun order. This applies to player, enemy and militia crews through the shared crew plan.

The 26 focused artillery, autonomous-crew and reload-render checks pass. The fresh Retiro route through Salta also passes under this restriction; the extended route through Jujuy and the 2,656-test integrated suite also pass, as recorded in [gameplay completion](../../verification/gameplay-completion.md). This does not establish full campaign completion or close the remaining scope below.

## Remaining scope

Autonomous cannon relocation, remote crew assembly, indirect fire and distinct solid/canister reserve types remain absent. Static emplacement duty, six-tile recruitment, the short approach, damage score and cannon ballistics are period-game tuning. Full campaign balance under autonomous artillery still needs broader playthrough evidence. Artwork is maintained separately.
