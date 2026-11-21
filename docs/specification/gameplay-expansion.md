# Expanded gameplay requirements

This specification preserves the additional Jagged Alliance 2 gameplay,
lighting, building, and recruitment requirements. It extends the
[original specification](original.txt) and does not replace the Spanish
web-game requirement or reduce the original completion criteria. For current
product scope and later design overrides, read [current game design](game-design.md).
The supplied screenshots illustrate the AIM portrait grid/detail dossier,
tactical inventory, NPC dialogue, strategic sector grid/squad assignments, and
animated tactical combat.

## Required player experience

1. A portrait-based recruitment catalogue opens complete individual dossiers, with well-defined historical and foreign fighters. Preserve familiar JA2 attributes with minimal period adaptation; explosives competence also covers powder and artillery.
2. Persistent strategic and tactical modes: every sector can be entered and explored. Multiple independent squads contain at most six operatives. Their locations and travel between sectors matter. The strategic map displays hired personnel, assignments, stats, movement and town militia. Tactical maps contain independently moving animated squad members and plausible NPCs.
3. NPC conversation can lead to recruitment, gated by leadership and campaign conditions such as liberating a particular town or enough towns.
4. Every operative has a distinct personality, skills and authored Spanish speech for contact, clearance, ending and other gameplay events. Training specialists affect militia instruction.
5. Individual inventory supports weapons, ammunition and special period equipment. Boleadoras act as recoverable throwing weapons with appropriate effects. Dead or unconscious characters can be looted; gear transfers must conserve quantities and condition.
6. Consult JA2-Stracciatella for gameplay implementation references and improvements, and the supplied sprite, map and hotkey resources for fidelity.
7. Carrying capacity depends on strength. Excess weight slows movement/increases AP or energy cost; sustained use can improve strength. Sneaking and other practiced skills can develop.
8. Day/night gameplay derives from strategic time, which the player can advance.
9. Tactical exploration is free roaming outside combat. Enemy contact transitions to turn-based combat. Walk, run, crouch/sneak and prone movement consume different energy. Energy is distinct from action points; reaching zero causes unconsciousness. Recovery and medical assistance must have defined rules.
10. Horses can be acquired and assigned. Individual mount management and riding skill influence play.

## References supplied

- https://github.com/ja2-stracciatella/ja2-stracciatella
- http://ja2v113.pbworks.com/w/page/28015925/Anatomy%20of%20a%20sprite
- https://www.scribd.com/document/621229369/Ja2-113-Hotkeys-Alt-Mouse
- http://ja2v113.pbworks.com/w/page/28916244/Map%20Database%20Project

## Design choices grounded in the references

The sprite reference describes consistent tile geometry and offsets; Granaderos
must retain consistent foot anchors and depth ordering, and produce genuine
movement cycles in addition to action poses.

The familiar attributes remain Health, Agility, Dexterity, Strength, Leadership, Wisdom, Marksmanship, Mechanical, Explosives and Medical internally. Spanish dossiers label them Salud, Agilidad, Destreza, Fuerza, Liderazgo, Sabiduría, Puntería, Mecánica, Pólvora y artillería, Medicina. Riding can be a separate period competence without rewriting the supplied historical baseline statistics.

Historical support for gaucho use of boleadoras: Colegio Militar de la Nación, https://www.colegiomilitar.mil.ar/rediu/pdf/ReDiU_0310_art3-Guemes.pdf. Museum corroboration for early-nineteenth-century military use: https://patrimonioargentino.cultura.gob.ar/index.php/Detail/objects/75674. Game dialogue and personalities for historical figures are dramatic interpretations and must not be presented as authenticated quotations.

## Required capabilities

| Capability | Requirement |
| --- | --- |
| Portrait catalogue with full dossiers | Present a portrait recruitment catalogue with individual dossiers, all ten internal attributes (`Health`, `Agility`, `Dexterity`, `Strength`, `Leadership`, `Wisdom`, `Marksmanship`, `Mechanical`, `Explosives`, `Medical`), riding competence, and explicit recruitment contracts. |
| Foreign fighters | Provide complete dossiers, era-appropriate backgrounds, and a clear foreign registry for the Brown, Bouchard, and Paroissien profiles. |
| Multiple independent six-person squads | Support independent squads of up to six operatives with separate assignments, travel routes, locations, persistence, and strategic map controls. |
| Persistent playable sectors | Allow entering friendly and hostile sectors, travelling along actual routes, and returning to sectors without regenerating cleared forces or depleted items. |
| NPC talk and conditional recruitment | Support visible NPC encounters, conversation choices, leadership and liberated-town conditions, and persistent recruitment outcomes across saves. |
| Per-personality Spanish event speech | Trigger authored Spanish speech lines for each personality on contact, sector clearance, campaign endings, and key gameplay events without generic placeholder repetition. |
| Strength-based individual inventory and growth | Enforce carried weight against strength capacity, apply movement and energy or AP encumbrance penalties, and develop strength and practiced skills through sustained use. |
| Corpse/unconscious loot and boleadoras | Conserve item quantities and condition across transfers and looting of dead or unconscious characters, and support throwable, recoverable boleadoras. |
| Night visibility and strategic clock | Derive day/night conditions from the advancing strategic clock and link them to tactical night rendering, visibility range, and sector entry. |
| Free roaming, combat transition, energy, and unconsciousness | Run free-roaming exploration outside combat, transition to turn-based combat on enemy contact, apply distinct energy costs for walk, run, crouch/sneak, and prone movement, trigger unconsciousness at zero energy, and enforce defined recovery and medical-aid rules across saves. |
| Individual horses and riding | Model individual mount acquisition, stamina, and riding skill effects on strategic and tactical play. |
| Walking and action animations | Provide complete directional movement cycles alongside the eight infantry action keyframes with consistent foot anchors and depth ordering. |
| Adapted hotkeys | Provide a familiar JA2-inspired hotkey scheme adapted to avoid browser-shortcut conflicts. |

## Lighting clarification

The user additionally requires night illumination with period substitutes for modern light sticks. Throwable torches, lanterns and campfires must change tile luminosity and detection/line of sight. Night-vision skill should extend sight by one or two tiles. The provided day/night screenshots illustrate tactical visibility overlays and localized light, rather than simply darkening the whole screen. Completion requires light-source range, occlusion, lifetime and skill tests, plus a clear rendered visibility overlay.

## Building clarification

Buildings must have walkable multi-tile interiors. Walls block movement and sight; windows permit sight into rooms while remaining physical obstacles. Roofs and facades hide interiors until observed by a squad member. Door leaves occupy individual edges with separate open/closed states, including adjacent leaves that form a double doorway. Solid rectangular building blockers do not meet this requirement.

## Correspondence desk and recruitment

The third primary screen is the Spanish-language Escritorio de campaña, entered from the strategic map. Its catalogue contains available service records; encounter-only people are excluded from hiring cards. Important leaders require physical sector conversations and campaign conditions. The desk lists their locations as contacts without a hiring action. Foreign recruits must have era-appropriate backgrounds; fictional biographies must remain clearly identified.
