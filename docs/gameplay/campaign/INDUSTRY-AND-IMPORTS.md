# Money and equipment

The browser campaign uses pesos as its only strategic resource. The Tesorería
shows the balance, daily income, time until the next payment, and an optional
breakdown by locality. There are no material stocks, production recipes,
resource convoys, horse purchases, breeding, or feed.

Controlled localities pay at midnight. Coastal income represents trade and
customs; inland income represents local contributions. Occupied sites pay zero.
Damage reduces income to 25%; coastal blockades apply another 25% multiplier.
The screen and payment code both use `game/economy.js`. Income does not require
managing supply routes. Territorial routes still affect travel and militia.

These are design abstractions with balance values, not historical tariffs.
Contributions and merchant financing are documented in [“Pagar la tropa”: vías
de financiamiento y composición del gasto militar del Ejército de los Andes,
1815–1818](https://portal.amelica.org/ameli/journal/237/2371031006/html/).

Players also receive one-time NPC quest payments, 250 pesos for a first sector
victory, and cash found on the tactical map. Use **Recoger** beside the gold money
marker. A surviving soldier must bring the money out of the sector. The campaign
records recovered caches so saves and repeat visits cannot pay them twice.

Recruitment, militia, diplomacy, fortifications, and equipment all cost pesos.
Organizing Retiro costs 300; El Plumerillo costs 500; funding the army costs 3000.
The final preparation also needs three purchased guns, the parliament agreement,
and fortified control of Mendoza and both Andean passes.

Personal weapons remain finite equipment. Brown Bess and Baker imports take
72–120 hours and wait for an open Ensenada. Foreign relations affect their prices.
Local weapons and artillery arrive immediately. Artillery is counted in the
armory, with no separate resource counter.

Each firearm receives ten cartridges on deployment at one peso per cartridge.
Validated unused ammunition is refunded on return. Tactical ammunition remains
finite. Militia training includes its initial kit. Cavalry access is automatic;
there is no separate horse economy. Repairs and personal kit refills cost pesos.

Start a new campaign for economy version 2. Earlier economy saves are rejected
with a clear message; no save conversion is performed during active development.

Validation: `tests/economy-web.test.mjs`, `tests/quests-web.test.mjs`,
`tests/equipment-imports.test.mjs`, and the complete campaign playthrough cover
the income, cash recovery, spending, and progression rules.
