# Stop time for production and delivery attention

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Explicit time advancement now stops when a workshop job, imported weapon order, cargo shipment or convoy actually completes. The operations map shows a saved receipt with the completion hour, requested and elapsed hours, quantities and destination. This extends the existing assignment and contract attention flow; it is a period campaign adaptation of JA2's map-time control, not a reconstruction of its modern shops or laptop interface.

As of 27 September, explicit waits also stop once when a due job cannot deliver under its existing rules. The notice explains the obstruction. This covers occupied or unsupplied workshops, blocked or occupied Ensenada imports, an imported weapon order that cannot fit in the armory, and convoys held by their existing route, transport or snow conditions. Paid inputs and reserved cargo remain in their queues. No new shortage, production cost or transport rule is introduced.

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

## Evidence

The 27 September interruption update passes **75 focused tests** across logistics notices, paid imports and convoys, blockage and restoration, identical pending orders, full armory capacity, mixed receipts, saved acknowledgement, invalid saves, public projection, map rendering, assignment attention, artillery transport and tactical/strategic clock equivalence. Type checking and whitespace checks pass. This is focused automated evidence; the interruption notice has not received a separate live-browser check. Full campaign completion remains unverified.

The following completion-only evidence predates that update:

Thirteen integration cases verify actual paid production, paid imports, paid convoys, finite credit, same-hour grouping, interrupted routes and ports, saved replay, simultaneous assignment/contract events, midnight income, queued travel, complete blocking/tactical durations, encounter priority, public projection and malformed saves. Three component cases verify the operations-map placement, quantities, destinations, escaped text and acknowledgement.

All **1,385 tests** passed in the isolated gameplay checkout. Type checking, production build and whitespace checks passed. The final wording-only component revision was checked again with the three render tests and a new production build. The existing northern campaign route and its actual battle/save checks remain part of the complete suite.

The live production-component demonstration paid 30 pesos and the ordinary inputs for sixty cartridges. A 24-hour request stopped at hour 12: stock rose from 300 to 360, the job disappeared, and the map displayed **12 de 24 horas solicitadas**. A full campaign save/load preserved the receipt and quantities. The next 24-hour request reached hour 36, cleared the receipt, retained 360 cartridges and collected the ordinary 286-peso midnight income. No second batch was credited.

The separate demonstration is `http://127.0.0.1:3008/` while its preview server runs. It uses the production Campaign component, reducer and save functions. Its introduction and reset/save buttons are test controls; the time selector, **Avanzar** button and receipt are the game UI. The player's campaign is unchanged. Live convoy and import cases remain automated-test evidence.

This covers completion and existing due-delivery interruptions under A07's explicit-wait policy. Full JA2 parity and a complete campaign through the ending remain unverified.
