# Brief combat reactions

A capable soldier can react after a real firearm shot passes close without
touching or injuring that soldier. Enemy fire and friendly fire use the same
physical passage check. The firing soldier does not react to the muzzle of
their own shot.

The check follows the resolved single ball or individual pellet paths before
their actual stop. Reflections and falling paths retain their real geometry.
An early cover stop, distant passage, hit, cancelled attack or ignition failure
cannot supply a near-miss reaction. Learning eligibility and successful skill
growth do not control speech. Cannon and blade actions remain separate.

The existing near-passage distance is 0.9 map cells, with the existing vertical
body margin. These are Granaderos game values. They do not claim an exact JA2
formula or a distance in metres.

Only the affected own soldier's ID enters the transient reaction metadata. That
metadata contains no attacker, private obstruction, terminal point or trajectory
model. The frame retains the existing battle snapshot and visibility filters.
The ID is recorded after discharge and physical resolution. This can describe
a local close pass without claiming that the soldier saw the shooter. It does
not change damage, costs, equipment, randomness or saved state.

Characters have separate optional `near` and `interrupt` speech lines. Neither
uses the enemy-contact line as a fallback. Six fresh default paid characters
have original Spanish lines: 104, 105, 107, 110, 126 and 130. Authors can set or
clear both lines in the character editor. Older pinned packages that omit them
stay silent, and clearing an optional line removes its field.

The battlefield samples actual contact, injury, close-pass and interrupt
events. Preparation and animation frames do not advance that sample count.
Non-contact reactions remain occasional, with the existing 12-second chatter
delay. A shown reaction disappears after 10 seconds or a manual close. Automatic
turn selection does not discard an unfinished reaction. The same passage cannot
repeat at final commit or be recreated by loading a save. Replacing the battle
discards its pending playback.

See the [current acceptance record](../../verification/physical-near-miss-feedback-2026-10-05.md).
