# Stop time for completed production and deliveries

Explicit time advancement now stops when a workshop job, imported weapon order, cargo shipment or convoy actually completes. The operations map shows a saved receipt with the completion hour, requested and elapsed hours, quantities and destination. This extends the existing assignment and contract attention flow; it is a period campaign adaptation of JA2's map-time control, not a reconstruction of its modern shops or laptop interface.

## Completion and continued time

Every system finishes the current hour before time stops. Goods are credited once, their completed jobs are removed, and then the receipt is recorded. Medical work, wages, daily income, routes and enemy arrivals still process that same hour. Simultaneous completions appear together. Assignment, contract and encounter notices can coexist; a pending encounter still requires its normal response before further waiting.

A production receipt identifies the workshop and the goods added to the general reserve. Imported weapons identify the Ensenada armory and exact catalog item. Cargo shipments identify the general reserve. A convoy identifies its actual local depot or the Buenos Aires reserve. The notice records what completed; it does not promise that goods remain unspent or that a depot remains accessible after later events.

The next explicit **Avanzar** request acknowledges the receipt and starts a new interval from the current hour. It does not automatically spend the unused hours from the previous request. Removed jobs cannot deliver again, so no extra acknowledgement ledger or collection button is needed. Production costs and transport costs are still paid through their existing orders.

A blocked port, occupied workshop, interrupted route or full imported-weapon store cannot produce a completion receipt merely because its original due hour has passed. The delivery stays queued under its existing rules. Once it can actually complete, a subsequent explicit wait stops after that completion hour. This update reports completion; new interruption/shortage alerts for these queues remain separate work.

Blocking travel and tactical clock synchronization still process their full required durations. They deliver goods and retain the existing journal messages without cutting a march or tactical action short. Queued routes advance only through the elapsed part of an explicit wait, and resume from the same progress after the notice.

## Saves and public state

`logisticsNotice` is null or one bounded, validated receipt. Its event shapes distinguish production, equipment imports, cargo shipments and convoys. Save validation checks fields, known places, imported catalog items, quantities and time bounds. An absent field defaults to null. A receipt has no delivery authority and never recreates stock on load.

The public campaign projection exposes only the receipt fields and detached goods objects. It omits queue IDs, random values and other private fields. The React notice escapes task names and shows an accessible live status beside the ordinary map clock. The existing **Avanzar** control provides continuation.

## Evidence

Thirteen integration cases verify actual paid production, paid imports, paid convoys, finite credit, same-hour grouping, interrupted routes and ports, saved replay, simultaneous assignment/contract events, midnight income, queued travel, complete blocking/tactical durations, encounter priority, public projection and malformed saves. Three component cases verify the operations-map placement, quantities, destinations, escaped text and acknowledgement.

All **1,385 tests** passed in the isolated gameplay checkout. Type checking, production build and whitespace checks passed. The final wording-only component revision was checked again with the three render tests and a new production build. The existing northern campaign route and its actual battle/save checks remain part of the complete suite.

The live production-component demonstration paid 30 pesos and the ordinary inputs for sixty cartridges. A 24-hour request stopped at hour 12: stock rose from 300 to 360, the job disappeared, and the map displayed **12 de 24 horas solicitadas**. A full campaign save/load preserved the receipt and quantities. The next 24-hour request reached hour 36, cleared the receipt, retained 360 cartridges and collected the ordinary 286-peso midnight income. No second batch was credited.

The separate demonstration is `http://127.0.0.1:3008/` while its preview server runs. It uses the production Campaign component, reducer and save functions. Its introduction and reset/save buttons are test controls; the time selector, **Avanzar** button and receipt are the game UI. The player's campaign is unchanged. Live convoy and import cases remain automated-test evidence.

This closes the previously absent completion notices under A07's explicit-wait policy. Full JA2 parity and a complete campaign through the ending remain unverified.
