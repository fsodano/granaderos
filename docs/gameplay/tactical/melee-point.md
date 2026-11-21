# Deliberate melee at a map cell

During tactical exploration and turn-based combat, pressing **B** or using the firearm mode control switches a held firearm to close-combat mode (bayonet thrust or stock strike) and selects its melee attack cursor, allowing the soldier to strike either an enemy or an empty map cell. Click an enemy to use normal targeted melee, or an empty cell to swing toward that location. F and right-click preserve the selected firearm mode. G or Escape restores walking and contextual use.

`meleePoint` accepts `unitId`, `x`, `y`, and optional `tacticalLevel`. `meleePointPreview` includes the legal approach, its movement cost, prone preparation, and strike cost. A distant order stops within the actual held weapon reach, then swings. Contact or an enemy reaction during preparation cancels the remaining strike. The sprite completes its walk before playing the strike animation.

The action preserves loaded ammunition, reserve cartridges, priming powder and ignition failure. It spends normal action points or exploration time; approach movement spends energy. A swing at empty ground does not roll a hit, award practice, damage a person or wear a bayonet. It never searches a location for a hidden target. Invalid terrain, self-targets, inaccessible surfaces and insufficient total AP are rejected before preparation.

## Presentation

The top tactical toolbar presents the melee instruction in a wrapping,
high-contrast panel with separate camera and zoom controls. The strike uses the
base camera and movement animation.
