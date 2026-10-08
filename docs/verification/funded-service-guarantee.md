# Funded service guarantee (R03 deposit half)

This increment adds an optional, authored service guarantee. It is a campaign contract rule. It does not add an insurer or claim a historical institution. Unused-salary death compensation remains open.

## Observable rule

- A contract character can have `serviceGuarantee`, an integer from 0 to 1,000,000 pesos. Omitted or zero values retain the existing salary-only offer and do not create a guarantee ledger. Stock offers remain unchanged. Historical and permanent characters cannot have a positive guarantee.
- Hiring pays salary plus the guarantee from the existing treasury. The quote keeps `price` as salary and exposes `guarantee` and payable `total`. Renewal pays salary only and retains the original funded ID.
- Each funded incorporation gets a new `guarantee-N` receipt. At actual safe service end, the refund is `floor(fundedAmount * currentHP / effectiveMaxHP)`, with health bounded to the operative's current effective maximum. The salary is not refunded.
- Capture holds the original liability. Release with remaining service restores the same ID. Release or saved escape with no remaining service settles it at actual supported departure. Existing travel and deployment dismissal guards remain in force. Existing deferred expiry settles at the first admitted safe service end, including an intermediate travel arrival.
- Cancelling a pending arrival refunds its original paid salary and full held guarantee once. A confirmed death forfeits the guarantee with a zero receipt, even if medical acknowledgement precedes the deployment report. Later dismissal, expiry and duplicate reports cannot pay it again.

The normal story editor exposes **Garantía de servicio (pesos)**. For example, set Rafael Sosa to 100 pesos and travel to zero hours, then launch and open Contrataciones. His day offer shows salary 36 + guarantee 100 = payable total 136. Hire, renewal and safe dismissal use the normal campaign controls. The existing personnel menu, notices and cancellation controls carry the current funded ID, so a stale action from an earlier hire cannot settle a later funded hire.

## Save and module boundaries

The optional version-1 ledger uses `held`, `departed`, `cancelled` and `forfeited` states. Held entries require exactly one matching active contract, pending arrival or captive contract. Terminal departure/cancellation entries have no live reference. A forfeited entry can retain only the original confirmed-dead active contract until ordinary removal. Owner, authored amount, ID sequence, timestamps, keys, references and refund arithmetic are validated. Restore validates; it does not silently settle or repair a financial receipt. Failed campaign commands return the previous financial state.

The actual cancellation route accepts a live, validated arrival. Bypassing the campaign dispatcher with a dead malformed arrival is not a supported financial path. Receipt health is a saved settlement snapshot with strict arithmetic, not cryptographic proof of an external payment.

`encounters.js` imports the same `CIVIC_RECRUITS` binding directly from `civic-recruits.js`. This avoids a cold server module cycle through the recruitment re-export. The example JSON import and explicit load behavior remain unchanged. The preview and final build use canonical configuration and dependencies; no private cache or setup change is part of the feature.

## Bounded evidence

The focused tests exercise funding, insufficient funds, legacy zero behavior, health proportions, progressed maximum health, renewal, fractional time, redirect/cancel, paid arrival, rehire and stale actions, malformed saved receipts, existing transit/deployment guards, and normal local hiring. Mounted React checks exercise editor input, undo/redo, saved launch, payable offer, renewal and personnel dismissal. Normal browser checks use a separate save origin and public controls.

Independent campaign proofs include an actual paid tactical casualty and report, saved capture/release and escape, cancellation boundaries, and real travel expiry followed by its first admitted arrival. The capture proof declares the initial surrender/defeat location and rescue adjacency/exit setup as fixture boundaries; the paid hire, custody, free/exit, report and save authorities remain real. Controlled health fixtures are labelled as fixtures. They are not evidence of naturally inflicted wounds or paid healing.

The release package retains failed preview/module-cycle and fixture-assumption receipts. Cold HTTP 500 plus successful hydration was not accepted as a working route. Current document HTTP 200, source pins, normal paid results and the canonical production export are checked before release.

Affected checks are run locally. No full gameplay suite, balance claim, salary death cover or new art work is included in this increment. The wider R03 insurance/compensation choice remains incomplete.
