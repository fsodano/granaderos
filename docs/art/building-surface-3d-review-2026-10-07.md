# Jointed footing and lower-wall wear: 3D review

The current direct sprites have a jointed stone footing and small stable plaster wear marks. The earlier 3D footing was 13 cm high, had no geometric joints, and disappeared across each complete door cell. This increment gives it the sprite's approximate 20 cm height and retains stone below both door jambs while leaving the threshold clear.

The source is the current renderer, especially `web/app/TacticalBuildings.tsx`'s jointed footing, plaster chips, and wear strokes. The regenerated fourteen-template direct overview is `artifacts/three-gameplay-review/direct-facade-audit/overview.png`. Review also used its full `ayuntamiento-0-exterior.png`. These direct sprites take precedence over older brick warehouse previews; the current warehouse keeps its authored stone finish and closed gable.

The audit covers the fourteen actual compiled templates:

| Authored finish | Templates | Surface treatment |
| --- | --- | --- |
| Limewash | Barraca, iglesia, cabildo, ayuntamiento, estancia | Jointed footing and muted plaster undercoat/scuffs |
| Ochre | Posta, capilla, palacio, pulpería | Jointed footing and undercoat/scuffs matched to the existing pigment |
| Adobe | Casa, caballeriza | Jointed footing and undercoat/scuffs matched to the existing pigment |
| Stone | Almacén | Jointed footing; masonry texture retained |
| Brick | Depósito, herrería | Jointed footing; masonry texture retained |

The course uses 40 cm blocks and 14 mm joints aligned to world coordinates. Its stone texture retains metric UVs. Small plaster patches and strokes use stable tile seeds, sit immediately on the existing wall faces, and stay inside those wall cells. They do not change whole-wall contrast, texture density, or authored wall and roof finishes. Exposed masonry receives no plaster undercoat. Ordinary cutaways keep the footing and omit wear on the lowered face. Breached walls remove their attached surface details.

Focused geometry checks cover all fourteen templates at four rotations, over 300 exterior openings, all 168 exterior/partial/interior states, breaches, explicit finishes, metric slabs, accessible roofs, stable rebuilds, and unchanged authored inputs. All 36 affected checks and the type check pass.

The playable catalogue produced 24 live states for ayuntamiento, casa, palacio, and almacén, with no browser errors, in `artifacts/three-gameplay-review/facade-surfaces/`. Review viewed town hall exteriors at 0°/90° and its interior at 270°, house exterior at 90°, palace exteriors at 0°/90°, and warehouse exterior at 0°. The jointed base and local plaster chips remain visible at the normal camera scale. The stone warehouse retains its exposed masonry, and the room cutaway has no floating surface pieces. The earlier town hall image in `artifacts/three-gameplay-review/townhall-formal-polished/ayuntamiento-0-exterior.png` gives a comparison with the thinner footing and unmarked lower wall.

Door leaves remain a separate increment. The direct sprite also shows a richer palace upper facade; this surface change does not establish final acceptance of that facade.
