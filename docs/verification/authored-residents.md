# Independent authored world residents

This delivery lets the story editor create world residents independently of the
stock historical identities and paid bulletin candidates. The character owns its
encounter, placement and health. Historical campaign roles remain protected.

## Behavior

The editor creates, duplicates and removes new residents. A copy has a distinct
identity and its own copy of the chosen cell range. Removing a resident removes
its placement; a dependency from another placement prevents removal. Undo, redo,
draft recovery and package import/export retain these definitions.

Each resident has an authored greeting, portrait, body, attributes, abilities and
progression policy. Its encounter can allow or refuse recruitment. Recruitment
requires a real adjacent conversation and can require leadership, a count of safe
localities and control of a named locality. Retiro and Buenos Aires count as one
locality, as in the existing encounter rules. Paid candidates remain off-map
until their separate hiring and arrival process completes.

At this checkpoint, recruitable residents join locally with permanent, unpaid service.
[The later local-contract delivery](local-contracts.md) adds selectable paid terms. A non-recruitable
resident cannot join through dialogue or the bulletin. The dialogue hides the
recruitment action; campaign orders and save admission enforce the same policy.
New identities do not inherit historical campaign powers or a player-officer profile.

Fixed, initial-random and daily placements use the saved presence system. A
resident without a placement does not appear. Random locations stay undisclosed
until encountered. Relocation, recruitment, dismissal, death and saves use the
civilian identity introduced in PR #33. Recruitment removes the NPC from retained
scenes. Later dismissal uses the soldier's actual health and progression ceiling.

## Evidence

Runtime and tests: `cee87d8f96bc55fc0076e3cc7194804297a5961e`.

- `tests/authored-residents.test.mjs`: seven checks cover actual rural encounter,
  movement, conversation, wound, aid, relocation, recruitment, active saves,
  permanent death, non-recruitable policy, schema and identity rejection.
  An established near-level fixture uses actual enemy fire and retreat to check
  experience and fixed progression, then dismissal and a later encounter.
- `tests/story-editor.test.mjs`: the mounted editor creates a resident, chooses
  cells on the map, changes encounter conditions, copies and removes it, undoes
  and redoes the removal, then launches an actual saved campaign encounter.
- `tests/civilian-interaction.test.mjs`: the mounted battlefield omits recruitment
  for a non-recruitable resident and exposes the ordinary action when permitted.
- Existing presence, civilian, contract, content presentation and roster checks
  continue to cover scene guards, historical identities and bulletin separation.

The complete local suite passed **590/590 tests**, with no failures or skips, in
183 seconds. TypeScript, the production export (721 files and 631 asset references)
and all 36 baseline comparisons passed. The documentation audit retains 172
requirements, all 50 original and 87 parity rows, and 11 evidence records. [PR #34](https://github.com/fsodano/granaderos/pull/34)
merged at `86b25fbe54a380c2404f29c371c9d942e6d50998` after
[CI for `8682130`](https://github.com/fsodano/granaderos/actions/runs/36364894495/job/108749224573) passed. No browser playthrough or loaded-combat performance
claim is included.

## Limits at this checkpoint

This does not add NPC inventory, loot, capture/custody, paid local contracts,
death successors or role/stock transfers. It does not add a branching dialogue or
quest graph. Water encounters remain unsupported. Historical regional gates and
campaign roles remain fixed. STORY-02 and the complete campaign remain open.

Death-triggered activation is covered by the later [successor delivery](death-successors.md).
The [requirement register](requirements.json) holds current status for every open item.
