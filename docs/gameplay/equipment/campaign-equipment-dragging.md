# Campaign equipment dragging

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The sector equipment panel shows both hands, the general outfit slot and the same four large and eight small pockets used in tactical inventory. Click placement and pointer dragging connect all fifteen slots. Keyboard activation uses the same selection and destination controls. Right-click opens item details or cancels a pending selection. See [click placement](equipment-click-placement.md) for the shared controls and finite outfit exchanges.

The campaign dispatcher uses the shared pocket and equipment-placement planners. It checks the soldier's presence and condition, sector control, pending encounters and both slot fingerprints before changing equipment. Personal equipment can be arranged before the first tactical visit; collecting items from the ground still requires a recognized, safe sector. Campaign arrangement consumes no AP, time, energy, money or supplies.

Hand changes preserve independent pistol charges, gun condition, identity, fittings, unfinished reload work and the other hand. The chosen pocket order is saved in the campaign record and restored on deployment. Selecting an actual empty replacement gun also preserves its empty state, even when its model matches the original issued gun. Arranging ordinary objects does not consume or alter eligibility for initial ammunition issue.

Five original transaction/save/deployment cases cover fitted guns, supplies and ordinary objects, two pistols, rejected gestures and same-model empty replacements. Component checks now cover the fifteen equipment endpoints and unavailable soldiers. Additional outfit cases cover save/deployment, rejection and free campaign arrangement. Existing tactical placement and campaign hand tests remain applicable.

Live verification used a separate campaign-equipment preview: Acosta's rifle moved into the fourth large pocket, dressings moved into the main hand, and a torch moved into the other hand. A full save/load retained all three locations. The user's main campaign save was not changed.

Later live click-placement checks moved the rifle to a chosen large pocket, moved the worn garment into a pocket and back onto the soldier, then equipped dressings in the main hand. Save/load retained all three locations. See [click placement verification](equipment-click-placement.md#verification).

This completes campaign placement between hands, pockets and the outfit slot. Pocket quantity selection now uses the shared [physical stack controls](pocket-stack-quantities.md); hands retain the original single-item limit. Ground-item dragging and simultaneous paired firing remain separate inventory questions; this change does not claim complete inventory or JA2 parity.
