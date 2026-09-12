# Optional orders panel

The roster's native `Órdenes` details element now mounts its contents only when
its `toggle` event reports an open state. Closing it unmounts the contents.
The browser still controls summary activation, keyboard access and focus.
Selection and battle updates pass current values to the open panel. Entering
inventory unmounts the menu; returning to the roster starts with a closed menu.

The extracted `JA2OrdersPanel` retains the existing controls and read models.
Its order descriptors, medical/item/supply/artillery previews, equipment slots,
hands, hearing readout and help text no longer run behind a closed menu or before
the strip returns the inventory view. The six-person roster, essential controls,
inventory and Battlefield keyboard handlers keep their existing behavior.

## Verification

- `lazy-orders-render.test.mjs` counts calls at the real read-model entry points.
  Closed menus make zero optional calls, including with a selected target and
  artillery. Inventory builds its own order model once. The tests also check six
  portraits, essential controls, native details structure, current selection,
  changed equipment, targets, and a real paid reload through the panel callback.
- Existing control and artillery render tests now inspect the mounted production
  panel for its controls. Inventory and roster checks still render the full strip.
- A separate comparison against commit `7ed0c22` found exact panel markup equality
  for primary, medical, supply and unarmed equipment, each available and busy.
  Inventory markup was also identical.

Production-mode server-render measurement on 2026-09-12 used the same generated
Tucumán fixture: 3,072 tiles, 20 buildings, 27 props and six mercenaries. After ten
warmups, 60 renders gave these results:

| Closed roster measure | Before | After |
| --- | ---: | ---: |
| Median render time | 11.51 ms | 10.93 ms |
| Order descriptor calls | 1 | 0 |
| Medical preview calls | 1 | 0 |
| Supply preview calls | 3 | 0 |
| Hearing model calls | 1 | 0 |
| Equipment slot calls | 2 | 0 |
| Equipped help calls | 1 | 0 |
| Hand model calls | 1 | 0 |

Inventory order/medical/supply calls dropped from 2/2/6 to 1/1/3. Inventory timings
were noisy and do not establish a speed improvement. These are server-render
measurements, not browser frame measurements. Live opening, closing, keyboard
activation, selection, reopening after inventory, and reload checks remain part
of integration verification.
