# Adapted tactical keyboard controls

Reference read: the user-supplied JA2 1.13 hotkey document's tactical selection,
movement and interface sections, accessed 2026-09-05:
https://www.scribd.com/document/621229369/Ja2-113-Hotkeys-Alt-Mouse

Retained recognizable mappings include Space to cycle soldiers, M for the map,
D to finish a turn, R/S/C/P movement/posture, PageUp/PageDown posture changes,
Z stealth and Shift+R or Alt+R reload. Number keys select the six active squad members
instead of browser-sensitive function keys. H opens the Spanish reference.
Additional bindings adapt existing Granaderos commands: W cycles weapons, dressings,
tools, each available held supply, and empty hands;
B switches the held firearm between shooting and close combat and selects its attack cursor. In close combat, click an enemy or an empty map cell to approach and strike. G or Escape returns to walking. A serviceable fitted bayonet stabs; otherwise the gun delivers a stock strike. Press B again to return to shooting. O reserves covering fire, T mounts/dismounts, V toggles sight,
I chooses looting, Q equips dressings, A equips a blade, brackets adjust aim and
plus/minus control zoom. G selects ordinary movement and contextual item use. F
respects the held firearm mode, as does right-click. In close-combat mode both keep
the bayonet or stock strike, including with an empty gun or failed cazoleta. Neither
selects a shot or starts a reload. Press B to return to Disparo before aiming a shot.
In shooting mode, F also lets you fire at a map cell, including a location outside sight. Click or press Enter on the cell. The preview shows AP without confirming a hidden target; the shot uses a fixed height and can hit allies. Body-region selection applies to visible enemy shots. See [location fire](location-fire.md). For other held items, F selects item use.
G or Escape restores ordinary contextual targeting. Fitting and removal are paid
inventory orders; B does not install a loose bayonet.
R selects running for the selected soldier. Pressing R again keeps running; it does not toggle back to walking. Shift+R (or Alt+R) reloads the held firearm. If a loaded held pistol has a failed
cazoleta, the same key prepares it again; this includes the second hand without
a hand swap. Two failed held pistols use separate action-point costs. The ignition kit is implicit. With AP for only one, the main hand is prepared first. An empty,
usable main gun is loaded before a failed spare. See [paired priming](../equipment/paired-pistol-reprime.md).
With dressings, a blade or empty hands selected, normal unit targeting includes
an affordable approach to the patient or opponent. The preview includes movement
and use AP. Contact or a reaction stops the order before use; select the target
again after reviewing the situation. This needs no extra key or action button.
Visible door and chest targets also include the approach and the held key/tool
action. Keyboard focus shows the same cost preview as pointer targeting.
Visible ground equipment markers and dead bodies open the item picker after a
paid approach. I also targets bodies and equipment; Ctrl on a body searches it.
Check items and quantities, or use Seleccionar todos, then spend 8 PA for the selection. Escape closes the
picker without spending pickup AP. Body contents stay hidden until within reach.
Torches use a clicked tile, boleadoras use a visible enemy, and rations use the
acting soldier. A held torch takes precedence over ground movement; changing
the held item restores ordinary ground movement. These supplies have no separate
throw or eat buttons.
Alt-click empty ground to move only the selected soldier without changing facing.
This one order clears the movement group and takes precedence over a held torch.
It supports walking, crouching, and crawling; running and mounted movement are
rejected. The live route preview includes the extra AP cost. Releasing Alt or
leaving the window restores the normal movement preview. No mode is saved.
M opens the campaign chart while retaining the live deployment. To withdraw, use
Retirada or Salir del sector, select a destination and soldiers, move them to the
required edge, and cross with the available PA and energy. Partial departures
keep the encounter open. Escape closes the exit panel.
No modern firing modes, scopes, goggles or nonexistent equipment are added.

`game/hotkeys.js` is the action resolver and Spanish help source. The localized
Battlefield handler dispatches existing authoritative orders; shortcuts do not
bypass AP, equipment or state checks. Held-key repeats and IME composition are
ignored. Text/editable controls and open dialogs suspend shortcuts. Focused buttons,
links, summaries and role-button tiles retain native Space/Enter activation;
letter shortcuts remain available after clicking an action button. Ctrl/Command remain browser-owned; Alt modifies ground movement, and Shift+R or Alt+R reloads.
While help is expanded, gameplay shortcuts pause. Escape closes help or local
conversation and otherwise returns to the movement cursor; it does not undo
already committed game actions. Busy animation and inactive battles block
orders. Cursor shortcuts select a mode and never attack an implicit target.

Verification: `tests/hotkeys.test.mjs` covers mapping distinctions,
modifier protection, editing/dialog suppression, repeat/IME guards and utility
bindings. Mounted Battlefield checks in `tests/battlefield-movement-input.test.mjs` cover selected-actor running, repeated R, normal reload costs and keyboard guards. `web` TypeScript check passes. Browser interaction verification is
not claimed in this document. This is a useful adapted subset, not an assertion
that every JA2 hotkey or mouse gesture is implemented.

With **Manos libres**, Ctrl-click or Ctrl-Enter on an adjacent conscious enemy attempts to take the weapon in its hand. The existing **Recoger equipo** cursor supports the same target without a modifier. The preview shows all remaining AP; at least 28 are required. Failure also spends them. Normal empty-hand targeting still punches. See [weapon stealing](weapon-stealing.md).
