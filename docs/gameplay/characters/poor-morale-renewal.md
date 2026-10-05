# Renewal with poor morale

Fresh fictional Ángela Cejas content explicitly declares `low_morale_refusal`.
Authors can assign it to an explicitly paid contract character, including a
paid local recruit. Personality prose, historical identities and older pinned
packages without the ability do not activate this rule.

A serving soldier with this ability refuses a new paid extension while saved
personal morale is strictly below 30. At 30 or above, the morale reason clears.
Other existing refusals, funding checks and pending-combat guards still apply.
The current paid contract continues through its exact hour and second. The
existing travel and deployment rules determine any deferred departure.

The check uses the personal campaign record. Temporary deployment cohesion and
preferred-companion support cannot replace that value. Validated tactical
return retains real earned morale changes through the existing rules; the
renewal check does not edit those rules or the issued support receipt.

Ordinary recovery can restore eligibility. A failed renewal cannot buy the
usual pay-morale reward: it spends no money, adds no paid time and changes no
reward date, assignment, supplies, injuries or random state. A successful
renewal uses the existing price and rolling reward eligibility.

The ability description and actual renewal controls explain the threshold,
continued paid service and recovery. Initial hiring and later hiring retain
their existing rules. This condition creates no permanent complaint, new
timer, correspondence or save-time event. Loading a save neither lowers
morale nor changes an expiry date.

The frozen [classic morale source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/04869c8e339ead1de9fefb25b7ad206b9b786825/src/game/Strategic/Strategic_Status.cc#L177)
checks current morale against a profile-dependent tolerance. The
[classic renewal source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/04869c8e339ead1de9fefb25b7ad206b9b786825/src/game/Strategic/Merc_Contract.cc#L322)
uses that refusal and can let a serving buddy override it. Granaderos uses
its existing low-morale boundary of 30 and does not add that override. These
are explicit game rules, not exact classic parity or a medical measurement.

Prolonged tactical panic, underground fear, wider changing relationships and
other reasons for leaving service remain separate requirements. See the
[video review](../../verification/ja2-video-review-2026-10-03.md) and the
[renewal verification](../../verification/poor-morale-renewal-2026-10-05.md).
