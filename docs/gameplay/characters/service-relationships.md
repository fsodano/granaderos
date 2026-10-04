# Service relationships *(workspace)*

An authored disagreement can block a person's next hire or renewal. The player
can retain the other person or use the existing dismissal action. This implements
one personnel choice described at 5:37–6:32 in the user's
[JA2 reference video](https://www.youtube.com/watch?v=6WtKA16osqE).

The default rule is directed: Inés Aguirre (`person-107`) refuses to hire or renew
while Gaspar Villalba (`person-112`) is in service. The stated reason is a dispute
over patient care. Both people and this disagreement are fictional. Villalba does
not have a reciprocal refusal.

The hiring card, contract menu and contract notice show both names, the reason,
and the existing action to end the rival's service. The dossier discloses the
condition before hiring. Dismissal retains its ordinary custody and financial
rules; this feature does not introduce a refund rule. A marching rival cannot be
dismissed through this notice until arrival. Battle, encounter and defeat guards
remain in effect.

## Paid service and saves

The refusal applies to the next quote. It does not shorten either person's paid
contract, remove equipment, alter wounds or change salary. A previously accepted
paid arrival still arrives and receives its full term. Ordinary exact-second
expiry remains authoritative.

Only a living, uncaptured, currently serving rival blocks the quote. Dismissed,
dead, captive, pending-arrival and expired rivals do not block it. A different
squad, location or active march does not hide a serving rival.

New default authored campaigns carry this rule in their pinned content. Older
pinned packages without the optional field remain neutral. Plain campaigns use
the current default rule for future quotes while retaining existing paid service.
The refusal adds no save-version flag or relationship event history.

## Authoring

The character editor offers up to three directed service refusals. Each contains
another character's stable ID and a nonempty reason of at most 300 characters:

```json
"serviceRefusals": [
  {
    "character": "person-112",
    "reason": "Discrepan sobre el trato a los pacientes."
  }
]
```

Unknown IDs, self-reference, duplicate targets, excess entries and malformed
records are rejected. Normal editor line breaks are accepted. Custom campaign
authors may write relationships for any known characters, including historical
characters; those choices are the author's dramatization. An omitted field means
no refusal. The saved package identity protects the running campaign from later
editor changes.

## Verified scope

The affected 13-file batch passed 160 checks. The new model and mounted checks
exercise public hire, renew, dismiss and clock actions: rejection leaves money
and state unchanged apart from the error; forty paid seconds remain valid;
ordinary dismissal clears the refusal; renewed payment and exact expiry survive
save/reload. Tests also cover accepted paid arrivals, stable new identities,
legacy neutral content, marching rivals and editor undo/redo/launch.

This is a bounded service refusal. Relationship complaints, forced early
departure, contextual fears and recorded voices remain open. A green affected
batch does not prove full JA2 parity or an entire fresh campaign.

## Preferred companions

An authored favorable relationship gives a personnel choice before deployment.
Inés Aguirre (`person-107`) trusts Petrona Lagos (`person-116`) to help with the
wounded. This directed default relationship is fictional; Lagos does not gain a
reciprocal preference. It does not cancel Aguirre's refusal to renew while Gaspar
Villalba serves.

When at least one preferred person actually deploys with the soldier, that
soldier receives up to **+3 temporary morale**. The companion must be alive,
awake, uncaptured and capable (at least 15 HP). Several preferred people do not
multiply the benefit. Existing earned cohesion takes priority: cohesion plus
preferred support cannot exceed +5, and total morale cannot exceed 100. The
support changes the existing tactical morale rules, including firearm accuracy;
integer rounding can leave a particular forecast unchanged.

The actual issued deployment decides support. A different strategic squad can
count during a coordinated assault if both people enter that encounter. Being
hired, assigned to a nominal squad, awaiting arrival or elsewhere on the map is
insufficient. The hiring, dossier and assignment controls disclose names and
conditions before commitment.

The issued request saves its actual positive `companionBonus` and `companionId`.
Restoring a battle checks that receipt against its original cohort and pinned
relationship, rather than later strategic health or contract expiry. Support is
fixed for that deployment; it is not refreshed hourly or minted for late joins.
Returning removes only the issued temporary support and preserves later paid
morale or actual tactical changes. Salary, contract dates, equipment, ammunition,
health, action costs and campaign randomness keep their ordinary rules.

This bounded deployment rule is Granaderos tuning. The reviewed
[classic JA2 morale source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/11e9430b67d788b73f7a57d22166e8b500c23dab/src/game/Tactical/Morale.cc#L664-L818)
instead averages profile opinions among eligible people present together and
moves a team modifier toward that opinion each hour; moving groups only consider
their own group. This change does not reproduce that formula, buddy recruitment
overrides or evolving opinions. The separate witnessed-loss rule below supplies
an additional companion-specific consequence.

Authors may set up to three directed preferences with the same stable IDs and
reason limits as refusals:

```json
"preferredCompanions": [
  {
    "character": "person-116",
    "reason": "Confía en su ayuda para atender heridos."
  }
]
```

The same person cannot be both preferred and refused by one owner. Unknown IDs,
self-references, duplicate entries, excess entries and malformed records reject.
The editor protects characters referenced by either relationship list; remove or
reassign the relationship before deleting its target. Copy, undo, import and new
campaign launch retain the stable reference. Older pinned packages that omit
preferences remain neutral, and an already issued older deployment does not
receive new support on restore.


## Confirmed companion-loss letters — 4 October 2026

A serving soldier with an authored preferred companion can send a received
letter after that companion dies. This first slice admits deaths from a validated
deployment return or from actual hourly military bleeding. It uses the pinned
relationship and character names, even if cohesion or the morale cap meant no
temporary companion bonus was issued.

The sender must be alive, awake, conscious, uncaptured and still in service at
the exact confirmation time. An unresolved deployed sender is not inferred from
stale strategic health. At return, the validated health and capture records decide
eligibility. Unavailable senders do not receive a deferred reaction. Older pinned
packages without preferences remain neutral; loading a save does not create
letters for past deaths.

The existing received correspondence stores the named reaction. Its stable ID
uses the sender and deceased identities. Reading it performs no campaign action.
The ordinary team/casualty morale loss and removal of issued temporary support
remain unchanged. This letter adds no further morale loss, recorded voice,
coordinates, attacker identity, contract change or equipment change. The separate
witnessed-loss rule below can already have affected the sender.

Deaths confirmed only through detained or resident NPC records, evolving
opinions, contextual fears and forced departures remain open. This letter is a
named text reaction, not complete JA2 relationship parity.

## Witnessed companion loss

A capable issued participant who directly sees a preferred military companion
from that deployment die loses up to **6 additional morale once**. The
relationship is directed: Aguirre can react to Lagos without Lagos having a
reciprocal preference. This number is
Granaderos tuning, not a historical psychological measurement or the classic
JA2 formula.

The witness must be present, awake and conscious. Their own sight and the
revealed room decide observation before the fatal hit or bleeding tick changes
the companion's posture. Knowing that a friendly soldier exists elsewhere does
not prove observation. A critical but living companion, a hidden death, an absent
witness or an old corpse creates no new reaction.

The deployment pins the full preference list even when the morale cap prevents
temporary support. It also records the initially living participants. A real
local recruit joins that authority without receiving new support or preference
context. Extra bodies retained from an earlier visit do not become participants.
A small saved receipt records the deceased identity and the actual clipped loss. Clock
checkpoints retain only receipt progress on the pending request; issued health,
morale and support stay fixed. The receipt survives the actual return and cannot
repeat after loading, corpse reentry or a duplicate report. Older pending deployments without
this optional context remain neutral; loading does not backfill past deaths.

The existing accuracy rule uses the lower morale. Action costs and the AP budget
do not change. Existing physical-hit and bleeding morale rules keep their
different behavior; tactical bleeding gains no generic teammate penalty. Return removes the
original temporary support only once. The separate confirmed-loss letter keeps
its existing delivery rules. This adds a short named text notice; it does not
supply a recorded voice, alter contracts or create equipment, ammunition or
health.
