# Enclosed-room fear — 2026-10-04

This checkpoint adds an optional authored `enclosed_room_fear` condition. Only
fictional Teresa Godoy (126) receives it in newly created default content.
Older pinned packages and ordinary legacy campaigns that omit it stay neutral.
The editor, hiring card and dossier use the same capability description.

At an actual new player combat turn, after normal recovery halves shock, a
capable owned soldier in an intact enclosed room gains up to two shock points.
The existing shock limit is 20. The existing accuracy and interruption rules
use that shock. This condition changes no AP, health, equipment, contract or
random draw. It does not activate during exploration or on an interrupted
resume before a new turn begins. Leaving the room or breaching its perimeter
stops further additions. It does not refund existing shock.

If an author assigns both isolation and room fear, normal recovery occurs
once. Isolation is applied first, then room fear. Both additions use the same
20-point limit. The default package assigns them to different people.

## Occupied geometry

The predicate uses canonical room cells at the actor's actual tactical level,
walkable floor support, a roof or overhead slab, and the current structural
perimeter. It reads no other person, furniture, inventory or hidden contents.
An intact door or window remains part of a room, including an open door or a
broken lock. A rubble gap, a low ruined wall or an absent wall prevents the
addition, even when old room and building tags remain on that cell.

Ground tile and thatch roofs use existing authored building roof metadata.
These roofs have no separate destructible physical slab in the current model.
Where explicit higher geometry covers this room or its structural boundary,
actual slabs take priority over roof metadata. Unrelated upper platforms do not
change another room. The canonical ground house terrace retains its existing
three-unit story and
0.2 slab above default 2.5 walls (the existing 0.3 gap). That exact authored
roof extent is a ground-house exception. Other explicit ceilings must join the
actual perimeter wall tops and leave standing-body space. Each room column
uses its nearest physical overhead slab, including untagged slabs. The selected
ceiling must belong to the room building. A farther roof cannot hide a too-low
intervening floor. Floating or too-low slabs remain neutral. Removing a required
slab makes that room neutral.

An upper room is supported when its canonical room cells occupy actual
`platform` floors, its same-level perimeter has explicit full-height blocked
surfaces, and separate higher slabs cover the room. A terrace `roof` surface
is open air. Parapets and chimneys do not establish an enclosed upper room.
The accepted upper-surface schema has no upper door type; this change does not
add upper doors, stairways, underground rooms or a new roof-destruction action.

## Player indication and saves

Inventory shows current tension separately from a conditional next-turn
explanation. The first actual addition in a deployment sets the optional
`enclosedRoomFearWarned: true` notice and produces a brief named popup. Initial
loading and unchanged saved receipts do not create a new popup. Official
saves retain the actual shock and notice. Actual new deployment clears the
informational flag through the existing encounter-reset path.

The flag is admitted only for canonical owned military actors with the
explicit ability. False, numeric, civilian, enemy and unqualified copies are
rejected. Existing pinned-capability validation remains authoritative.

The two-point effect, geometry thresholds and trigger timing are Granaderos
balance choices. They are not a medical claim, a historical personality claim
or an exact Jagged Alliance 2 formula. This checkpoint does not complete
strategic panic, prolonged discontent, voice assets or the full video scope.

## Paid action evidence

The acceptance uses a real weekly hire of Godoy for 294 pesos from an ordinary
3200-peso campaign, her six-hour arrival and her native 63 HP and ten firearm
charges. The ground case acquires the actual finite roadside crowbar at 60%
condition. The campaign then marches normally. The combat room, passive enemy
screen and starting positions are explicitly declared before the first arena
save. This is a prepared encounter proof, not a conquest or full-campaign win.

In the ground case, opening the door and entering the room precede the actual
combat turn. Shock changes from zero to two. One paid empty-point shot spends
one charge and changes gun condition from 100 to 99. The actual 45-AP wall
breach changes the crowbar from 60 to 57 and creates passable rubble. It leaves
earned shock at two. The next quiet round performs ordinary recovery without
another fear addition. Fourteen arena actions take 24 seconds. The actor
retreats physically, returns her exact nine charges and worn tools, and enters
again with the saved rubble. Actual encounter reset clears transient shock and
the informational notice; it does not repair or refill equipment. No person
dies in this case.

The upper case uses a supported platform at height three, walls of height 2.8,
and a distinct roof at height six with underside 5.8. These are game units.
Two real 20-AP climbs reach the room and its open-air roof. Shock rises to two
inside, then falls to one on the roof through ordinary recovery. Ten firearm
charges and 63 HP remain unchanged. The complete action sequence takes
41 seconds and returns physically to Retiro.

Both cases compare ordinary and presented actions, replay every action through
official saves, and retain native equipment, contracts, cash and the actual
clock. The old pinned omission remains neutral. Unrevealed furniture changes
neither the effect nor its public indication. Mounted controls show the
conditional explanation, one temporary named popup and real expiry. Actual
file import suppresses a saved popup while a later played turn can produce a
new one. The mounted breach changes the current status without refunding shock.

## Validation

The frozen candidate passes 147/147 affected checks across 12 files, including
six core cases and four paid/mounted acceptance cases. The independent review
and final four-case acceptance rerun pass on the same source.

The complete short suite passes 4,895/4,895 tests. All 702/702 selected files
finish out of 710 discovered files; eight declared extended files are excluded.
There are no failures, cancellations, skips or pending checks. The timing report
has `complete: true`, six workers, no name filters and 420.265 seconds elapsed.
Type checking, production build, documentation and baseline audits, five shard
self-tests, complete 710-file partition coverage and whitespace checks pass.
The baseline audit passes all 38 comparisons. The static export contains
1,133 files and 1,033 asset references.

The branch starts at main `ad4098fdcd5ba26b7c1d48d819b0dbf9039e41c4`.
The tested and built production SHA-256 is
`a5441536eba7f7d28f90bc973e78346656c34ade723e3bd534545c8cd7d04b96`.
All 878 test/support paths retain SHA-256
`79e7e18f86c20a60ae132689783b817fc89422d276adf371ff0edb3aff9a2580`.
Production and test inputs remain unchanged after validation. Long campaign
simulations and a live player-browser check are outside this bounded checkpoint.
