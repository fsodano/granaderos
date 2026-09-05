# Gameplay clarification — 2026-09-05

This document preserves the user's additional requirements and reference material. These extend the original specification; they do not replace the Spanish web-game requirement or reduce the original completion criteria. Screenshots supplied by the user illustrate the AIM portrait grid/detail dossier, tactical inventory, NPC dialogue, strategic sector grid/squad assignments, and animated tactical combat.

## Required player experience

1. A portrait-based recruitment catalogue opens complete individual dossiers, with well-defined historical and foreign fighters. Preserve familiar JA2 attributes with minimal period adaptation; explosives competence also covers powder and artillery.
2. Persistent strategic and tactical modes: every sector can be entered and explored. Multiple independent squads contain at most six operatives. Their locations and travel between sectors matter. The strategic map displays hired personnel, assignments, stats, movement and town militia. Tactical maps contain independently moving animated squad members and plausible NPCs.
3. NPC conversation can lead to recruitment, gated by leadership and campaign conditions such as liberating a particular town or enough towns.
4. Every operative has a distinct personality, skills and authored Spanish speech for contact, clearance, ending and other gameplay events. Training specialists affect militia instruction.
5. Individual inventory supports weapons, ammunition and special period equipment. Boleadoras act as recoverable throwing weapons with appropriate effects. Dead or unconscious characters can be looted; gear transfers must conserve quantities and condition.
6. Consult JA2-Stracciatella for gameplay implementation references and improvements, and the supplied sprite, map and hotkey resources for fidelity.
7. Carrying capacity depends on strength. Excess weight slows movement/increases AP or energy cost; sustained use can improve strength. Sneaking and other practiced skills can develop.
8. Day/night gameplay derives from strategic time, which the player can advance.
9. Tactical exploration is free roaming outside combat. Enemy contact transitions to turn-based combat. Walk, run, crouch/sneak and prone movement consume different energy. Energy is distinct from action points; reaching zero causes unconsciousness. Recovery and medical assistance must have defined rules. The user's sentence about unconsciousness ended unfinished; recovery rules are an implementation assumption, not an additional quoted instruction.
10. Horses can be acquired/hired/bred. Individual mount management and riding skill influence play.

## References supplied

- https://github.com/ja2-stracciatella/ja2-stracciatella
- http://ja2v113.pbworks.com/w/page/28015925/Anatomy%20of%20a%20sprite
- https://www.scribd.com/document/621229369/Ja2-113-Hotkeys-Alt-Mouse
- http://ja2v113.pbworks.com/w/page/28916244/Map%20Database%20Project

## Research status and implementation choices

The Stracciatella repository and hotkey reference are accessible. The browser fetch encountered PBworks redirect errors; a subsequent direct HTTP request succeeded and the graphics worker read the sprite guide. Its old linked animation forum returned404. Do not claim all linked subresources reviewed yet. The sprite reference describes consistent tile geometry and offsets; Granaderos must retain consistent foot anchors and depth ordering, and produce genuine movement cycles in addition to action poses.

The familiar attributes remain Health, Agility, Dexterity, Strength, Leadership, Wisdom, Marksmanship, Mechanical, Explosives and Medical internally. Spanish dossiers label them Salud, Agilidad, Destreza, Fuerza, Liderazgo, Sabiduría, Puntería, Mecánica, Pólvora y artillería, Medicina. Riding can be a separate period competence without rewriting the supplied historical baseline statistics.

Historical support for gaucho use of boleadoras: Colegio Militar de la Nación, https://www.colegiomilitar.mil.ar/rediu/pdf/ReDiU_0310_art3-Guemes.pdf. Museum corroboration for later early-nineteenth-century military use: https://patrimonioargentino.cultura.gob.ar/index.php/Detail/objects/75674 (Paz's capture in1831). Game dialogue and personalities for historical figures are dramatic interpretations and must not be presented as authenticated quotations.

## Acceptance ledger

| Requirement | Status | Evidence still needed |
|---|---|---|
| Portrait catalogue with full dossiers | PARTIAL | Individual dossier runtime, all attributes and recruitment contracts |
| Foreign fighters | PARTIAL | Existing Brown/Bouchard/Paroissien profiles; full dossier and clear foreign registry |
| Multiple independent six-person squads | TODO | Assignment, separate travel, persistence and UI |
| Persistent playable sectors | TODO | Enter friendly/enemy sectors, return without regeneration, actual route travel |
| NPC talk and conditional recruitment | TODO | Visible NPC, conversation choices, leadership/town checks and save persistence |
| Per-personality Spanish event speech | TODO | Authored lines, correct event triggers, no repeated generic placeholder |
| Strength-based individual inventory and growth | TODO | Weight conservation, encumbrance, meaningful growth and UI |
| Corpse/unconscious loot and boleadoras | TODO | Actual transfer/throw/recovery tests and browser interaction |
| Night visibility and strategic clock | PARTIAL | Time is present; tactical night rendering/visibility and entry linkage |
| Free roaming, combat transition, energy and unconsciousness | TODO | Actual transitions, movement modes, recovery and saved state |
| Individual horses and riding/breeding | PARTIAL | Aggregate horses present; individual lifecycle and effects missing |
| Proper walking/action animation | PARTIAL | Eight infantry keyframes exist; complete directional movement cycles missing |
| Familiar adapted hotkeys | PARTIAL | Existing minimal bindings; update mapping and browser-safe conflicts |

## Lighting clarification

The user additionally requires night illumination with period substitutes for modern light sticks. Throwable torches, lanterns and campfires must change tile luminosity and detection/line of sight. Night-vision skill should extend sight by one or two tiles. The provided day/night screenshots illustrate tactical visibility overlays and localized light, rather than simply darkening the whole screen. Completion requires light-source range, occlusion, lifetime and skill tests, plus a clear rendered visibility overlay.

## Building clarification

Buildings must have walkable multi-tile interiors. Walls block movement/sight; windows permit sight into rooms while remaining physical obstacles. Roofs/facades hide interiors until observed by a squad member. Door leaves occupy individual cells with separate open/closed states, including adjacent leaves that form a double doorway. The earlier solid rectangular building blockers do not meet this requirement and are being replaced.

## Correspondence desk and recruitment

The third primary screen is the Spanish-language Escritorio de campaña, entered from the strategic map. Its catalogue contains available service records; encounter-only people are excluded from hiring cards. Important leaders require physical sector conversations and campaign conditions. The desk lists their locations as contacts without a hiring action. Foreign recruits must have era-appropriate backgrounds; fictional biographies must remain clearly identified.
