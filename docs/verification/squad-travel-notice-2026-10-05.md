# Squad retirement and saved travel notices

This isolated candidate starts at published `0e510328402630e04c31f98acc314e7fdd654f3c`. The complete short suite, type check and build are separate final gates. This record does not claim a completed stock campaign or further recovery travel.

## Defect and bounded repair

At the eight-record limit, a legal `createSquad` order can retire an empty squad with no journey. Its earlier arrival or interruption notice still referred to that removed ID. The order succeeded, but the strict save check rejected its result with `El aviso de marcha guardado es inválido.`

Capacity replacement now retires only notice events for the exact removed squad ID. Every surviving event and the notice's original hour and second remain. If no events remain, the notice becomes `null`. The campaign log and all live journeys remain unchanged. No squad ID is reused. Unknown notice IDs and invalid timestamps remain rejected by the existing save validator.

The travel notice is a summary of a real interruption. Actual journeys provide current route state and controls. This repair does not resume a paused clock or route. It does not change personnel, service terms, health, equipment, ammunition, cash, RNG or elapsed time.

## Legal-order regression checks

The existing capacity regression now earns two simultaneous arrivals through ordinary queued routes and a real wait. The wait stops at hour 12. A same-town reassignment makes one arrived squad empty. Further legal formations reach eight records, and the surviving squad queues its next route. The replacement removes only the retired arrival event, preserving the other event, its timestamp, the complete live journey and the log. Every intermediate state passes official save admission, and the recorded orders replay exactly.

Two additional checks prove that retiring the sole noticed squad produces `null` while retaining its log, and that a forged unknown notice ID remains rejected. These are declared legacy subsystem fixtures; they are not a new-player campaign proof.

The focused formation file passed **8/8**. Six affected formation, travel, save and component files passed **47/47**, with no failures, skips or cancellations. The process closed with exit 0; log: `/tmp/granaderos-squad-travel-notice-affected.log`.

## Exact stopped stock order

The ignored verifier reads the unchanged stock inputs and replays only their original ten campaign orders. It does not continue travel, recruitment, care or combat.

| Input | SHA-256 |
| --- | --- |
| Original settled stock save | `e8898c6bd62eb60c4962481d69ed3e2efd4a191df8a11ed30fb203c01651d451` |
| Valid nine-order checkpoint | `12cf99e8dfac3f51db72df418f36f028041918de1d8ba808201bf87bbd956881` |
| Original unadmitted tenth-order result | `b22eb9871aa2e9fe9eab8f2a4d4a51b55d604bcaa0063c6751a60dd2f297dc1a` |
| Original ten-order history | `d4d58d3b56f6fb4f80a5c85286ae95e41ded69e35213ce9d2ff9ed718c582fcd` |

Order 10 is the original `createSquad` for actor 0 in Córdoba, named `Contactos de retaguardia`. It retires vacant `squad-34` and creates `squad-44`. The candidate's entire expanded saved result equals the earlier unadmitted output after removing only the `squad-34` notice event. The `squad-35` event and original notice time, hour 1543 and second 2192, remain exact. The unmodified old tenth-order save still fails strict admission.

The replayed nine-order checkpoint remains exact. The repaired tenth state passes official encode/decode and complete ten-order replay. Its campaign stays at **1543:2966**, with **85,918 pesos**, all **40 prior deaths**, nine serving survivors and the existing captive. The five original renewals debit **548 pesos**. No further time, aid, recruitment or equipment change occurs.

The verifier closed with exit 0. Its log is `/tmp/granaderos-squad-travel-notice-stock-proof.log`. Its receipt and admitted pair are `/tmp/granaderos-stock-ending/squad-travel-notice-hotfix.receipt.json` and `squad-travel-notice-hotfix.save.json`. The admitted pair's SHA-256 is `bc634f4b73e250b9b2a96eb5abb5d83c7d4220928b4131d44cf107e6dd6d0125`. All original input files and failed receipts remain unchanged.

## Frozen candidate

Production source digest: `21453c9224ce49a51dce19873fbfb17de7fbb1e71e4cfafb75f0f903b811bb83`. All 883 test/support files: `af434ded0dbe41bb425b9d438b9048038ea587429ca057141a4b5682b60e0f82`.

Tracked allowlist: `game/campaign.js`, `tests/remote-squad-formation.test.mjs`, and this verification record. No save schema or UI production file changes. Further stock recovery remains open.


## Complete candidate validation

The frozen candidate passed the complete unfiltered `npm run test:quick`:
**4932/4932 checks**, **707/707 selected files**, `complete: true`, and zero
failures, cancellations, skips or todos. The process closed with exit 0 in
374.29 seconds. The eight existing extended files remain separate from the
715-file full partition; the exclusion configuration is byte-identical to the
published base. No new filter, skip or exclusion was added.

Typecheck and production export **21453c9224ce** passed. The export contains
1133 files and 1033 verified asset references. Documentation and baseline
audits, five shard self-tests, complete 715-file shard coverage, the disjoint
707/8 quick/extended partition, local-link and whitespace checks passed. All
gate processes are terminal.

Runtime source and all 883 test/support inputs retained the exact frozen
hashes above through the complete run. The only later edit adds this terminal
receipt; it changes no game or test input. The complete report and log are
`/tmp/granaderos-squad-travel-notice-quick.json` and
`/tmp/granaderos-squad-travel-notice-quick.log`. Type, build, audit, shard and
partition receipts use the same `/tmp/granaderos-squad-travel-notice-` prefix.

This validates the bounded retirement fix and the unchanged original ten-order
stock replay. It does not prove further recovery travel or a complete stock
campaign. No renderer, cannon or 3D file was changed, and no live player-browser
acceptance was performed.
