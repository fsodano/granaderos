# Stationed artillery

Issued cannons now leave available depot stock once. Each piece remains in its destination sector with the same identity, model, position, loaded shot, reserve ammunition and unfinished loading. Returning or revisiting cannot create a fresh cannon or refill it. Deployment reports reject missing, duplicated, changed or refilled pieces. Saved pending deployments validate their issue registry.

Victory captures the pieces. Retreat or defeat leaves them with surviving enemies, and strategic enemy occupation controls resident guns on the next entry. Friendly stationed pieces count toward the army artillery requirement. Newly issued pieces can join resident guns without replacing their identity or overlapping their position.

In the local Armory, **Piezas emplazadas en este sector** lists friendly guns. **Preparar 1 munición** spends existing powder and iron and adds one reserve round. A present squad, friendly control and a supply route are required. A field gun costs two powder and two iron per round; the other current models cost one each. This is Granaderos tuning. Supplying ammunition does not load the gun or erase loading work. Load it through the existing tactical crew order.

The initial loaded shot and six reserve rounds accompany the first stock issue only. These historical artillery mechanics are a Granaderos adaptation, not a claim about JA2 artillery. Recovery and strategic transport of individually stationed guns, autonomous enemy artillery use, and distinct solid/canister supply recipes remain incomplete. Existing aggregate stock convoys do not establish transport of these identified deployed pieces.

## Verification — 2026-09-12

Eleven simulation/integration tests and two production panel tests cover finite stock, repeated returns, retained coordinates and work, report validation, capture rules, stock selection, finite resupply, eligibility, saves and the actual UI action. All **1,426 tests**, type checking and production build pass.

A separate browser demonstration mounted production Armory and Battlefield components. Its fixture followed a real purchase, San Nicolás victory (four turns and 28 orders), return, and seven actual cannon shots with six reloads. The empty cannon had zero reserve ammunition. The live Armory action spent one powder and one iron and supplied one reserve. Save/restore and sector entry retained the same unloaded piece at tile 35,20. The tactical reload spent the displayed crew cost and consumed that one reserve. Returning and saving retained the loaded gun, zero reserves, zero unissued stock and the paid resource balances. The demonstration did not access the user's campaign save.

Capture transitions and report corruption are automated evidence. The browser run verifies finite resupply and persistence, not strategic recovery or a complete artillery campaign.
