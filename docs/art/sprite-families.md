# Seven sprite families

Implemented base scope: seven authoring families, eight exported variants, and 27 sequences. All 216 sets are present and published locally, with 5,568 directional frames.

| Family | Existing base art | Consolidated appearances |
|---|---|---|
| Military | granadero; royalist white variant | granadero, royalist, militia, rifleman, blue-officer, scarlet-officer |
| Worker | worker | worker, artisan, naval |
| Civilian man | surgeon | civilian, surgeon |
| Poncho wearer | gaucho | gaucho, scout |
| Friar | friar | friar |
| Woman combatant | woman-scout | woman-scout, woman-officer |
| Civilian woman | woman-shawl | woman-shawl, woman-headscarf, woman-elder |

The surgeon base supplies a complete existing action collection for civilian men;
the old civilian base had only four sequences. Character portraits are unchanged.
Retired appearance IDs resolve to these bases, including explicit saved and NPC IDs.
Old source images and atlases remain available but are not new authoring targets.

Military retains the existing royalist white-uniform variant as well as
the navy granadero variant. These are separate existing atlases. A shared recoloring
pipeline is not implemented. Both military variants have separately authored complete
27-sequence collections.

Approved baseline: 7 x 27 = 189 family-sequence combinations.
With both military variants exported, 8 x 27 = 216 variant-sequence combinations.
Each requires eight directions: 1,728 directional sequences before animation frames.
Equipment variants and specialist artillery actions can increase this count.
The 216-set base collection is complete. This count excludes equipment variants.

Enemy military always selects the Royalist uniform, including when a saved appearance
uses an old allied military ID. Visible living hostile units also have a diamond
marker labelled Enemigo. The marker follows existing unit visibility filtering.

The runtime audit covers 30 sequences for each of 8 active variants (240 sets):
the 216 base sets plus unarmed prone idle/crawl and motionless dead poses. The full
published archive retains 424 atlases, including retired appearances.

## Base 27 sequences

1. Stand idle
2. Walk
3. Run
4. Crouch idle
5. Crouch walk
6. Prone idle
7. Prone crawl
8. Mounted idle
9. Mounted walk
10. Mounted run
11. Standing aim
12. Crouched aim
13. Prone aim
14. Standing fire
15. Crouched fire
16. Prone fire
17. Standing reload (also re-prime)
18. Crouched reload (also re-prime)
19. Prone reload (also re-prime)
20. Standing melee strike
21. Mounted melee strike
22. Standing interaction
23. Crouched interaction
24. Fall to ground
25. Lie unconscious, breathing (separate motionless dead-body pose from a still frame)
26. Mounted fire
27. Mounted reload

Equipment display classes: empty hands (including blades and throwables), small gun,
and large gun. Shared body artwork is preferred; the equipment artwork pipeline is
not yet implemented. Interactions require standing or crouching. Mounted firearm
use remains supported. Death must stop breathing. Artillery is additional scope.

## Validation and review (2026-09-11)

- Complete family coverage: 216/216, no missing or duplicate direction/frame slots.
- Atlas checksums and dimensions checked before publication.
- Fourteen sprite runtime and asset tests pass; TypeScript and production build pass.
- Browser review includes the animation gallery and a San Lorenzo stance change;
  the rendered game uses illustrated atlases without fallback. This is not an
  exhaustive play-through of all combat actions.
- Fall plays once; the dead pose copies the exact final authored frame and has zero fps.
- Aiming uses the authored pre-shot frame in standing, crouched, and prone poses.
- New source images, prompts, and registration manifests are in
  `assets/source/illustrated-sprites/family-actions/`. Recovered source art is in
  `assets/source/illustrated-sprites/complete-actions/`.
- Review: serve the repository and open
  `assets/previews/illustrated-sprites/family-actions/index.html`.

The three equipment display classes remain separate work. Existing source art
contains weapons; the base count must not be presented as completion of the
empty-hand/small-gun/large-gun equipment variant pipeline.
