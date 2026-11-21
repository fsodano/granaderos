# Selected inventory gifts to NPCs

On the tactical battlefield and strategic campaign ledger, open a soldier's inventory and select a pocket, hand or outfit item. Click a visible NPC to approach and offer the selected quantity. The soldier keeps the item during movement. At same-floor cardinal contact, the receiver decides whether to accept it. The NPC's current position, the exact source slot and its contents are checked again before the handover.

The preview shows a walking route and destination mark. It does not reveal whether the NPC wants the object. Exploration spends energy and time for movement, then one second for handling, with no AP expenditure. This interaction is restricted to exploration. Enemy contact, exhaustion, physical blockage or a recipient moving away can stop the walk. Paid movement remains spent, the item stays with the soldier, and no NPC acceptance reply is shown.

A special character answers through the existing portrait panel. A refusal shows only the reply and close button, then closes after ten seconds. An accepted gift opens the normal conversation with the current saved campaign reply. Ordinary civilians give a brief refusal without a conversation menu. The reply waits until the visible walking animation finishes. Invalid orders keep the inventory selection; completed offers clear it. Interrupted movement keeps the source item and can clear the cursor as movement takes control. A campaign rejection retains the selection and does not display a successful local receipt.

## Existing authored errand

The Retiro sargento accepts two usable wool ponchos. Each accepted garment retains its condition and identity in the NPC's physical inventory. Wrong objects, ruined garments and excess ponchos are refused without changing ownership. A selected dressing is offered as an object; it does not treat the NPC.

The first physical delivery starts the errand if needed. In a fresh campaign, the second waits for a conversation and an explicit reward choice: collect 40 pesos or waive the payment for local support (+8 loyalty, capped at 100). Both delivered garments stay with the sargento. The player can close the panel and decide later. The journal records the pending choice and the completed branch. Cash and civic rewards are exclusive. Retiro's control condition still applies. Older campaigns with omitted definitions and ordinary authored deliveries retain automatic completion.

Campaign acknowledgement counts are separate from item ownership: items exist only in the NPC's `questGifts`. Later dialogue, repeated clock synchronization, full saves and sector reentry preserve progress, custody and the chosen outcome. Missing or decreased acknowledged receipts reject atomically. A pending choice fails if the recipient dies, including death before the first campaign checkpoint. Completed outcomes remain credited. Gift replies save their actual hour and seconds, including after a conversation crosses an hour boundary. Ordinary clock checks inspect the bounded NPC receipt lists, not the terrain map.

This choice adds no accepted goods. The current errands also include physical medical supplies, escorts and control reports. Arbitrary NPC inventories, barter, money gifts, relationship-driven acceptance and JA2's full authored quest catalogue remain open.

Defensive deployments can omit the usual civilian roster. In that case, the previous nonrecruitable gift owner and his exact items remain in the same sector. Explicit NPC rosters remain authoritative, and named recruits are not restored as duplicate civilians. Omitted or invalid gift owners still reject.

## Primary reference

The classic implementation allows [giving a selected inventory item to a profiled NPC](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Handle_UI.cc#L4560-L4650), [approaches and checks the recipient](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Handle_Items.cc#L2259-L2303), and [evaluates the offer through NPC dialogue](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TacticalAI/NPC.cc#L660-L733). Its [wrong-item reply closes the portrait panel](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TacticalAI/NPC.cc#L1598-L1630), and refused objects are [returned to inventory when possible](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TacticalAI/NPC.cc#L1343-L1357).

The ordinary-civilian refusal, fixed display timeout and period-game handling costs are Granaderos adaptations. Classic acceptance is authored per character and can depend on facts, item type, quest state and opinion; the present game only implements its existing poncho requirement.
