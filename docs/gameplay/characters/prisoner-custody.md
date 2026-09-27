# Prisoner custody and service time

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The prisoner panel now shows each known captive's location, health, detention start, elapsed detention and paused contract time. It distinguishes service without expiry, remaining paid hours, and a contract that had already expired at capture. Wounded and critically wounded prisoners are marked for medical care. Captured equipment remains unavailable.

The panel and sector-recapture release use one shared service-time calculation. Release preserves only the paid time remaining at capture, removes a pending departure marker, retains permanent service, and does not renew an expired contract for free. Inspecting the panel does not change custody, wounds, money or contracts.

Thirteen focused custody, component and enemy-group checks pass, including capture/release regressions. Type checking and the production build pass. The live captured-campaign panel now also verifies health, paused service, finite custody-care quantity and last-care time after reload.

This is custody information and shared release logic. Prisoners are still released by sector recapture. A playable detention scene, physical rescue, escape orders, prisoner equipment recovery and their narrative outcomes remain open under W08.

Guards can stabilize captives with finite confiscated dressings during elapsed campaign hours. The panel and campaign log report actual treatment. See [detention care](detention-gameplay.md#finite-care-in-custody) for the limits and route evidence.
