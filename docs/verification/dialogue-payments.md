# Dialogue payments and rewards

An authored resident choice can charge or grant pesos. The operation occurs once
per character, passage and choice. Selecting the option again can revisit its
text but cannot repeat its payment or reward.

## Behavior

The character editor supports one treasury operation per choice, with an integer
amount from 1 to 1,000,000 pesos and an explicit pay/receive direction. The player
sees the amount before choosing. Insufficient funds disable the choice and show
the missing amount. The campaign checks funds again and rejects an invalid
selection without changing money, passage, time or receipts. Rewards cannot
exceed the saved treasury's upper bound.

An accepted operation changes treasury and records its source choice, amount and
campaign hour with the conversation. Reentry, saves, dialogue loops, local
recruitment and dismissal retain that record. Copies have independent identities
and receipts. A self-loop or repeated click cannot grant a second reward. The
conversation confirms a new payment or explains that it was already performed.
The campaign log also records new transactions.

Save admission checks receipt references, amounts, hours and uniqueness against
the pinned graph. The latest displayed operation must have its matching receipt.
Older conversations without effects need no receipts and remain compatible.

## Evidence

Runtime source: `94046adfa62c24d39fdae0483c6c0364cbd3da94`.
The complete local suite passed **635/635 tests**, without failures or skips.
Types, production export and all 36 baseline comparisons passed. The register
retains 178 requirements and 17 evidence records. [PR #40](https://github.com/fsodano/granaderos/pull/40) merged after
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36370521027/job/108765701197) passed.

- `tests/dialogue-payments.test.mjs`: real conversation rewards/charges, loops,
  saves, local service changes and distinct residents; hidden, stale or
  unaffordable requests leave state unchanged; invalid definitions and receipts
  are rejected. The treasury ceiling case uses an explicitly prepared,
  save-admitted balance; it does not claim normal campaign earnings reach it.
- `tests/story-editor.test.mjs`: actual authoring, undo/redo, independent copy,
  campaign launch, physical approach and a saved charge of the authored amount.
- `tests/webmcp-campaign.test.mjs`: mounted conversation shows the reward before
  selection, grants it once after a double click, retains the receipt and consumed
  state through a loop, and disables an unaffordable payment without mutation.

## Limits

At this checkpoint, PAYMENT-01 is a bounded delivery; STORY-03 remains partial. These are one-time
treasury operations. Item rewards, recurring merchant transactions, authorable
quest states, historical role effects and scripted movement remain open. Receipts
validate internal save consistency; they are not a cryptographic anti-cheat
system. No complete campaign, live-browser or performance acceptance is claimed.

[Authored quest states](authored-quests.md) extend these effects in the following checkpoint.
