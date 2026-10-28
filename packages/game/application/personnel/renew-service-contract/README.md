# RenewServiceContract

Extend a serving character's paid contract. The request identifies the character
and term and can include the expected expiry and guarantee receipt. A stale
expectation refuses the request before payment.

`RenewServiceContractRepository` supplies the canonical character, treasury,
accepted game time, and quoted service terms. `ServiceContract` preserves all
unexpired service seconds. `ServiceRenewalService` charges the current price and
replaces the person's contract together. The existing guarantee receipt remains
attached. Permanent service, unavailable characters, invalid duration, and
insufficient funds refuse the whole change.

The result contains the character ID, paid pesos, and exact expiry in game
seconds. Scenario reputation and pay-morale effects join the caller's transaction.

Expected eligibility and service-quote refusals use typed domain codes. The
`CampaignRuleRefusal` infrastructure adapter preserves the detailed player
message from retained campaign policy without moving that text into the domain.
