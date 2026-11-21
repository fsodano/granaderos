# Stop time for production and delivery attention

On the strategic campaign screen, explicit time advancement stops when a workshop job, imported weapon order, cargo shipment or convoy actually completes. The operations map shows a saved receipt with the completion hour, requested and elapsed hours, quantities and destination. This extends the existing assignment and contract attention flow; it is a period campaign adaptation of JA2's map-time control, not a reconstruction of its modern shops or laptop interface.

Explicit waits also stop once when a due job cannot deliver under its existing rules. The notice explains the obstruction. This covers occupied or unsupplied workshops, blocked or occupied Ensenada imports, an imported weapon order that cannot fit in the armory, and convoys held by their existing route, transport or snow conditions. Paid inputs and reserved cargo remain in their queues. No new shortage, production cost or transport rule is introduced.

## Completion and continued time

Every system finishes the current hour before time stops. Goods are credited once, their completed jobs are removed, and then the receipt is recorded. Medical work, wages, daily income, routes and enemy arrivals still process that same hour. Simultaneous completions appear together. Assignment, contract and encounter notices can coexist; a pending encounter still requires its normal response before further waiting.

A production receipt identifies the workshop and the goods added to the general reserve. Imported weapons identify the Ensenada armory and exact catalog item. Cargo shipments identify the general reserve. A convoy identifies its actual local depot or the Buenos Aires reserve. The notice records what completed; it does not promise that goods remain unspent or that a depot remains accessible after later events.

The next explicit **Avanzar** request acknowledges the receipt and starts a new interval from the current hour. It does not automatically spend the unused hours from the previous request. Removed jobs cannot deliver again, and there is no collection button. Production costs and transport costs are still paid through their existing orders.

A blocked port, occupied workshop, interrupted route or full imported-weapon store cannot produce a completion receipt merely because its original due hour has passed. The delivery stays queued under its existing rules. A newly observed overdue obstruction stops before any further hours pass; an obstruction first observed at the due hour stops after that complete hour. A saved acknowledgement identifies each pending job and cause. An unchanged cause does not stop the next wait again. A changed cause, a new pending job, or a later obstruction after access was restored can raise a new notice.

Once a pending job can actually complete, a subsequent explicit wait stops after its completion hour. Its acknowledgement is removed. Completed and interrupted jobs can share one notice, with each entry describing its own result. These notices are dated observations, not authority to deliver or refund anything.

Blocking travel and tactical clock synchronization still process their full required durations. They deliver goods and retain the existing journal messages without cutting a march or tactical action short. Queued routes advance only through the elapsed part of an explicit wait, and resume from the same progress after the notice.

## Saves and public state

`logisticsNotice` is null or one bounded, validated receipt. Its event shapes distinguish production, equipment imports, cargo shipments and convoys; blocked entries also carry a known obstruction code. Save validation checks fields, known places, imported catalog items, quantities and time bounds. A zero-hour notice may contain only interruptions. An absent old notice defaults to null, and an absent `logisticsAttention` field receives an empty versioned acknowledgement record. A receipt has no delivery authority and never recreates stock on load.

The public campaign projection exposes only the receipt fields and detached goods objects. It omits queue bindings, acknowledgement records, random values and other private fields. The React notice escapes task names and shows an accessible live status beside the ordinary map clock. It distinguishes pending goods from arrivals and explains how to continue with the existing **Avanzar** control.

## Remaining work

Completion and existing due-delivery interruptions follow A07's explicit-wait policy (time compression and event-driven pause triggers in the [parity requirements](../../requirements/ja2-parity.md)). Full JA2 parity and a complete campaign through the ending remain open.
