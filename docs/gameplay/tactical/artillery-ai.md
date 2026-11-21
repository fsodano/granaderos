# Autonomous artillery crews

During turn-based combat and tactical exploration patrols, computer-controlled enemy soldiers and local militia operate nearby friendly cannon emplacements through the same crew, loading, pivoting, and firing actions as the player. The optional hired-squad auto-resolve uses the same chooser. This is a Granaderos period adaptation of autonomous weapon use; it does not claim that classic JA2 had these field cannons.

## Decisions and costs

The chooser reserves the required nearest capable soldiers within six tiles, from one side and control group. Hired soldiers and militia cannot borrow each other's crew. A local approach uses a legal path of at most three steps and 24 AP, followed by a fresh decision. The AI does not move a cannon or recruit a remote crew. Close enemy contact and urgent medical needs take priority over the emplacement.

A crew can prepare an unloaded piece without a visible target. Reloading uses the actual remaining fraction and the least available crew AP. Only completion consumes a reserve round. A loaded piece fires only at a target the current operator can see, at ground level and within the gun's range. An out-of-arc target requires a paid pivot, with enough AP left in every assigned operator's budget to fire afterwards.

Solid shot and canister share their physical trace with the firing action. The chooser checks the whole penetrating line or canister cone. Known friends, surrendered/routed/unconscious people and visible civilians prevent an unsafe shot. Enemy private ammunition, inventory and energy do not enter the score. An unseen enemy does not enter the planned trajectory; the actual shot still resolves against the complete field. Reload, movement and target choice do not create ammunition or change gun ownership.

A serviceable enemy or militia emplacement keeps its required local crew when there is no visible target. Extra soldiers can use their ordinary AI. Exploration patrols also keep assigned crews at the post without spending AP or movement energy. An exhausted gun with no loaded or reserve ammunition releases the post. The optional hired-squad auto-resolve retains its search behavior, so a hired force can look for an unseen opponent.

## Shared turn budget

New enemy turns issue all participating soldiers' AP before any shared action. A helper cannot pay for a cannon action and then get those AP back when its own individual slot begins. The saved `enemyTurn.budgetsIssued` marker prevents a second issue after an interruption. Legacy queues without the marker initialize only their unstarted remaining members; completed members and an already-started current actor keep their existing paid budgets. The first contact preserves AP already spent on reactions.

During an enemy reaction, only members of that active reaction frame can provide crew AP. Player and militia reactions retain the existing eligible-unit rules. The AI does not approach an emplacement during an interrupt.

## Persistence and return validation

A stationed-artillery return or reentry never rebuilds guns or ammunition.
Persistence covers return and reentry, partial work, defeat, capture, rescue and
exact recapture; see [stationed artillery](../campaign/stationed-artillery.md).

Return validation uses the saved source sector or scene dimensions, or the
matching pending deployment, and keeps the compact bounds when no source
dimensions exist. Bounds are checked before the validation terrain is allocated.
This preserves the exact corpse and its equipment through reports, saves, source
reentry and one-time destination loot, while invalid coordinates and ammunition
are still rejected.

A hired scout that leaves a loaded gun to find contact is not sent straight back
to the same post on its next decision. Ambient ticks retain enemy and militia
crews at loaded posts and release them when the gun is depleted.

## Crew posture

Operators and helpers must stand or crouch to fire, reload, pivot or drag a cannon. Prone soldiers do not count toward the required crew. Rejected orders spend no time, action points or ammunition. The reload control explains the required posture. An autonomous gunner first pays the normal cost to crouch, then plans a separate gun order. This applies to player, enemy and militia crews through the shared crew plan.

## Remaining scope

Autonomous cannon relocation, remote crew assembly, indirect fire and distinct solid/canister reserve types remain outside this model. Static emplacement duty, six-tile recruitment, the short approach, damage score and cannon ballistics are period-game tuning. Artwork is maintained separately.
