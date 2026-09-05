# Adapted tactical keyboard controls

Reference read: the user-supplied JA2 1.13 hotkey document's tactical selection,
movement and interface sections, accessed 2026-09-05:
https://www.scribd.com/document/621229369/Ja2-113-Hotkeys-Alt-Mouse

Retained recognizable mappings include Space to cycle soldiers, M for the map,
D to finish a turn, R/S/C/P movement/posture, PageUp/PageDown posture changes,
Z stealth and Alt+R reload. Number keys select the six active squad members
instead of browser-sensitive function keys. H opens the Spanish reference.
Additional bindings adapt existing Granaderos commands: W changes weapon,
B braces a bayonet, O reserves covering fire, T mounts/dismounts, V toggles sight,
I chooses looting, Q chooses healing, A chooses melee, brackets adjust aim and
plus/minus control zoom. G and F retain this game's move/fire cursors.
No modern firing modes, scopes, goggles or nonexistent equipment are added.

`game/hotkeys.js` is the action resolver and Spanish help source. The localized
Battlefield handler dispatches existing authoritative orders; shortcuts do not
bypass AP, equipment or state checks. Held-key repeats and IME composition are
ignored. Text/editable controls and open dialogs suspend shortcuts. Focused buttons,
links, summaries and role-button tiles retain native Space/Enter activation;
letter shortcuts remain available after clicking an action button. Ctrl/Command remain browser-owned; Alt is accepted only for reload.
While help is expanded, gameplay shortcuts pause. Escape closes help or local
conversation and otherwise returns to the movement cursor; it does not undo
already committed game actions. Busy animation and inactive battles block
orders. Cursor shortcuts select a mode and never attack an implicit target.

Verification: four tests in `tests/hotkeys.test.mjs` cover mapping distinctions,
modifier protection, editing/dialog suppression, repeat/IME guards and utility
bindings. `web` TypeScript check passes. Browser interaction verification is
not claimed in this document. This is a useful adapted subset, not an assertion
that every JA2 hotkey or mouse gesture is implemented.
