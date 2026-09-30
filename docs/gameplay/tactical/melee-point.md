# Deliberate melee at a map cell

B or the firearm mode control selects close combat and its attack cursor. Click an enemy to use normal targeted melee, or an empty cell to swing toward that location. F and right-click preserve the selected firearm mode. G or Escape restores walking and contextual use.

`meleePoint` accepts `unitId`, `x`, `y`, and optional `tacticalLevel`. `meleePointPreview` includes the legal approach, its movement cost, prone preparation, and strike cost. A distant order stops within the actual held weapon reach, then swings. Contact or an enemy reaction during preparation cancels the remaining strike. The sprite completes its walk before playing the strike animation.

The action preserves loaded ammunition, reserve cartridges, priming powder and ignition failure. It spends normal action points or exploration time; approach movement spends energy. A swing at empty ground does not roll a hit, award practice, damage a person or wear a bayonet. It never searches a location for a hidden target. Invalid terrain, self-targets, inaccessible surfaces and insufficient total AP are rejected before preparation.

`tests/melee-point.test.mjs` checks reducer costs, interruptions, visibility and elevation. `tests/weapon-mode-input.test.mjs` checks B/F/right-click, empty-cell input, the delayed strike pose and civilian conversation. The top tactical toolbar presents the instruction in a wrapping, high-contrast panel with separate camera and zoom controls.

Validation on the integrated working tree: 211 tests across 20 files passed, the production build verified 962 files, and type checking passed. A separate browser session verified B selects melee; an adjacent empty-cell click plays the strike; a distant click walks into reach before the strike. Loaded ammunition (1), reserve cartridges (9), jam state (true), and priming powder (50) remained unchanged. Escape restored walking. The toolbar stayed readable without horizontal overflow at 1280 and 700 pixels. The existing player session was left unchanged.

The isolated delivery on base `04f1307` passed all 37 focused tests and type checking. Its production build verified 960 files and 856 references. It uses the base camera and movement animation, with no dependency on the separate worker or movement-controller changes.
