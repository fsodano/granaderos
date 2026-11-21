# Individual outfit equipment

Across tactical exploration, turn-based combat, and the campaign sector inventory, soldiers equip, stow, transfer, or drop individual head, torso, and leg garments with persistent weight and condition. This covers the general outfit slot requirement, not the full JA2 armor system.

Each soldier has separate head, torso and leg slots, apart from the two hands and twelve pockets. Supported garments are a felt hat (0.3 kg), wool poncho (2 kg), linen shirt (0.6 kg) and campaign trousers (0.7 kg). The saved `outfit` field is the torso slot. A spare occupies one large pocket. Equivalent garments may share a quantity record, but each member still needs a physical pocket.

In the tactical inventory, select the worn outfit to give or drop it. **Guardar vestimenta** puts it in a large pocket. Select a pocket containing clothing and use **Ponerse vestimenta** to wear one garment. An exchange uses the vacated pocket for the previous outfit. The operation fails without changing either item when the destination cannot fit. Clothing changes cost 8 AP in combat; exploration advances time without spending AP. The selected hand, gun load, and attachments stay intact.

The sector inventory also supports wear, stow, drop and pickup. Equipment changes need a conscious soldier present in a safe sector. Ground transfers additionally need a discovered, accessible, cleared field. Equipment shops are deferred. Fresh Retiro has one identified linen shirt in its finite armory chest. An opened or looted saved chest keeps its actual contents; entry and save loading do not add that shirt to an older chest.

Initial personal clothing is issued once when the recruit first enters service. It includes one worn poncho, hat, and trousers. A saved empty body slot is deliberate and is not refilled. The former global poncho reserve no longer exists. Assaults, visits, return reports, rehires, and save loading do not recreate garments or grant protection from a pooled stock total. Clothing can be transferred, left in the sector, recovered from a body, or retained in captivity. Its condition and any instance identity follow its current owner. Older return records do not become duplicate owners.

A serviceable worn poncho retains the existing climate and melee modifiers. A packed or zero-condition poncho supplies neither modifier. The UI says **Vestimenta**, not ballistic armor. Weight, AP cost and the retained damage modifier are Granaderos tuning. Clothing does not reduce bullet damage.

## Regional wear and repair

An actual physical injury wears only the recipient's garment in the struck region: headwear, torso outfit or legwear. Each injury costs `ceil(actual HP lost / 5)` condition, capped by the remaining garment condition. A bodyguard who receives the injury also receives the wear. A miss, absent garment, bleeding tick or damage beyond the recipient's remaining HP cannot wear another garment. Ruined clothing stays owned at condition zero.

The existing **Todo el equipo llevado** repair assignment repairs worn and packed garments after weapons, fittings and tools. It uses the same finite hourly allowance and carried toolkit points. Legacy stacks split one member before repair; the existing saved-entry limit can stop work before spending materials. Repair retains identity, quantity, ammunition and health. See [carried equipment repair](equipment-repair.md).

An owned packed linen shirt in at least 50% condition can instead be consumed for three actual dressings through [field preparation](field-dressings.md). A worn or held shirt must first be packed normally. This creates a finite choice between retaining, repairing, wearing or consuming the garment. These condition thresholds, wear rates and recipe values are explicit game tuning. Regional ballistic protection remains open. Cannon and map appearance belong to the separate 3D effort.

## Campaign effects

Removing free assault protection changes later combat outcomes.
