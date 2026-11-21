# Optional orders panel

The main campaign roster does not mount this panel. The behavior below applies
wherever the extracted `JA2OrdersPanel` is used.

During tactical exploration and turn-based combat, the roster's native `Órdenes` details element mounts its order, medical, supply, equipment, and artillery controls only when
its `toggle` event reports an open state. Closing it unmounts the contents.
The browser still controls summary activation, keyboard access and focus.
Selection and battle updates pass current values to the open panel. Entering
inventory unmounts the menu; returning to the roster starts with a closed menu.

The extracted `JA2OrdersPanel` retains the existing controls and read models.
Its order descriptors, medical/item/supply/artillery previews, equipment slots,
hands, hearing readout and help text do not run behind a closed menu or before
the strip returns the inventory view. The six-person roster, essential controls,
inventory and Battlefield keyboard handlers keep their existing behavior.

## Journal wording

Exploration spends no AP, so exploration reload, artillery reload, ready/look and
batch-pickup messages omit unspent AP; combat messages retain their paid costs. A
misfire in exploration asks for fresh priming without quoting a combat AP charge.
