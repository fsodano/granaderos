# Authored flat roofs: 3D support review

A direct geometry check of the compiled chapel found its bell gable floating above an authored 3 m slab. Its lowest point was 3.6944 m. The house and forge also added their template roof pitch to chimney tops above that slab. A real roof walking cell did not remove the chapel gable.

The renderer now uses the actual flat rise for an explicit terrace or a matching metric roof slab. The chapel gable meets that roof. Domestic and forge chimneys retain their short roof penetration and capped height without an imaginary pitch. The chapel gable also checks its complete shallow footprint against real upper walking cells. All affected details retain normal room cutaways, finishes, and authored collision.

The existing parish and farmhouse helpers now use the same roof-rise calculation. Their focused geometry and cutaway checks still pass.

The playable catalogue has a visible **Tejado** control:

- **Tejado original** retains the source template.
- **Terraza plana** uses an ordinary map edit to author a flat roof.
- **Losa cerrada de 3 m** keeps the template's original roof metadata and supplies real blocked metric roof cells.
- **Azotea accesible de 3 m** supplies real walking cells and an ordinary climb link in front of the entrance.

The catalogue still stamps and rotates actual templates, compiles the map, and enters rooms through normal door and movement orders. It uses the gameplay terrace builder for its metric surfaces. No renderer height or pose override prepares these states. The accessible roof supports normal ascent, movement across the roof, and descent. Review setup does not change source templates or saved campaigns.

Closed slab cells explicitly have a zero obstacle height. They still block movement without placing raised stone blocks over the roof. The upper-surface renderer omits a zero-height obstacle box; positive authored heights and the existing default obstacle height retain their mass. A real movement check confirms that a zero-height blocked roof cell remains impassable.

Reproducible routes include `catalog:capilla:0:exterior:slab`, `catalog:casa:90:exterior:slab`, and `catalog:herreria:0:exterior:roof-route`. Select the same building, rotation, view, and roof state through the visible controls for live captures. All existing catalogue routes continue to use the original roof by default.

Focused checks cover chapel, house, and forge templates at all four rotations. They validate flat contact and cap height, blocked versus walkable upper cells, chimney relocation to another supported wall, input preservation, and ordinary partial/full room disclosure. The fixture check validates 108 edited-roof/view/rotation states, and legal movement orders verify roof ascent, movement, and descent.

Live capture completed twelve corrected slab views for chapel and house without browser errors. Evidence is under `artifacts/three-gameplay-review/flat-roofs-corrected/`, with `catalog-report.json`. The exterior 0°/90° images of both buildings were viewed: the raised blocks are gone, the chapel gable joins the slab, and the capped chimney rises above the roof. The chapel interior at 270° was also viewed to check normal cutaway and furniture disclosure. The prior `flat-roofs/herreria-0-exterior-roof-route.png` was viewed to confirm the accessible forge roof omits its chimney and retains its real climb access. Geometry, fixture checks, and these scoped images do not establish final visual polish.
