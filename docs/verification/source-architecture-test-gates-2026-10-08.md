# Source architecture test gates

The three remaining pre-clothing failures used broad assertions from before
accepted source architecture changes. These corrections change only tests.

The forge chimney test used generic shaft and cap heights. It now reads the
current sprite's brick shaft, cap height and colour. Flat roofs remove the
source pitched-roof rise. The shaft must still enter the real roof, and the
flue must sit above its cap. Chapel and domestic chimney checks remain.

The civic tower now has a nested cupola group. The old test read a material
from every direct child and failed on that group. It now checks every actual
mesh, including the cupola, requires geometry and the retained source crown,
and still forbids the parish stone footing on the civic tower.

The pulpería plaque now uses the current sprite's board and bracket. Its
height differs from the old generic sign. The test checks source proportions,
the board's height below its own bracket, actual bracket contact with the
porch beam, and every sign vertex over an intact support wall cell. Doorway,
roof route, hatch and room-disclosure checks remain.

The [source and cause receipt](source-architecture-test-gates-2026-10-08.json)
records the three original failures and the private 13-test pass on `9002e91c`.
The integration selection combines those tests with the 16
[native climb and mount checks](native-climb-mount-gates-2026-10-08.md) on the
merged clothing main `5f65ef08`.
All 29 affected checks pass locally in about 4.3 seconds. The retained
architecture, gameplay and animation-bank hashes remain exact; PR #289's
expected body-manifest update is the only change to those source pins.

```sh
node --test tests/three-authored-flat-roofs.test.mjs \
  tests/three-church-tower-foot.test.mjs \
  tests/three-porch-placement.test.mjs
```

The full quick suite is not repeated for this bounded test-only change.
There are no new architecture, lighting, model or motion changes.
