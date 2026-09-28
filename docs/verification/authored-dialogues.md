# Authored resident dialogue choices

New world residents can have a text conversation with connected passages and
player choices. The editor, actual tactical conversation and saved campaign use
the same pinned definition. This delivery supports authored branching text; it
does not add quest conditions or gameplay effects.

## Behavior

Each dialogue has an entry passage and up to 30 passages. A passage has an editor
title, visible text and up to 12 labelled choices leading to existing passages.
A passage without choices ends that part of the conversation. Explicit loops are
valid. Disconnected passages remain available for drafting; they are not reachable
in play until connected. Unknown fields, duplicate identities, invalid text or
missing destinations cannot launch as valid content.

The resident's sheet edits the entry, passages, text and choice destinations. It
protects a referenced passage from deletion. Copying a character copies the graph
independently. Draft recovery, undo/redo, export and campaign launch use the
existing content path. Older residents without a graph retain their greeting and
ordinary conversation controls.

The player approaches a living, conscious resident and chooses Conversar. Choices
advance the saved passage by character identity. Other approaches, closing the
conversation, leaving the cell, recruitment, dismissal and saving do not reset
that passage. The graph is stored once in the campaign package, not copied into
each physical NPC snapshot. Save admission checks the cursor and displayed text
against the pinned graph.

A choice carries its source passage. The campaign rejects a stale or invalid
choice and checks the same local actor/scene conditions as ordinary conversation.
The game page commits accepted conversation state immediately, so two clicks
before a render cannot silently overwrite the first accepted branch.

## Evidence

Runtime source: `8496b3d4fa435a92b273cfbab4e950dc8b5c5832`.
The complete local suite passed **618/618 tests**, with no failures or skips.
Types, production export and all 36 baseline comparisons passed. The documentation
audit retains 176 requirements, including all 50 original and 87 parity rows, with
15 evidence records. Exact-head CI must pass before merge.

- `tests/content-dialogue.test.mjs`: both branches, a loop, a terminal passage,
  active saves, other approaches, departure, recruitment/dismissal/return,
  stale/invalid choices, unavailable actors, graph rejection and altered cursors
  or text.
- `tests/story-editor.test.mjs`: mounted graph authoring, disconnected draft,
  reference protection, undo, independent copy and launch; actual movement and
  conversation then select and save the authored branch.
- `tests/webmcp-campaign.test.mjs`: mounted game conversation follows the written
  options, rejects a second stale click and saves the accepted branch. Existing
  local hiring and tactical synchronization cases remain active.

## Limits

STORY-03 remains partial. Conditions, gameplay effects, quest states, rewards,
role bindings and effect receipts are still open. Graphs currently belong to new
world residents; historical conversations retain their stock mission/recruitment
behavior. Recorded voice, arbitrary campaign endings and authored scene movement
are separate work. These checks do not establish full campaign or live-browser
acceptance.
