# Tactical roster hand indicators

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The six tactical cards show the two physical hand slots beneath each portrait. A two-handed firearm blocks the second slot. Pack contents do not appear as held equipment.

- Red `*`: the active hand is in close combat (blade, bayonet thrust or gun strike).
- Green `*`: that held weapon has a fitted attachment. A loose bayonet does not count.
- Firearm ammunition and condition belong to the displayed hand. The card's accessible description includes both hand contents and attachment condition.

Right-click still opens the selected fighter's inventory. Switching the firearm between shooting and close combat changes the red indicator. Fitting or removing the existing bayonet changes the green indicator independently. Medical supplies and tools do not inherit a stowed gun's mode.

This change does not alter character artwork. Equipment-specific character sprites are separate work.

## Verification

- Full suite: 2,103 tests passed; no failures or skips.
- Type check and production build passed; static export verified 960 files and 856 asset references.
- Live 1280 × 720 preview: six cards, twelve hand displays, no horizontal overflow; two pistols, blocked long-gun hand, loose blades and medical supplies inspected.
- Real preview attacks: fitted bayonet caused 50 damage and wore the fitting from 100% to 99%; bare gun strike caused 18 damage. Both preserved the loaded charge and reserve ammunition. Switching the fitted gun back to shooting removed only the red star.
- Regression tests exercise actual shooting, close combat, attachment fitting/removal, broken attachments, two-hand layouts and roster rendering.
