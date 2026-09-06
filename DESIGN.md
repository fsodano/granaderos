# DESIGN.md — Tactical HUD: JA2 Bottom-Strip Disposition

**Scope:** Restructure the tactical battle HUD (`web/app/Battlefield.tsx` + `web/app/tactical-hud.css`) into Jagged Alliance 2's bottom-strip disposition. This document is the **implementation contract**: a later CSS task styles the classes below verbatim, and later components use them verbatim. **Class names are FROZEN — exact spelling matters.** No new visual tokens are introduced; everything reuses the existing Granaderos palette, fonts, and primitives.

**Out of scope:** field rendering (`TacticalScene`), game rules (`game/tactical.js`), campaign screens, save/menu chrome. The field (`svg.tactical-field`), `battle-error`, and `battle-result` overlays remain as-is above the strip.

---

## 1. Research Log

### 1.1 Source A — authentic JA2 tactical disposition (reference, not pixel copy)

Observed from authentic Jagged Alliance 2 tactical screenshots, **disposition only**:

- **Squad strip (bottom-left):** a horizontal row of up to 6 portrait cells. Each cell shows the merc's face, name, and thin vertical vitals bars; the selected merc's cell is highlighted; dead/unconscious mercs are dimmed. Empty roster slots render as blank placeholders.
- **Compact selected-merc panel (bottom-center):** a dense cluster of mode/order buttons (move, fire, melee, etc.) plus the end-turn control, all in one horizontal band.
- **Radar / location / clock (bottom-right):** a fixed-width cluster containing the radar minimap, the current sector name, day/clock readout, and the retreat/exit control.
- **Right-click portrait → single-merc inventory panel:** a full panel replacing the strip content: big portrait + name + rank header, a stats grid, a stance grid (walk/run/crouch/prone + special actions), a paper-doll figure in the center with hand slots and readouts (armor/weight/camo), a backpack grid, and a DONE button to close. The radar remains visible.

**What we adopt:** the three-zone bottom strip (roster | context | right cluster), the 6-cell roster with vitals bars, the right-click-to-inventory interaction, the inventory panel anatomy (header / stats / stance grid / paper-doll / backpack / DONE), and the radar staying visible in both modes.

**What we do NOT adopt:** JA2's exact pixel layout, its fonts, its color scheme, or its English labels. All visuals stay Granaderos.

### 1.2 Source B — current Granaderos tokens

Read in full: `web/app/globals.css` (35 lines), `web/app/tactical-hud.css` (19 lines), `web/app/Battlefield.tsx` (89 lines), `web/app/TacticalMinimap.tsx` (11 lines), `web/app/RecoveredInventory.tsx` (8 lines), `web/app/TrainingProgress.tsx` (3 lines). Exact values cited in §2.

---

## 2. Reused Tokens (no new values)

All colors, fonts, and primitives below are **existing** and are the only ones the strip may use. A later CSS task must not introduce new hex values or font families.

### 2.1 Palette

| Token | Value | Usage |
|---|---|---|
| Strip base | `#20241e` | `.ja2-strip` background (matches `.battle-layout` bg) |
| Context band | `#31352a` | `.ja2-context` background (matches `.command-bar` bg) |
| Roster gradient | `linear-gradient(#3e4435,#252c23)` | `.ja2-roster` background (matches `.tactical-roster`) |
| Cell text | `#e3dfbf` | portrait cell text (matches `.portrait-card` color) |
| Cell background | `#18211d` | `.ja2-portrait-cell` background (matches `.portrait-card`) |
| Cell border | `#747558` | `.ja2-portrait-cell` border (matches `.portrait-card`) |
| **Active gold** | `#e0cf7c` | `.ja2-portrait-cell.active` border + `.hand-slot.active` (matches `.portrait-card.active` border) |
| Active background | `#2f3b29` | `.ja2-portrait-cell.active` background |
| Name number | `#bdb17b` | roster index numerals |
| Vitals track | `#111813` border `#515540` | `.ja2-vitals` bars track (matches `.hud-vitals`) |
| Vitals health | `#ca574b` | health bar |
| Vitals action | `#b9ae61` | AP bar |
| Vitals energy | `#65a5b1` | energy bar |
| Empty slot | border `#565d45`, bg `#1c251f`, text `#4e5d48` | empty roster cells |
| Fallback face | `#4c503b` | initials placeholder (matches `.portrait-fallback`) |
| Face border | `#616148` | portrait image border |
| Right cluster bg | `#242a24` | `.ja2-right` background (matches `.battle-header` bg) |
| Right cluster border | `#686e52` | `.ja2-right` border |
| Radar bg / border | `#18211a` / `#8c8963` | `.ja2-radar` (matches `.tactical-minimap`) |
| Radar camera frame | `#ded387` | minimap camera rect (unchanged) |
| Muted text | `#b2b49a` | `.ja2-locale` secondary text (matches `.hud-selection>span`) |
| Panel bg | `#202c25` border `#93906a` | MODE B `.ja2-inventory` (matches `.battle-inspector`) |
| Overlay bg | `#20332c` text `#f1e5c7` | `.ja2-log-overlay` + help overlay (matches `#tactical-key-reference`) |
| Overlay border | `#aaa077` | overlay borders |
| Error | bg `#422b23e8` text `#ffe1bb` border `#986e51` | `.battle-error` (unchanged) |
| Selects | bg `#182d2d` border `#667b6a` text `#e9dfc5` | `.ja2-artillery` selects (matches `.movement-orders select`) |
| Section dividers | `#52645a`, `#43573d`, `#506344` | MODE B section borders (matches `.movement-orders` / `.field-supplies` / `.artillery-control`) |
| Muted small text | `#aeb998` | `.pertrechos` small print (matches `.artillery-control small`) |
| Retreat | `#b59472` border `#6e6549` | Retirada button (matches `.retreat-button`) |

### 2.2 Typography

| Role | Stack |
|---|---|
| Headings (sector name, merc name, panel titles) | `Georgia,'Times New Roman',serif` (matches `h1,h2,h3`) |
| Body / buttons / labels | `Arial,Helvetica,sans-serif` (matches `body`) |
| Numeric readouts (vitals numbers, coords) | `monospace` (matches `.portrait-numbers`) |
| Eyebrow labels | `.eyebrow` pattern: `font-size:12px;letter-spacing:2.4px;color:var(--gold)` (strip uses 8–10px variants as today) |

### 2.3 Reused primitives (existing classes, unchanged)

| Primitive | Definition (current) | Strip use |
|---|---|---|
| `.line-button` | `background:transparent;border:1px solid #566366;color:var(--foreground);padding:10px 16px` | all secondary strip buttons |
| `.gold-button` | `border:1px solid #c4a365;background:#cfb57b;color:#162429;padding:12px 20px;font-size:14px;font-weight:bold;letter-spacing:.5px` | end-turn / DONE emphasis |
| `.hud-vitals` | `display:flex;gap:2px;align-items:stretch;width:19px` with `.health`/`.action`/`.energy` fills | **renamed** `.ja2-vitals` (same anatomy: 3 vertical bars, `width:5px` each, fill from bottom) |
| `.retreat-button` | `color:#b59472;font-size:11px;background:none;border:0;border-bottom:1px solid #6e6549;padding:7px 0` | Retirada in `.ja2-right` |
| `.eyebrow` | `font-size:12px;letter-spacing:2.4px;color:var(--gold)` | panel section labels |
| `.tactical-minimap` | `width:136px;height:75px;border:1px solid #8c8963;cursor:crosshair;background:#18211a` | **renamed** `.ja2-radar` (same SVG, same colors) |

**Language:** all labels remain **Spanish** (existing strings reused verbatim where possible: "Mover", "Disparar", "Atacar", "Cargar", "Curar", "Recargar", "Cebar", "Cambiar arma", "Cuerpo a tierra", "Cubrir", "Montar/Desmontar", "Fin del turno", "Descansar", "Retirada", "DIARIO DE COMBATE", "EQUIPO RECUPERADO", etc.).

---

## 3. MODE A — Battle Strip Anatomy

Default disposition. One horizontal strip pinned to the bottom of the battle layout, replacing the current `command-bar` + `tactical-roster` + `hud-selection` stack. The field (`svg.tactical-field`), `map-caption` (NORTE indicator only), `battle-error`, and `battle-result` remain above it.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  .ja2-strip                                                                │
│  ┌─ .ja2-roster ──────────────┐ ┌─ .ja2-context ─────────────────┐ ┌─ .ja2-right (≈230px) ─┐
│  │ [cell][cell][cell][cell]   │ │ [.ja2-order-grid buttons…]     │ │ .ja2-radar            │
│  │ [cell][cell][empty][empty] │ │ [.ja2-artillery group?]        │ │ .ja2-locale           │
│  │                            │ │ [end-turn]                     │ │ .ja2-garrison-toggle  │
│  │                            │ │                                │ │ Retirada              │
│  └────────────────────────────┘ └────────────────────────────────┘ └───────────────────────┘
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 `.ja2-strip`

Root container. `display:flex;flex-direction:row;align-items:stretch`. Background `#20241e`; top border `#676c50` (matches current roster border). Height per §6. Contains exactly three children: `.ja2-roster`, `.ja2-context`, `.ja2-right`. When MODE B is open the same element carries the modifier class `inventory-open` (see §4).

### 3.2 `.ja2-roster` (left)

- Background `linear-gradient(#3e4435,#252c23)`; `display:flex` row, `overflow-x:auto`.
- Up to **6** `.ja2-portrait-cell` children (hired players; mission allies and militia live in garrison popovers, §3.5). Fewer than 6 players → empty placeholder cells (existing `empty-portrait-slot` styling: border `#565d45`, bg `#1c251f`, "—").
- **`.ja2-portrait-cell`** — button; column layout: `.ja2-portrait-face` (portrait image or initials fallback `#4c503b`, border `#616148`), name line (index numeral in `#bdb17b` + `short()` name), `.ja2-vitals` bars, `.ja2-weapon-line`, numeric readout (`monospace`, "N SAL · N PA · N EN").
- **`.ja2-portrait-cell.active`** — border `2px solid #e0cf7c`, background `#2f3b29` (matches `.portrait-card.active`).
- **`.ja2-portrait-cell.fallen`** — dimmed (existing `disabled` opacity pattern), shows "Fuera de combate".
- **`.ja2-portrait-face`** — the portrait image/fallback block (current `.portrait-vitals img` anatomy: `object-fit:cover;object-position:center 35%`).
- **`.ja2-vitals`** — the three vertical bars (health `#ca574b`, action `#b9ae61`, energy `#65a5b1`) on track `#111813`/`#515540`; identical anatomy to `.hud-vitals` (5px bars, fill from bottom).
- **`.ja2-weapon-line`** — one-line weapon readout under the vitals: current weapon name + load state ("N carga preparada" / "Arma descargada" / "Cazoleta sin cebar" / "Arma blanca").
- **Interaction:** click selects (existing behavior); **right-click opens MODE B** for that merc (Q2, §8); double-click also opens MODE B (kept from current `onDoubleClick`).

### 3.3 `.ja2-context` (center)

- Background `#31352a`; `flex:1;min-width:0`; column layout with internal scroll if needed.
- **`.ja2-order-grid`** — the mode/order buttons, replacing `.command-bar .commands`: `Mover`, `Disparar`, `Atacar`, `Cargar`, `Curar` (mode buttons, `selected` state = active mode), plus `Recargar/Cebar`, `Cambiar arma · 4`, `Cuerpo a tierra/De pie` (quick stance toggle), `Cubrir`, `Montar/Desmontar`, `Recoger equipo` (loot mode), and the aim readout. Same disabled logic as today (`busy`, `s.status!=='active'`, `!firearm`, etc.). Buttons keep the current compact style (`font-size:9px`, icon + label).
- **`.ja2-artillery`** — present **only when `(s.artillery||[]).length>0`** (conditional render, as today). Contains the cannon select, munition select (Bala rasa/Metralla), and the four orders: `Disparar`, `Desplazar`, `Girar`, `Recargar pieza` with PA costs. Selects styled per §2.1.
- **End-turn button** — `.gold-button`-based, right-aligned in `.ja2-context`: `Fin del turno` (or `Descansar` in exploration mode; `Procesando…` while busy). Replaces `.command-bar .end-turn`.
- **Help button** — small `.line-button` "Atajos de teclado · H" toggling the existing key-reference overlay (re-anchored above the strip, §7).

### 3.4 `.ja2-right` (right, fixed ≈230px)

- Background `#242a24`, border-left `#686e52`; `width:230px` (narrows at ≤1100px, §6); `flex-shrink:0`; column layout.
- **`.ja2-radar`** — the existing `TacticalMinimap` SVG (same component, same colors, `#18211a` bg, `#8c8963` border, `#ded387` camera frame). Click-to-center and arrow-key pan retained. Camera pan/zoom controls (← ↑ ◎ ↓ →, −/+, %) flank the radar as a compact row (existing `.map-zoom` button styling).
- **`.ja2-locale`** — sector/day/clock cluster: sector name (Georgia), `OPERACIÓN TERRESTRE · DÍA/NOCHE · LLUVIA/CIELO DESPEDIDO` eyebrow, `Turno N · Ejército patriota`, `N avistados`, and the mode hint + hover coordinates line (from `map-caption`). Muted text `#b2b49a`.
- **`.ja2-garrison-toggle`** — popover toggles (details/summary pattern, existing `.local-garrison` styling): "Oficiales aliados · N temporales" and "Guarnición local · N milicianos", each opening a compact squad list above the strip (existing `.squad-card` styling). Mission objectives popover uses the same pattern (see mapping table).
- **Retirada** — `.retreat-button` styling, existing `onRetreat` handler ("Volver a la campaña" in exploration mode).

### 3.5 Overlays above the strip (MODE A)

- **`.ja2-log-overlay`** — DIARIO DE COMBATE: compact overlay anchored above `.ja2-strip` (right side), showing the last 5 log lines (`aria-live="polite"`, `latest` emphasis). Toggleable; collapsed by default shows only the latest line.
- **Conversation notice** — existing `.notice` panel, re-anchored above `.ja2-strip` (left side), unchanged behavior.
- **Help overlay** — existing `#tactical-key-reference` content, re-anchored above the strip.
- **Garrison popovers** — from `.ja2-garrison-toggle` (§3.4).

---

## 4. MODE B — Inventory Panel Anatomy

Opened by right-clicking a `.ja2-portrait-cell` (or the visible **Equipo** fallback button, Q2 §8); closed by right-clicking again or the **DONE** button (Q2 §8). The strip root carries `inventory-open`: `.ja2-strip.inventory-open`. The panel **replaces** the MODE A content (roster/context/right) — the radar stays visible inside the panel's far-right cluster.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  .ja2-strip.inventory-open                                                  │
│  ┌─ .ja2-inventory ────────────────────────────────────────────────┐ ┌─far─┐ │
│  │ .ja2-inv-header [big portrait | name | Grado]                   │ │radar│ │
│  │ .ja2-stats      [Agilidad…Medicina grid]                        │ │DONE │ │
│  │ .ja2-stance-grid [walk|run|crouch|prone] [sight|torch|bolas|    │ │     │ │
│  │                   free|brace|repair|ration]                     │ │     │ │
│  │ .paper-doll     [hand-slot.primary|.blade|.active +             │ │     │ │
│  │                   .paper-readouts .armor/.weight/.camo]         │ │     │ │
│  │ .slot-grid      [.slot-cell(.equippable) backpack]              │ │     │ │
│  │ .pertrechos     [priming · flints · rations + recovered kit]    │ │     │ │
│  └─────────────────────────────────────────────────────────────────┘ └─────┘ │
│  .ja2-log-overlay / garrison popovers / help overlay float above the strip  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 `.ja2-inventory`

The panel container. Background `#202c25`, border `#93906a` (matches `.battle-inspector`); `display:grid` with the far-right cluster as a fixed column; internal scroll. `role="dialog"` + `aria-modal` per §7.

### 4.2 `.ja2-inv-header`

Big portrait (existing `.portrait`/`portraitFor`), merc name (Georgia), and **Grado** (rank line — currently "Granadero a caballo" / "Ejército patriota"; see §8 LVL/Grado decision). Replaces `.soldier-heading`.

### 4.3 `.ja2-stats`

The stats grid, replacing the inspector's `.stat-pair`/`.meter` blocks. Ten rows, Spanish labels, in this order:

`Agilidad` · `Destreza` · `Fuerza` · `Liderazgo` · `Sabiduría` · `Nivel` (LVL, §8) · `Puntería` · `Pólvora y artillería` · `Mecánica` · `Medicina`

Plus the existing combat readouts: Salud, PA, Energía, Carga/capacidad, Moral, Estado del mecanismo, Riesgo de chispa fallida, knocked-down warning. `TrainingProgress` ("Aprendizaje por práctica") renders as a collapsible section inside `.ja2-stats`.

### 4.4 `.ja2-stance-grid`

Two rows of toggle buttons, replacing `.movement-orders` + the field-supplies action buttons:

- **Movement row:** `Caminar` · `Correr` · `Agachado y sigiloso` · `Cuerpo a tierra` (existing select options as buttons; active movement highlighted).
- **Action row:** `Mostrar/Ocultar campo de visión` (sight) · `Arrojar antorcha · N` (torch) · `Lanzar boleadoras · N` (bolas) · `Liberarse de las boleadoras` (free, only when entangled) · `Calar bayoneta · reservar 16 PA` (brace, only with bayonet id 1811) · `Cambiar sílex · N PA` (repair) · `Tasajo y vendas · 10 PA` (ration).

### 4.5 `.paper-doll`

Center figure. Contains:

- **`.hand-slot.primary`** — primary weapon slot (current weapon name + icon `/art/weapon-N.png`).
- **`.hand-slot.blade`** — blade slot.
- **`.hand-slot.active`** — gold border `#e0cf7c` on the currently active slot.
- **`.paper-readouts`** with three readouts: **`.armor`** (renders "—", §8), **`.weight`** (`carriedWeight/carryCapacity` kg), **`.camo`** (renders "—", §8).
- Armor/helmet/pants/holster positions render as empty/disabled placeholders (§8).

### 4.6 `.slot-grid` + `.slot-cell`

Backpack grid. `.slot-cell` cells; `.slot-cell.equippable` marks cells that accept recovered equipment (from `RecoveredInventory` — "Equipar principal · 6 PA" / "Equipar secundaria · 6 PA" actions land here). Empty cells render as disabled placeholders.

### 4.7 `.pertrechos`

Supplies row: `N cargas de cebado · N sílex · N raciones` (priming/flints/rations) plus the recovered-kit list ("EQUIPO RECUPERADO" entries with equip buttons). Small print `#aeb998`.

### 4.8 Far-right cluster

- `.ja2-radar` (same minimap as MODE A).
- **`.ja2-done`** — `.gold-button` "Listo" closing MODE B (Q2 §8).

### 4.9 Overlays in MODE B

`.ja2-log-overlay` (DIARIO), garrison popovers, and the help overlay float as compact overlays **above the strip**, unchanged from MODE A.

---

## 5. Primitive Inventory — FROZEN Class List

These are the **only** new classes the CSS task may define. Spelling is frozen; modifiers are compound selectors on the base class. No other new class names may be introduced by the strip work.

| Class | Kind | Notes |
|---|---|---|
| `ja2-strip` | container | MODE A root |
| `ja2-strip.inventory-open` | container + modifier | MODE B root (same element, modifier class) |
| `ja2-roster` | container | left zone, up to 6 cells |
| `ja2-portrait-cell` | item | roster cell (button) |
| `ja2-portrait-cell.active` | state | selected merc |
| `ja2-portrait-cell.fallen` | state | dead/unconscious/routed |
| `ja2-portrait-face` | item | portrait image / initials fallback |
| `ja2-vitals` | item | 3 vertical bars (health/action/energy) |
| `ja2-weapon-line` | item | weapon name + load state line |
| `ja2-context` | container | center zone |
| `ja2-order-grid` | container | mode/order buttons |
| `ja2-artillery` | container | artillery group (conditional) |
| `ja2-right` | container | right zone, fixed ≈230px |
| `ja2-radar` | item | minimap (TacticalMinimap) |
| `ja2-locale` | container | sector/day/clock/turn cluster |
| `ja2-garrison-toggle` | item | garrison/mission popover toggles |
| `ja2-inventory` | container | MODE B panel |
| `ja2-inv-header` | container | big portrait + name + Grado |
| `ja2-stats` | container | 10-stat grid + combat readouts |
| `ja2-stance-grid` | container | movement + action rows |
| `paper-doll` | container | center figure |
| `hand-slot` | item | weapon slot |
| `hand-slot.primary` | state | primary slot |
| `hand-slot.blade` | state | blade slot |
| `hand-slot.active` | state | currently active slot |
| `paper-readouts` | container | readout cluster |
| `paper-readouts .armor` | item | armor readout (renders "—") |
| `paper-readouts .weight` | item | carried/capacity kg |
| `paper-readouts .camo` | item | camo readout (renders "—") |
| `slot-grid` | container | backpack grid |
| `slot-cell` | item | backpack cell |
| `slot-cell.equippable` | state | accepts recovered equipment |
| `pertrechos` | container | supplies row |
| `ja2-done` | item | DONE button (MODE B close) |
| `ja2-log-overlay` | container | DIARIO overlay above strip |

Existing classes reused as-is (not new): `.line-button`, `.gold-button`, `.retreat-button`, `.eyebrow`, `.tactical-minimap` internals, `.squad-card`, `.empty-portrait-slot` styling, `.notice`, `#tactical-key-reference`, `.battle-error`, `.battle-result`, `.map-caption`, `.map-zoom` button styling.

---

## 6. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop (default) | `.ja2-strip` height `min(26svh,340px)`; `min-height:150px`. Three zones side by side. `.ja2-right` fixed `230px`. |
| ≤1100px | `.ja2-right` narrows (radar shrinks, `.ja2-locale` compresses to essential lines); `.ja2-order-grid` wraps to two rows; `.ja2-context` scrolls internally if needed. |
| ≤700px | `.ja2-strip` becomes an internal-scroll **column** (roster on top, context below, right cluster below that); `.ja2-portrait-cell` shrinks to `78px` wide (matches current `grid-template-columns:repeat(6,78px)`); `.ja2-inventory` becomes a full-width scrollable overlay with `max-height:70svh` (matches current `inspector-open` mobile behavior). |

The field above the strip keeps its current responsive rules (`field-wrap` scroll, `tactical-field` min sizes). `prefers-reduced-motion` global rule already in `globals.css` applies unchanged.

---

## 7. Accessibility

- **Focus:** `:focus-visible` on all `.ja2-portrait-cell`, order-grid buttons, stance-grid buttons, garrison toggles, and `.ja2-done` — existing global rule (`outline:2px solid #f2d289;outline-offset:4px`) applies; strip must not remove it.
- **Labels (Spanish):** every interactive element gets an `aria-label` in Spanish, following the existing pattern: `"Seleccionar aliado {name}"`, `"Seleccionar miliciano {n}: {name}"`, `"Minimapa del sector. Clic para centrar; flechas para desplazar la cámara."`, `"Forma de desplazarse"`, `"Seleccionar pieza de artillería"`, `"Munición de artillería"`, `"Desplazar cámara …"`, `"Centrar cámara en el combatiente seleccionado"`, `"Acercar/Alejar campo"`.
- **MODE B as dialog:** `.ja2-inventory` carries `role="dialog"` + `aria-modal="true"` + `aria-label="Equipo y órdenes del combatiente"` (existing inspector label). `Escape` closes MODE B (existing `cancel` shortcut behavior extended).
- **Live regions:** `.ja2-log-overlay` keeps `aria-live="polite"`; `.battle-error` keeps `role="alert"`.
- **Keyboard shortcuts:** the global `tacticalShortcut` handler is unchanged; the help overlay (`#tactical-key-reference`) remains reachable via the `.ja2-context` help button and the `H` key. Shortcuts suspend while editing/conversing (existing logic).
- **Right-click entry:** MODE B must also be reachable without a mouse — the visible **Equipo** fallback button (Q2) and the existing `Equipo / órdenes` affordance cover keyboard-only users; `onContextMenu` is `preventDefault`-ed and mapped to the same open action.

---

## 8. Accepted Debt, Decisions, and Function-Preservation Map

### 8.1 Accepted debt (rendered, not functional)

| Item | Decision |
|---|---|
| Armor / helmet / pants / holster paper-doll positions | Render as **empty/disabled placeholders** — no backing data exists (only a boolean `poncho` flag exists in the unit model). |
| `.paper-readouts .armor` | Renders `—` (no armor stat in the rules). |
| `.paper-readouts .camo` | Renders `—` (no camo stat in the rules). |
| `LVL` (Nivel) | **Derived, display-only** `Grado`: `floor(statSum/100)` where statSum = the ten §4.3 stats. Zero gameplay effect. Q1 default — revisit if a real leveling system lands. |
| MODE B entry | **Q2 default:** right-click portrait **and** a visible **Equipo** fallback button (`.ja2-context`). Exit: right-click again **or** `.ja2-done`. |

### 8.2 Function-preservation mapping table

Every current function in `Battlefield.tsx` keeps a home. **Nothing is dropped.**

| # | Current function (Battlefield.tsx) | New home in the strip |
|---|---|---|
| 1 | Header eyebrow `OPERACIÓN TERRESTRE · DÍA/NOCHE · LLUVIA/CIELO DESPEJADO` | `.ja2-locale` (`.ja2-right`) |
| 2 | Header `h1` sector name | `.ja2-locale` |
| 3 | Turn indicator `Turno N · Ejército patriota` + `turn-dot` | `.ja2-locale` |
| 4 | Busy text `Procesando órdenes` / `Exploración libre` | `.ja2-locale` + end-turn button disabled state |
| 5 | Enemy count `N avistados` | `.ja2-locale` |
| 6 | `mobile-details` button | Replaced by **Equipo** fallback button (Q2) in `.ja2-context` |
| 7 | Mission objectives (`hud-mission` + `Concluir el encuentro`) | Popover via `.ja2-garrison-toggle` pattern (`.ja2-right`) |
| 8 | Help toggle (`tactical-help-toggle` + `#tactical-key-reference`) | Help button in `.ja2-context`; overlay re-anchored above `.ja2-strip` |
| 9 | Map caption mode hint + hover coordinates | `.ja2-locale` (hint + `A1`-style coords line) |
| 10 | Map caption `↑ NORTE` | Stays as field-top caption (field chrome) |
| 11 | Camera pan (← ↑ ↓ →) | `.ja2-radar` flanking controls (`.ja2-right`) |
| 12 | Camera center `◎` | `.ja2-radar` flanking controls |
| 13 | Camera zoom −/+ and % readout | `.ja2-radar` flanking controls |
| 14 | `TacticalScene` field | Unchanged, above the strip |
| 15 | `battle-error` alert | Unchanged field overlay |
| 16 | `battle-result` (victory/defeat, `Explorar el sector`, `Volver a la campaña`) | Unchanged field overlay |
| 17 | Inspector `details` panel | MODE B `.ja2-inventory` |
| 18 | `soldier-heading` (portrait, name, mounted/patriota) | `.ja2-inv-header` (+ Grado) |
| 19 | Salud / PA / Energía meters | `.ja2-stats` (MODE B) + `.ja2-vitals` (MODE A) |
| 20 | Carga / capacidad | `.paper-readouts .weight` |
| 21 | Weapon detail (name, icon, load state, ammo) | `.ja2-weapon-line` (MODE A) + `.hand-slot.primary`/`.hand-slot.blade` (MODE B) |
| 22 | Moral / Estado del mecanismo / Riesgo de chispa fallida / knocked-down | `.ja2-stats` |
| 23 | Aim control | `.ja2-order-grid` aim readout (keys unchanged) |
| 24 | Movement select (walk/run/crouch/prone) | `.ja2-stance-grid` movement row |
| 25 | Sight toggle (`showSight`) | `.ja2-stance-grid` action row |
| 26 | Loot mode (`Recoger equipo del suelo o un cuerpo`) | `.ja2-order-grid` |
| 27 | Torch (`Arrojar antorcha · N`) | `.ja2-stance-grid` action row |
| 28 | Bolas (`Lanzar boleadoras · N`) | `.ja2-stance-grid` action row |
| 29 | Free (`Liberarse de las boleadoras`) | `.ja2-stance-grid` action row (conditional) |
| 30 | Brace (`Calar bayoneta · reservar 16 PA`) | `.ja2-stance-grid` action row (conditional) |
| 31 | Repair (`Cambiar sílex · N PA`) | `.ja2-stance-grid` action row |
| 32 | Ration (`Tasajo y vendas · 10 PA`) | `.ja2-stance-grid` action row |
| 33 | Priming/flints/rations readout | `.pertrechos` |
| 34 | Artillery control (cannon select, munition select, Disparar/Desplazar/Girar/Recargar) | `.ja2-artillery` (`.ja2-context`, conditional) |
| 35 | `TrainingProgress` (Aprendizaje por práctica) | `.ja2-stats` collapsible (MODE B) |
| 36 | `RecoveredInventory` (equipLoot, Equipar principal/secundaria) | `.pertrechos` + `.slot-grid` `.slot-cell.equippable` (MODE B) |
| 37 | Combat log (`field-log` DIARIO DE COMBATE, last 5, `aria-live`) | `.ja2-log-overlay` (overlay above strip) |
| 38 | Retreat (`retreat-button`, `onRetreat`) | `.ja2-right` (Retirada) |
| 39 | Conversation notice (`talking` panel, approaches, `Acercarse para conversar`) | Overlay anchored above `.ja2-strip` (unchanged behavior) |
| 40 | Command bar: Mover / Disparar / Atacar / Cargar / Curar | `.ja2-order-grid` |
| 41 | Reload / reprime (`Cebar`) | `.ja2-order-grid` |
| 42 | Weapon switch (`Cambiar arma · 4`) | `.ja2-order-grid` |
| 43 | Stance quick toggle (`Cuerpo a tierra`/`De pie`) | `.ja2-order-grid` (quick) + `.ja2-stance-grid` (full) |
| 44 | Overwatch (`Cubrir`) | `.ja2-order-grid` |
| 45 | Mount (`Montar/Desmontar · N PA`) | `.ja2-order-grid` (conditional) |
| 46 | End turn (`Fin del turno` / `Descansar` / `Procesando…`) | `.ja2-context` end-turn button |
| 47 | Garrison: mission allies (`Oficiales aliados · N temporales`) | `.ja2-garrison-toggle` popover (`.ja2-right`) |
| 48 | Garrison: local militia (`Guarnición local · N milicianos`) | `.ja2-garrison-toggle` popover (`.ja2-right`) |
| 49 | Roster portrait cards (select, double-click → details) | `.ja2-roster` `.ja2-portrait-cell` (right-click → MODE B) |
| 50 | Empty roster slots | Empty `.ja2-portrait-cell` placeholders |
| 51 | `hud-selection` (selected name, mode label, `Equipo / órdenes` button) | `.ja2-locale` (name/mode) + **Equipo** fallback button (Q2) |
| 52 | `TacticalMinimap` + `onCenter` (click-to-center, arrow-key pan) | `.ja2-radar` (unchanged component) |
| 53 | Keyboard shortcuts (`TACTICAL_KEYS`, `tacticalShortcut`, `H`, `Esc`, `M`/`onMap`) | Unchanged global handler; help overlay above strip; `onMap` stays a shortcut (optional `.line-button` in `.ja2-right`) |
| 54 | `selected` state / auto-select alive player | `.ja2-roster` cell states (`.active`/`.fallen`) |

### 8.3 Verification contract

- CSS task styles **only** the §5 class list, using **only** §2 tokens/primitives.
- Component task uses the §5 classes verbatim and preserves every row of §8.2.
- Visual QA: MODE A at 375/768/1280px (roster, context, right cluster, overlays), MODE B open via right-click and via Equipo button, `.active`/`.fallen`/`.equippable`/`.hand-slot.active` states, focus-visible, and `prefers-reduced-motion`.