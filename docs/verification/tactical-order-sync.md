# Registered tactical orders and campaign synchronization

A tactical order issued through `issue_granaderos_tactical_order` now uses the
same accepted-state path as the game controls. Previously, it changed the battle
without updating the campaign clock or persistent civilian state. A ten-minute
rest could therefore leave the campaign at its previous time.

## Behavior

An accepted result first receives character speech, then passes through
`syncBattleTime`. Only a valid campaign/battle pair is committed. Both references
are updated immediately, so consecutive tool calls before a React render see the
last accepted result. Autosave receives that pair. Sound follows acceptance and
cannot make a committed order report failure. A delayed UI turn carries its
original battle reference; if a newer order has committed, that old result is
rejected with a visible retry message instead of replacing the current state.

Campaign time, finite medical supplies, civilian wounds/death and successor
schedules follow the existing simulation. Invalid tactical orders and failed
campaign synchronization commit neither simulation state. Game controls display
an error; tool calls return an error. Standalone combat still works without a
campaign. Unmounting the game aborts tool registration.

## Evidence

Runtime source: `a6730e4cf0dd9fff4198d55d31ece77f4388bfde`.
The complete local suite passed **603/603 tests**, with no failures or skips.
TypeScript, the production export (721 files, 631 asset references) and all 36
baseline comparisons passed. The documentation audit retains 174 requirements,
including all 50 original and 87 parity rows, with 13 evidence records. Exact-head
CI must pass before merge.

`tests/webmcp-campaign.test.mjs` mounts the actual game page and captures its
registered tools. It resumes an active authored campaign, issues consecutive
orders without an intervening render, crosses midnight, uses the normal keyboard
control and checks the decoded autosave. Another case moves beside an authored
resident, attacks, consumes medical supplies, confirms death and waits for the
successor. Rejected orders preserve both states and storage. Standalone combat
and registration cleanup are checked separately.

The original clock and civilian-state cases reproduced the missed synchronization
in the previous page. A separate regression reproduced a delayed UI turn
overwriting a newer movement order. All five mounted cases now pass, including
that stale-result rejection.

## Limits

This verifies the registered-tool adapter in a mounted DOM, not browser protocol
compatibility or a complete campaign playthrough. It does not import the advanced
checkout's player-known state projection, additional tool actions, movement
worker or tactical controls. Full integration and hidden-information projection
remain tracked separately. No performance or full-game acceptance is claimed.
