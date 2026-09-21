# Prisoner custody and service time

The prisoner panel now shows each known captive's location, health, detention start, elapsed detention and paused contract time. It distinguishes service without expiry, remaining paid hours, and a contract that had already expired at capture. Wounded and critically wounded prisoners are marked for medical care after release. Captured equipment remains unavailable.

The panel and sector-recapture release use one shared service-time calculation. Release preserves only the paid time remaining at capture, removes a pending departure marker, retains permanent service, and does not renew an expired contract for free. Inspecting the panel does not change custody, wounds, money or contracts.

Thirteen focused custody, component and enemy-group checks pass, including capture/release regressions. Type checking and the production build pass. The new panel has component-render evidence; it has not yet been checked with a live captured campaign.

This is custody information and shared release logic. Prisoners are still released by sector recapture. A playable detention scene, physical rescue, escape orders, prisoner equipment recovery and their narrative outcomes remain open under W08.
