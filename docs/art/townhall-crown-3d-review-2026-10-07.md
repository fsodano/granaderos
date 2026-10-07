# Town hall clock crown: 3D review

The retained town hall sprite has a wide curved clock crown, a stone entablature, and two low stone finials. This increment gives the 3D town hall that silhouette. The cabildo keeps its separate clock cupola.

Reference evidence:

- `web/app/TacticalBuildingDetails.tsx`, `clockPediment`: the current sprite outline, clock placement, entablature, and finials.
- `artifacts/three-gameplay-review/2d-building-reference/ayuntamiento-0-exterior.png`: direct render of the current town hall sprite, viewed before this change.
- `artifacts/three-gameplay-review/supports/ayuntamiento-0-exterior.png`: live 3D cupola baseline.
- `artifacts/three-gameplay-review/finish/ayuntamiento-0-exterior.png`: live 3D view of the new joined crown and both finials. The concurrent finish correction is separate from this geometry increment.

The crown rests above the existing facade and follows two intact authored wall cells around the entrance. An edited window, door, or breach at either support removes the crown and both finials. A real upper walking cell that overlaps the full entablature footprint also removes them. The clearance check uses the long, shallow footprint in the facade's local frame; it does not reserve a square over the inner roof. Blocked upper cells and ground-level surfaces retain the decoration.

The clock face is static scenery. The change keeps authored wall and roof finishes, ground collision, and room disclosure. Normal partial and full room cutaways remove the complete crown and finials with the other exterior details.

Focused checks compile the real town hall template in all four rotations. They check facade contact, real front/back thickness, the curved shoulder silhouette, entrance alignment, both finials, edited supports, upper route clearance, finishes, and normal cutaways. The existing full-catalogue support check covers all fourteen templates, four rotations, and intact/window/breach variants; the exterior opening check covers every authored doorway and window centre.

The 0° live view shows a coherent joined crown. The other review orientations still require live capture. This increment keeps the already accepted civic arcades. The current 2D town hall uses formal columns and separate barred upper windows; that remaining facade difference requires its own bounded increment. Geometry checks do not establish final visual polish.
