# Town hall formal facade: 3D review

The current town hall sprite has square stone entrance columns, capped corner piers, a horizontal band between floors, and separate barred upper windows. The earlier 3D facade shared the cabildo's arcades. This increment gives the town hall its own formal facade and keeps the accepted clock crown and two finials.

Direct references:

- `web/app/TacticalBuildingDetails.tsx`: `stoneColumn`, `formalSidePilasters`, `civicUpperStorey`, and the town hall branch.
- `web/app/TacticalArchitectureMaterials.tsx`: the barred opening's proportions and grey-green ironwork.
- `artifacts/three-gameplay-review/2d-building-reference/ayuntamiento-0-exterior.png`: the current sprite, viewed during this review.
- `artifacts/three-gameplay-review/finish/ayuntamiento-0-exterior.png`: the 3D arcade baseline after the separate pigment correction.

The columns stand only in intact authored wall cells. They use the cell-bounded bearings established by the support correction. Edited windows, doors, and breaches remove the corresponding column. The floor band follows the sprite's 66/118 ground-floor proportion. Separate upper panes and bars appear on all four faces. The real compiled template has eighteen such windows. Lower authored roofs retain one formal floor and omit those upper panes; the 3 m slab leaves a standing entrance clear.

The initial live comparison showed that the upper ironwork was too thin and dark to read at the normal camera scale. Its local finish and 28 mm bar widths now follow the retained opening's lighter grille. This adjustment does not change the shared material palette or authored wall and roof finishes.

The change keeps normal collision, door state, and room disclosure. Partial and complete room entry remove the entire formal exterior detail set with the other facade details. The cabildo retains its distinct arcades and cupola.

Focused checks cover all four actual town hall rotations, each of its eighteen upper panes, edited supports, opening paths, the short slab, finishes, crown clearance, and normal cutaways. The broader support and opening checks still cover all fourteen compiled templates. All 66 focused checks and the type check pass.

The playable catalogue produced six live views with no browser errors in `artifacts/three-gameplay-review/townhall-formal-polished/`. Review compared the 0° and 90° exteriors and the 270° interior with the direct sprite. The columns, floor bands, barred upper panes, and clock crown now form a coherent facade. The side view retains distinct upper windows, and ordinary room entry removes the formal details without floating pieces. This is a bounded facade acceptance record; it does not establish final polish for every building or scene.
