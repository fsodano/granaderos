# Errand failure after contact death

Accepted errands now end with a permanent `failed` result when the campaign acknowledges a new death receipt for their local contact. The log identifies the known errand and its failure once. An injury, temporary loss of the sector, flight or unconsciousness does not end the errand.

A completed delivery remains completed if the recipient later dies. A death does not introduce an errand the player has never accepted. Failure adds no separate support penalty: the existing civilian responsibility rules apply once. No completion reward is issued for a failed errand.

Physical deliveries retain their exact ownership. For example, if the Retiro contact receives one poncho and then dies, that poncho remains in the contact's saved receipt. It is not returned to the soldier or the depot. The second poncho remains with its current owner. A failed errand cannot reopen through the dialogue or delivery completion path.

The saved failure includes its campaign hour and `contact-dead` reason. Save admission checks the date against the accepted hour and current time, and requires a matching death receipt in the same authored sector and scene. Old saves with already acknowledged deaths are not retroactively assigned new failures.

## Verification

- 81 quest, gift, dialogue and campaign civilian tests pass.
- New checks cover injury before death, once-only failure, save and reentry, absent/unaccepted errands, completed errands, invalid failure dates/reasons and a death receipt belonging to another contact.
- A physical-delivery regression uses a created officer, finite depot ponchos, ordinary movement and item delivery. It applies a controlled fatal damage event to isolate the failure branch, then verifies full tactical/campaign saves, retained ownership, no reward and rejected repeat dialogue. It is not a combat-balance or live-browser test.

This is one failure branch. Escort destinations, voluntary alternatives, detention choices, playable prison rescue and broader quest consequences remain open in the parity audit.
