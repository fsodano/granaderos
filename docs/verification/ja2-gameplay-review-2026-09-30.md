# JA2 gameplay overview: documentation review

Reviewed 30 September 2026 against published-main source
`f5b6290f` and the existing development-workspace parity audit. Documentation review
only: no game code, new gameplay verification or change to implementation status.

## Reference and scope

The user-linked [Wikipedia Gameplay section](https://en.wikipedia.org/wiki/Jagged_Alliance_2#Gameplay),
including Characters, describes strategic assignments and travel, tactical contact
and turns, observation, inventory, economic support and character consequences.
It also highlights route freedom, multiple sector entrances, changing shop selection,
variation between campaigns, and possible attribute loss from critical wounds.

This is an overview, not a rules specification. Use the original manual and the
existing audit's primary references before specifying formulas or edge cases.
Do not mix the base game's overview with later mod features. Wikipedia establishes
neither Granaderos implementation nor a requirement to reproduce modern equipment.

## Existing coverage to retain

The [parity audit](ja2-parity-audit.md) already covers most of these systems. Its
row IDs below are documentation references, not new acceptance results. Published
status remains in [the requirement register](published-progress.md); the audit's
historical workspace tests cannot establish the other agent's current integration.

| Reader question | Existing audit rows |
| --- | --- |
| Who controls time, and when does contact change it? | T01–T06, T08, A07 |
| What can a soldier see, hear and traverse? | V01–V09, P01–P05 |
| Who owns an item, and what fits or works in the hand? | I01–I10, C12 |
| How do treatment, rest, training and repair differ? | C05–C07, A01–A06 |
| Why do personnel and territorial choices matter? | R01–R08, S01–S09 |
| What survives travel, defeat and a saved game? | W01–W10 |

Keep these distinctions explicit in feature summaries:

- An automatic reaction shot is not proof of an interactive interrupt window
  (T05–T06). Acceptance needs a saved decision and a valid return to the paused turn.
- Visible terrain does not authorize disclosure of an unseen actor (V01, V07–V08).
  Inspect previews, logs and public state as well as the rendered battlefield.
- Stopping bleeding, stabilizing a critical patient, restoring health and recovering
  energy are separate outcomes (C06, A01–A02). The existing critical-first-aid
  adaptation must remain linked; avoid a blanket claim that treatment never adds HP.
- Neutral shared-service cohesion does not establish authored friendship, refusal,
  complaints or departure rules (R04–R06).
- A successful fixed route does not establish broad player choice or campaign
  balance (W10). Keep the route's evidence boundaries.

## Design questions that need explicit decisions

These are proposed documentation follow-ups. They are not approved mechanics or
claims that code is absent. Inspect the pending integration before assigning an
implementation status. Keep the original 87 parity requirements intact.

| Topic | Documentation improvement and proposed acceptance evidence |
| --- | --- |
| Campaign freedom | Extend W02/W07/W10 with a list of required historical milestones, optional objectives and permitted route orders. Check two legal routes from Retiro with real supplies and casualties. Do not promise that every locality can be skipped if the ending requires control. |
| Sector approach | Extend T09/W02 with the relation between arrival direction and legal deployment cells. State which sectors offer a choice and which have authored restrictions. Test another legal approach, a blocked approach and saved re-entry without relocation or extra AP. |
| Shop progression | Clarify S02: stock replenishment, delivery availability and unlocking a new item are different rules. Document the actual trigger if a catalogue expands; otherwise record the fixed catalogue as an adaptation. Test saved availability and supply disruption. |
| Campaign variation | Extend W07/W09 with a policy for fixed historical actors versus variable placement, stock and events. List only supported variation. A seed must reproduce its outcomes across saves; another seed must not break required encounters or duplicate rewards. |
| Lasting attribute damage | Review C05/A06 before adding a rule. Decide whether critical injuries can reduce attributes, which values change, and how recovery works. Distinguish lasting loss from temporary wound penalties. If adopted, require visible before/after values and a saved recovery path. |

## Existing user decisions take precedence

Keep the Retiro-only opening, historical setting, treasury economy and desktop-only
scope. Keep compatible ammunition and implicit ignition kit: do not restore flint
or priming-charge inventory from an older parity note. Keep separate requirements
for finite medical and specialist equipment; an implicit ignition kit is not a
blanket exemption from item ownership. See [ammunition verification](typed-ammunition.md)
and the [current game design](../specification/game-design.md).

No new implementation acceptance is inferred from this review. Before closing any
follow-up, update its existing register row with the chosen adaptation, exact
source revision and relevant evidence. Add a new requirement only when the chosen
behavior cannot be tracked by an existing row.
