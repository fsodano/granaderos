# Form squads where the soldiers are

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Implemented 12 September 2026. The real Yatasto checkpoint left Petrona Lagos in reserve in San Nicolás while the selected squad was in Tucumán. The previous formation form listed only soldiers in the selected squad's town. It could not organize Petrona for travel without first sending another squad to her town.

The squad screen now has a **Localidad de formación** selector. It lists towns with hired, living soldiers who have no pending squad route. The player chooses a town, selects up to six people already there, and names the new squad. Creating it selects the new squad at that town; other squads and reserve personnel keep their physical positions, equipment, assignments, contracts and journeys. It costs no time or money. Travel remains a separate paid action.

`createSquad` accepts an optional `sector`; omission retains the current-town behavior. The normal `squad` edit still requires the selected squad's location. Both operations reject unavailable soldiers and soldiers with pending routes, including paused routes. The player must finish or cancel those routes first. Mixed-town selections, duplicate IDs, unknown sectors and the existing eight-squad cap remain invalid. Formation does not teleport soldiers or grant treatment or ammunition.

## Verification

Four simulation checks cover remote reserves, actual subsequent travel, creation while another squad is moving, save/load, rejected mixed or traveling selections, and stop-after-stage behavior. Two component checks cover the labelled town selector, available roster, and an all-traveling army's empty state. The existing travel and coordinated-assault checks remain in place.

A separate browser preview used the actual Yatasto campaign save and the production squad component and reducer. At hour 215, the selector offered San Nicolás, Tucumán and Salta. Choosing San Nicolás showed only Petrona Lagos. Creating **Reserva del sur** selected her new squad in San Nicolás, while Isabel Molina stayed with Correo sanitario in Tucumán. Time remained 215 and treasury remained 2,007 pesos. Saving and loading the preview retained the new squad and both locations. This preview used no player browser storage.

All **1,328/1,328 tests** passed in the isolated checkout. The type check, production build and whitespace check passed. The separate Cuyo recovery command also completed and reloaded its output save.

## Recovery before Cuyo

The separate recovery verifier starts from the validated Yatasto save. One recovered Salta dressing lets Nicolás Funes treat Lucien Arnaud from 14 to 17 HP, permitting actual travel. The force takes the six remaining discovered dressings before leaving. Contracts are renewed at their real quotes.

The four Salta survivors queue their return to Córdoba. Petrona forms a squad in San Nicolás while that force is already marching, then queues her own route. Isabel travels from Tucumán. Isabel and Petrona reach Córdoba at hour 228; the Salta group arrives at hour 240. All moves take actual travel time and preserve each party's location.

The workshop sells twenty dressings to Isabel and two to Petrona, costing 660 pesos and reducing its actual finite stock. Petrona had no dressings left before this purchase. Petrona and Nicolás drop their two and six dressings locally, and Isabel collects them. Normal care consumes all twenty-eight dressings to heal the three wounded patients; six further hours of rest follow. Including the initial Salta treatment, twenty-nine dressings are consumed: seven recovered and twenty-two purchased.

At hour 274, second 526, all six survivors are in Córdoba with full health and no bleeding. Five have 100 energy; Isabel has 88 and still needs further rest for full energy. Treasury is 1,557 pesos. All fifteen prior operative deaths remain permanent. This recovery extension stops before the Cuyo battle. The following [Mendoza verification](../../verification/mendoza-route.md) covers the retreat, rescue and foundry; the ending remains unverified. The [persistent-load update](../equipment/campaign-gun-loads.md) adds thirty seconds before this checkpoint and preserves these health and treasury results.

Reproduce with the Yatasto save from the [northern route verifier](../../verification/northern-route.md):

```sh
node tools/verify-cuyo-recovery.mjs --input /tmp/granaderos-northern-route-check/yatasto.save.json --output /tmp/granaderos-cuyo-recovery-check
```

The command writes `cuyo-recovered.save.json` and an action report, then reloads and compares the save with the actual campaign state. It performs no direct health, money, location or battle-outcome changes.
