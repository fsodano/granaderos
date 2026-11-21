# New campaign introduction

On the strategic campaign layer, selecting **Nueva campaña** opens a four-scene introduction before the desk.
It sets the campaign in Buenos Aires in 1812, introduces San Martín, explains
the independence objective, and offers **Contratar combatientes** or
**Crear mi granadero**. Each choice opens that desk section directly.

The first three scenes advance after 10, 12 and 11 seconds. The last scene
waits for the player's choice. Pause, manual scene selection, Next, Back and
Skip remain available. Reduced-motion preferences disable animation and
automatic advancement. A hidden tab suspends automatic advancement.

No campaign is created until the player chooses a starting path or skips.
Backing out preserves the existing save. Continuing or importing a saved game
does not play the introduction. **Ver introducción** in the title or game menu
replays it without changing the campaign, battle, clock or resources.

All authored scene text, timing and portrait references are in
`campaigns/granaderos/presentation.json`, under `introduction`. `CampaignIntro` accepts a content record separately
from its completion callbacks. This keeps story content separate from campaign
creation. Installed campaigns load their own validated presentation through their
manifest. See [campaign authoring](../../development/campaign-authoring.md).

## Historical basis

The San Martín passage is newly written dramatic dialogue, not a quotation.
Source notes remain in project documentation and do
not interrupt the game. The chart is an illustrative campaign graphic, not an
archival map. The portrait is the game's existing San Martín illustration.

- The Instituto Nacional Sanmartiniano reproduces the [16 March 1812 decree](https://sanmartiniano.cultura.gob.ar/noticia/aniversario-de-la-creacion-del-regimiento-de-granaderos-a-caballo/)
  that names him lieutenant colonel and commander of the new Granaderos unit.
- The initial quarters were La Ranchería; Retiro was authorized on 4 May. The
  intro therefore uses **Buenos Aires, 1812**, without claiming the regiment
  started at Retiro on 16 March. See [the institute's account](https://sanmartiniano.cultura.gob.ar/noticia/los-granaderos-en-el-cuartel-de-la-rancheria/).
- Independence is an objective in the opening, not an accomplished 1812 event.
  The formal declaration followed on [9 July 1816](https://www.argentina.gob.ar/noticias/9-de-julio-dia-de-la-independencia-2).
- The adversaries are described as royalist forces, not all Spanish people.
