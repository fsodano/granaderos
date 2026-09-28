# Death-triggered world residents

An authored world resident can remain absent until another character dies. This
is a distinct identity, with its own health and character sheet. Activating it
neither revives the previous character nor transfers a campaign role or stock.

## Behavior

The character sheet selects the predecessor, minimum/maximum delay and arrival
cells. Confirmed death schedules the transition once. The saved record binds the
predecessor, death minute and due minute; the random delay stays within the authored
bounds. When due, the existing placement system draws a destination once. If that
cell is loaded, the successor waits outside it without a new draw.

The same path handles civilian and military death. A deployed predecessor
activates the trigger at the synchronized tactical death checkpoint, before
leaving combat. Active saves and later battle reports cannot reverse that death. Before activation, the successor
has no world encounter or directory hint. After activation it uses its own fixed,
initial-random or daily placement, greeting, health and recruitment rules. Its own
death cannot reactivate it. A later successor can form a chain; cyclic authoring
is rejected. Earlier bodies remain in their actual scenes.

Save admission checks unique receipts/events, predecessor death, elapsed time,
authored bounds, destination, loading protection and appearance state. A changed
receipt, missing event or premature appearance cannot silently start a new draw.

## Evidence

Runtime source: `bb64ac520f8ec1a01d9f77bee510161167a32684`.
The complete local suite passed **598/598 tests**, with no failures or skips, in
183 seconds. TypeScript, the production export (721 files and 631 asset references)
and all 36 baseline comparisons passed. The documentation audit retains 173
requirements, including all 50 original and 87 parity rows, with 12 evidence
records. Exact-head CI must pass before merge.

- `tests/death-successors.test.mjs` uses actual civilian attacks, aid, movement,
  military enemy fire, death, saved waiting, recruitment, daily relocation and a
  second death in a successor chain. It also checks rejected saved schedules and
  a batched tactical checkpoint crossing multiple hours.
- `tests/story-editor.test.mjs` creates predecessor and successor through the
  mounted editor, authors the delay, uses undo/redo, protects the referenced
  character from deletion, then observes a real campaign death and saved arrival.
- Existing placement replay, civilian, resident and campaign clock tests check
  compatibility and the shared timing path.

No browser playthrough, complete campaign or loaded-combat performance acceptance
is claimed.

## Remaining work

At this checkpoint, STORY-02 remained partial: personal NPC inventory, looting,
custody, paid local contracts and explicit role/stock transfer were open.
[The later local-contract delivery](local-contracts.md) closes paid local service.
See the [current ledger](published-progress.md) for the remaining scope. Only new world residents
can be conditional successors; stock historical roles keep their original gates.
Death of an indispensable stock commander still ends the campaign. Dialogue/quest
graphs and authored tactical movement remain separate deliveries.
