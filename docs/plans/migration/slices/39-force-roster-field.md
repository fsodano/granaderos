# Slice 39: name force membership in the saved campaign

## Field meaning

[`CampaignSnapshot.forceRoster`](../../../../packages/game/public/campaign-types.ts)
stores the IDs of combatants serving in the player's force. `ForceRoster` is
the domain owner of that membership. The
legacy field `recruited` described how a person joined, not the force
membership the list represents.

## Compatibility contract

[`decodeSave`](../../../../packages/game/save.ts) reads legacy campaign field
`recruited` only when `forceRoster` is absent, then removes the legacy field.
If both fields are present, `forceRoster` wins. Encoding writes membership
only under `forceRoster`.

## Behavior to preserve

- New saves store serving combatant IDs under `campaign.forceRoster` through
  [`encodeSave`](../../../../packages/game/save.ts).
- A save with only `campaign.recruited` restores the same IDs and re-encodes
  them under `forceRoster`.
- The IDs, force membership, and recruitment rules remain unchanged.
