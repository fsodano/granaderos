# Transporting deployed artillery

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

A friendly gun in a secured sector can travel to another friendly sector by an organized cart or flotilla route. Open Maestranza, find the stationed gun, choose a destination and transport, then use **Enviar pieza**. The preview shows weight, travel hours and any rejection reason. An available local squad must provide the gun's required crew for loading. Active encounters, hostile survivors and occupied guns prevent recovery.

The convoy removes the gun from the source once. It retains the same identity, model, loaded state, reserve rounds and partial reload. At arrival it enters a local artillery depot, separately from generic cannon stock. Select its model in the battery controls when the squad reaches that depot. Deployment consumes the local record once and preserves its load; it does not manufacture a replacement gun or issue six new rounds.

Existing convoy rules control road access, snow, mountain restrictions and naval blockade. A route cut before delivery delays the convoy until access returns. This uses the existing convoy abstraction; it does not add tactical convoy ambushes or physical draft-animal simulation. Travel times and the 500 kg gun allowance are existing game tuning. Carried shot supplies add 2 kg per round, or 4 kg for a field cannon; those weights are explicit simulation values. Carts and ships have their existing capacity limits. Mules cannot carry an assembled cannon.

Old saves need no new records. New storage and convoy records reject invalid models, loads, reload fractions, excessive capacity and duplicate identity across fields, scenes, stores, convoys or an active deployment. Stored guns in an occupied sector cannot be selected or inspected through the friendly depot panel. Generic resource convoys continue to use their previous rules.

## Verification

Four transport tests cover a purchased and deployed gun, exact arrival/redeployment, interrupted delivery, finite stock, repeated-order rejection, local crew, capacity, hostile presence, duplicate identities and full saves. Combat settlement in this fixture is scripted to isolate custody; it is not campaign balance evidence. Three panel checks cover displayed loading, ammunition, rejected choices and existing resupply. The related 34-test logistics, equipment and save group passes; the existing 23 artillery and stationed-gun checks pass. Type checking and the production build pass.

A separate browser session imported the labelled subsystem save. Its gun displayed 40% reload progress and two rounds. Selecting Buenos Aires previewed 504 kg and eighteen hours; dispatch removed the original field entry and displayed one convoy. Reload/resume retained it. Advancing time stopped at the eighteen-hour delivery notice. After the squad's twelve-hour march, the destination panel displayed the same partial load and two rounds, and the gun could be selected for the next battery. Actual redeployment and duplicate rejection are verified by the automated custody test.

The full integration suite passes 2,661/2,661 tests with no skips in 336.3 seconds, including the continuous fresh-start route through Jujuy. The campaign ending, transport of disassembled guns over high passes and broader parity audit remain open. Stored, undeployed and locally emplaced pieces now support workshop sale and repurchase; see [artillery trading](artillery-trade.md). Pieces outside a workshop still require transport before sale.
