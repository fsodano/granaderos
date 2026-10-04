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
No save-version flag or relationship event history is added.

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

This is a bounded service refusal. Relationship complaints, friendly preferences,
forced early departure, new morale effects, contextual fears and recorded voices
remain open. A green affected batch does not prove full JA2 parity or an entire
fresh campaign.
