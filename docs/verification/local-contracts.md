# Authored local service contracts

A new world resident can serve permanently without pay or join for a paid day,
week or month. This is independent of bulletin recruitment. A world resident must
be present and approached in the tactical scene. A bulletin candidate remains
off-map until hired and received at a controlled, suitable destination.

## Authoring and play

The resident's encounter panel selects its service policy. Paid service enables
the monthly base wage. The editor previews the initial day, week and month prices.
The existing contract calculation rounds the daily base upward; one week is seven
daily payments and one month is thirty. Experience can raise later prices. A
zero-price contract still has a finite term. Permanent service requires zero pay.

The actual conversation displays the configured terms and their current prices. Its
hiring button identifies the selected charge and is disabled when funds are
insufficient or service is refused. Asking for conditions lists only available
terms and prices. If every term is refused, the reply uses the existing refusal
reason. Unpaid permanent service uses the same service quote for this reply.
See [current dialogue acceptance](local-recruitment-dialogue-2026-10-05.md).
The authoritative
campaign action still checks proximity, availability, authored requirements,
term and funds before charging or transferring the person.

Service begins in the current cell. There is no hiring journey or arrival ticket.
The resident retains its current health. Renewal, expiry and dismissal use the
existing service rules. If a contract expires during deployment, the actor stays
until settlement; it then returns through its authored placement rule with the
settled health. Rehiring does not restore wounds. Dismissal does not refund the
advance. Saved paid residents cannot be changed into permanent volunteers by
changing only their contract record.

## Evidence

Original checkpoint runtime source: `ce371e5af7a5925fc84e5a8fed9b7d836e62f5e2`.
The full local suite passed **611/611 tests**, with no failures or skips. Types,
production export (721 files and 631 asset references) and all 36 baseline
comparisons passed. The documentation audit retains 175 requirements, including
all 50 original and 87 parity rows, with 14 evidence records. These are historical
validation counts; current local acceptance is linked above.

- `tests/local-contracts.test.mjs`: all three terms, price and service start,
  no bulletin admission or arrival ticket, duplicate-hire rejection, insufficient
  funds, invalid terms, wounds, aid, active deferred expiry, return, rehire,
  renewal, dismissal, zero-price expiry, permanent service and altered saves.
- `tests/story-editor.test.mjs`: actual service/wage controls, undo, copy and
  campaign launch.
- `tests/webmcp-campaign.test.mjs`: actual game conversation selects a weekly
  quote and hires a wounded resident; active autosave preserves the result. A
  second mounted case shows insufficient funds and disables hiring.
- Existing resident, bulletin, arrival, contract and growth tests preserve their
  separate recruitment sources and service policies.

The original civic-bulletin requirement REC-02 is also supported by its existing
roster, recruitment, arrival and growth tests plus these separate world-identity
checks. This closes that bounded recruitment row, not full campaign integration.

## Limits

Historical roles retain their original service policy. NPC belongings, looting,
custody, merchant stock, role transfer, branching dialogue and scripted movement
remained open at this checkpoint. [The later dialogue delivery](authored-dialogues.md)
adds resident text branches; the [current ledger](published-progress.md) records
the remaining scope. Returning to an authored cell uses existing placement rules; it does
not simulate a physical journey. These automated and mounted-DOM checks do not
establish a browser campaign playthrough or full-game acceptance.
