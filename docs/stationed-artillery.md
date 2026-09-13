# Stationed artillery

Issued cannons now leave available depot stock once. Each piece remains in its destination sector with the same identity, model, position, loaded shot, reserve ammunition and unfinished loading. Returning or revisiting cannot create a fresh cannon or refill it. Deployment reports reject missing, duplicated, changed or refilled pieces. Saved pending deployments validate their issue registry.

Victory captures the pieces. Retreat or defeat leaves them with surviving enemies, and strategic enemy occupation controls resident guns on the next entry. Friendly stationed pieces count toward the army artillery requirement. Newly issued pieces can join resident guns without replacing their identity or overlapping their position.

In the local Armory, **Piezas emplazadas en este sector** lists friendly guns. **Preparar 1 munición** spends existing powder and iron and adds one reserve round. A present squad, friendly control and a supply route are required. A field gun costs two powder and two iron per round; the other current models cost one each. This is Granaderos tuning. Supplying ammunition does not load the gun or erase loading work. Load it through the existing tactical crew order.

The initial loaded shot and six reserve rounds accompany the first stock issue only. These historical artillery mechanics are a Granaderos adaptation, not a claim about JA2 artillery. Recovery and strategic transport of individually stationed guns and distinct solid/canister supply recipes remain incomplete. Autonomous local crew use is now implemented; see [artillery AI](artillery-ai.md). Existing aggregate stock convoys do not establish transport of these identified deployed pieces.

## Earlier verification checkpoint

Eleven simulation/integration tests and two production panel tests cover finite stock, repeated returns, retained coordinates and work, report validation, capture rules, stock selection, finite resupply, eligibility, saves and the actual UI action. All **1,426 tests**, type checking and production build pass.

A separate browser demonstration mounted production Armory and Battlefield components. Its fixture followed a real purchase, San Nicolás victory (four turns and 28 orders), return, and seven actual cannon shots with six reloads. The empty cannon had zero reserve ammunition. The live Armory action spent one powder and one iron and supplied one reserve. Save/restore and sector entry retained the same unloaded piece at tile 35,20. The tactical reload spent the displayed crew cost and consumed that one reserve. Returning and saving retained the loaded gun, zero reserves, zero unissued stock and the paid resource balances. The demonstration did not access the user's campaign save.

Capture transitions and report corruption are automated evidence. The browser run verifies finite resupply and persistence, not strategic recovery or a complete artillery campaign.

## Current map verification — 2026-09-12

The building-footprint changes at `d90e52b` invalidate the old three-person victory fixture. That original seed-45 assault now loses through ordinary auto-resolve. A new real-defeat test reports the exact result, preserves dead and captured personnel, leaves the purchased swivel with the surviving enemy force, and verifies that the same identity, position, load and ammunition return as enemy property on a later deployment. The gun remains enemy property until an actual recapture; its unissued stock count stays zero.

For the victory and persistence cases, the established southern campaign hires Soria, Funes and Acosta on ordinary weekly contracts before the march. Their combined cost is 371 pesos. These recruits receive their normal clothing from finite stock; the original three soldiers draw and equip the remaining garments. No free stock, funds, territory, health or victory result is added. The six-person assault wins in ten turns and 59 orders; Dorrego dies. The full tactical save is restored before reporting the actual outcome, and every returned player's health and survival state is checked.

This restores the repeated-fire, save, stationed-position, reinforcement and finite-resupply checks on the current map. The scenario still starts from an explicit established-area fixture. It does not prove the full Retiro-only campaign, automatic artillery operation, or strategic transport of a deployed gun. The earlier browser report above is a historical observation, not a live replay under the current map.


The defeat test now continues through a paid rescue. With Cabral dead and Dorrego and Paroissien captured, the empty command returns to Retiro. A new weekly squad costs 371 pesos and marches through Buenos Aires to attack the saved occupation force. Its real victory takes three orders. Reporting that result releases both prisoners with their existing wounds and clothing and recaptures the same loaded swivel with six reserve rounds. Cabral remains dead. A full tactical save precedes the report, followed by a campaign save/restore. This verifies sector recapture, not transport or firing the gun during that recapture.

## Rebuilding after defeat

An empty hired roster no longer ends the campaign by itself. After an actual death or capture leaves no hired survivor available, the empty selected command returns to Retiro for paid recruitment. Bodies, prisoners and property remain at their real locations. Another surviving hired squad prevents this relocation. Losing Retiro or losing San Martín in the San Lorenzo mission still ends the campaign.

This follows the recoverable team-wipe rule described by the [JA2 1.13 defeat documentation](https://1dot13.github.io/documentation/playing/features/defeat/). Assembly at Retiro is a Granaderos adaptation. The existing automatic prisoner release on sector recapture and paused captive contracts are not full JA2 prison parity; prison escape, equipment confiscation and contracts continuing during captivity remain differences.

Automatic combat now uses the same verified victory condition as campaign reports. Once exploration is settled, no capable enemies remain and no reaction is pending, it returns victory without spending extra turns or attempting withdrawal. An unfinished fight still follows the existing bounded resolution and withdrawal rules.

Verification for this checkpoint: 1,579 tests ran, with 1,572 passing and seven failures in the existing northern opening-playthrough chain. The first failure expects twelve reachable dressings; the later route checks depend on that failed step. The six prior stationed-artillery failures are resolved. Type checking and the production build pass. These results do not establish a completed northern route.
