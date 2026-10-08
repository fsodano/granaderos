# AI cartridge sharing to usable held guns

This is a small T07 admission correction after [paid owned gun handovers](ai-packed-gun-handover.md) and [firearm serviceability](firearm-serviceability.md). It does not complete the full AI parity row.

The old donor selected a cartridge gift for an empty primary at condition zero. In a real enemy turn, the donor spent 4 internal AP and one finite cartridge. The receiver could neither load nor fire that broken gun. A useful owned packed-gun handover could also lose its donor AP to this gift.

The donor now uses the shared `firearmServiceable` rule. A broken-only recipient makes no cartridge request. If that recipient holds a healthy empty secondary pistol, its actual hand record supplies the ammunition family and capacity. The existing transfer, per-hand reload, paid hand swap and fire authority perform all work. No new ammunition, command, AP cost, save field or reserve total is introduced.

Measured paid results:

- Broken-only gun: donor AP stays 4 and its three cartridges stay three; the receiver gets none. The old turn spent all 4 AP and left one unusable cartridge with the receiver.
- Healthy empty secondary: one real pistol cartridge is given for 4 donor AP. The receiver spends 28 AP loading that hand, 4 AP swapping, and 6 AP firing. The displaced broken gun remains exact in the other hand. One charge is consumed and the healthy gun wears from 100 to 99.
- Authored secondary: its own selected rifle family, two-round capacity and partial loading state are retained through transfer, reload, swap and two paid shots. Independent cases also cover the selected shot-load alternative, one available charge, and saved partial work.
- Existing ready donor pack gun: removal of the useless cartridge request allows the already published paid gun handover, equip and shot. The donor retains its cartridge and held gun.

Healthy-primary donation policy is unchanged, including its existing numeric-ID family lookup. An independent 108-case comparison checks the exact chosen order and full enemy-turn result against the accepted predecessor. Dressings, immediate defense, observed recipients, approach limits, stable ties, finite donor reserves and current queues retain their existing paths. A saved real movement interruption resumes one secondary gift and load with one six-second round charge.

Packed guns do not create new cartridge requests in this cut. A loaded owned pack gun can still equip and fire its own charge; it receives no speculative future reserve beforehand. An empty packed gun remains outside the current automatic equip/load route. Once a packed gun becomes the healthy primary, the existing primary donation policy can apply. Donor reserve policy is unchanged: a broken donor can still conservatively retain a cartridge for its own unusable gun. Recipient AP affordability for ordinary primary gifts and broader coordinated supply requests remain open.

Run the affected core checks:

```sh
node --test tests/tactical-ai-serviceable-sharing.test.mjs tests/tactical-ai-sharing.test.mjs tests/tactical-ai-packed-gun-handover.test.mjs tests/firearm-serviceability.test.mjs
```

The publication package also includes the wider fast equipment, ammunition, care, artillery, reaction, recorder and HUD gate. This correction changes only `game/tactical-ai-sharing.js`, adds the focused test above, and changes the prior handover test that documented the old broken-only gift. It does not change gameplay reducers, save validation, 3D assets or presentation code.
