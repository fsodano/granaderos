# Dragging equipment between hands, pockets and outfits

Click placement now shares the same physical slots and placement rules, including the general outfit slot. Right-click opens item details or cancels a pending selection. See [click placement](equipment-click-placement.md) for the current controls, outfit exchanges and later verification.

Drag an item from a pocket to a compatible hand. Drag a held item into a pocket to stow it. Dropping onto an occupied pocket exchanges its item with the held item if both fit and the pocket item can occupy that hand. Dropping onto a hand uses the existing equipment selection and displacement rules. Pocket-to-pocket moves retain the existing whole-pocket arrangement behavior.

Hand changes use the existing four-AP selection cost; installing a packed weapon uses six AP. Pocket arrangement is free. Exploration advances time for hand changes without charging AP. Hand placement moves one item from a supply stack; selection of a different held quantity remains pending. Ordinary objects can now occupy either hand; see [ordinary hand objects](main-hand-objects.md).

The preview and reducer share the placement plan. The source fingerprint includes load, condition, attachments, identity and stack contents at pickup. Both endpoints are checked before applying an order. Unavailable actors, changed contents, full packs, large objects in small pockets and the second hand blocked by a long gun reject without changing ownership or spending AP. Stowing one gun preserves the other occupied hand. Actual pocket destinations survive snapshot validation.

Pointer capture tracks the gesture through release, including a release outside the equipment area. It supports the browser's mouse, pen and touch pointer path. Click controls remain available. Only mouse dragging has been checked live; touch and pen remain unverified on physical devices.

## Verification

Eight focused transaction cases cover dressings, tools, hand exchanges, exact destination pockets, loaded pistols, a fitted rifle with unfinished reload work, changed-source and changed-destination rejection, capacity and exploration timing. The full suite passed 1,518 tests before the final two added model cases; those two and the affected component cases passed afterward. Typecheck and production build/static export passed.

A separate live preview uses the production Battlefield. Dragging a dressing from small pocket 5 to the second hand changed 90 to 86 AP and freed one pocket. Dragging it to large pocket 4 changed 86 to 82 AP. Dragging the loaded pistol onto that occupied pocket changed 82 to 78 AP, put the dressing in the main hand and the pistol in the exact destination. Weight remained 5.0 kg. The actual campaign save on port 3000 was not used for this fixture.

This milestone does not establish full inventory or JA2 parity. Quantity selection and simultaneous paired firing remain open. Campaign hand, pocket and outfit placement is now supported; see [campaign equipment dragging](campaign-equipment-dragging.md).
