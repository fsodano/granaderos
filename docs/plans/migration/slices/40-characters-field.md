# Slice 40: name the saved per-character records

## Field meaning

[`CampaignSnapshot`](../../../../packages/game/public/campaign-types.ts) is the
campaign portion of a [`GameSnapshot`](../../../../packages/game/public/game-snapshot-types.ts)
save envelope.
Its `characters` map is keyed by character ID and carries the per-character
records used to restore `Character`, `Health`, `CharacterAbilities`,
`ServiceContract`, and strategic location and assignment state. The field names
those records; it does not define a second owner for a person.

## Compatibility contract

[`decodeSave`](../../../../packages/game/save.ts) reads legacy campaign field
`operativeState` only when `characters` is absent, then removes the legacy
field. If both fields are present, `characters` wins. Encoding writes
per-character records only under `characters`.

## Behavior to preserve

- New saves store the per-character records under `campaign.characters`
  through [`encodeSave`](../../../../packages/game/save.ts).
- A save with only `campaign.operativeState` restores the same records and
  re-encodes them under `characters`.
- Character identity, record contents, and the rules that read them remain
  unchanged.
