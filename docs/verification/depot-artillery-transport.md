# Forwarding stored artillery to the front

Runtime/test source: `fa29eeabe5c71b0560a77950274de42546cfef91`.

The armory can now send an exact gun directly from its local artillery depot.
A gun recovered to Retiro, or repurchased from a workshop, can move onward to
another controlled locality before the next attack. It need not first be deployed
in a neighboring battle. Stored pieces display the same destination, transport,
price, crew requirement, duration and rejection reason as field emplacements.

Dispatch explicitly selects field or depot custody. It removes the exact source
record once and keeps the same identity, model, side, facing, ammunition and
unfinished work. The existing route, crew, funding, tactical-scene, control,
blockade and delivery rules still apply. Each new shipment pays its authored fee
once. A wrong source, remote store, missing ID, insufficient funds or repeated
order leaves custody and money unchanged. Old field orders remain compatible
when the source is omitted. Shipments and saved depot records keep their existing
format; there is no new ammunition allowance or fabricated replacement gun.

This closes the field-only dispatch limitation recorded with finite transport
and local trading. It does not add in-transit redirection/cancellation, arbitrary
cell cargo routes, weight/capacity simulation or tactical convoy battles.

## Verification

Three simulations and one mounted production-game case pass **4/4**; overlapping
transport/trading checks pass **26/26**. Complete regression passes **1115/1115**, zero failures or skips
(320,202.427 ms), on the source above. Types, production export (722 files,
632 references), all 36 baseline comparisons and documentation validation
(247 requirements, 86 evidence records) pass. The original 50 and parity 87
rows remain.

The actual purchased and fired gun travels from San Nicolás to Retiro, waits in
its depot, travels back to Buenos Aires and enters an actual Ensenada attack. Its
identity and unloaded state with six reserves remain unchanged through full
saves and each leg. A gun actually sold and repurchased at a configured Buenos
Aires workshop retains a declared 40% loading fraction during forwarding to San
Nicolás and actual Santa Fe entry. No combat result is assigned in these routes.

An authored one-hour/37-peso dispatch verifies a second real transport charge,
exactly once. Prepared unaffordable and invalid-origin boundaries reject without
changing storage. A duplicate source record added to a shipment save is rejected.
The mounted Home/Armory controls send the local depot gun, save one shipment,
remove the original card and show its finite cargo. A stale detached button
cannot send it again. These are simulations and mounted DOM checks, not
live-browser, campaign-balance or performance acceptance.

Broader logistics, artillery and integration requirements remain partial.
Exact-head CI remains required before publication.
