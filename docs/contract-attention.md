# Contract renewal attention

An explicit campaign wait stops when a living hired soldier has at most two hours left on a finite contract. The soldier stays in service. The operations map shows the remaining time and renewal terms, using the same price and payment rules as Recruitment. Choosing Avanzar again acknowledges that warning and continues without changing the contract. Actual expiry produces a second stop. A soldier already traveling or deployed keeps the existing deferred-departure rules.

The [classic JA2 contract source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Merc_Contract.cc) checks a two-hour warning window in `ContractIsGoingToExpireSoon`, displays pending renewals and pauses for the renewal sequence. Removal stops time compression. Granaderos uses its existing hourly clock and ordinary paid renewal command. It does not reproduce JA2's refusal dialogue, medical deposit, insurance or departure equipment choice. The warning includes an owned squad already traveling; unlike an unarrived recruit, that soldier is already in service and the existing renewal command can reach them.

## Clock and persistence

- An unacknowledged warning already within the two-hour window stops before advancing. No work, wages, supplies, recovery or route progress are awarded at that zero-hour pause.
- A newly reached warning or expiry stops after every subsystem finishes the same hour. Concurrent assignment and route notices remain available. Pending combat keeps priority and disables renewal until resolved.
- Warnings are grouped by soldier. A saved acknowledgement records the expiry date and event, so continuing or reloading cannot produce a repeated zero-hour stop. Renewal, dismissal, death or captivity clears obsolete acknowledgements. A renewed contract can warn again at its own expiry date.
- The notice persists after renewal and reports that it was handled. Renewal buttons include the observed expiry date; a stale repeat is rejected atomically before payment. Insufficient funds leave the contract and clock unchanged.
- Blocking travel and tactical synchronization process their full elapsed duration. They do not truncate to a strategic renewal warning. Queued travel advances only the elapsed hours of an explicit wait and keeps its actual position, fatigue and route when a warning stops the clock.
- `contractAttention` contains a bounded notice and bounded acknowledgement map. Save validation rejects malformed dates, IDs, event types and duplicate soldiers. The public projection includes a detached notice, without acknowledgement markers or private campaign data.

## Verification

Fourteen simulation/save cases cover paid recruitment, the exact warning hour, acknowledgement, renewal, stale action rejection, actual expiry, simultaneous assignments/contracts, restored warnings, dead/captured/permanent exclusions, queued and blocking travel, tactical clock continuation and same-hour contact. Three render/input cases cover visible countdown, renewal dispatch, renewed/departed state and disabled actions. The focused regression run passed all 74 cases. The complete isolated gameplay suite passed all 1,203 tests; type checking, the production build and whitespace checks also passed.

Live QA used the separate `?qa=1` campaign. A 24-hour request at 08:00 stopped at 22:00 after fourteen hours with two hours left on Kerr's contract. The notice offered the current day/week/month prices. A one-day renewal charged 27 pesos (2,921 → 2,894), retained the 22:00 clock and showed 26 hours remaining. The notice changed to “El contrato ya fue renovado.” A fresh page continued the same balance, remaining time and resolved notice; the next one-hour advance cleared the notice and reached 23:00 with 25 contract hours left. Travel, expiry and concurrent encounter boundaries remain automated-test evidence.
