# Room visibility lookup performance

Measured on 12 September 2026 with Node 25.9.0, macOS arm64 and production
React. These are local server-render CPU timings, not browser frame rates.
They do not establish that all action stalls or memory problems are fixed.

The full Buenos Aires minimap asks whether each of its 3,072 ground cells is
inside a revealed room. The previous lookup scanned all room cells and created
two temporary objects for every comparison. CPU profiles identified that scan
as the largest repeated cost in this fixture. The selected soldier's full
reachable-route query separately took about 28 ms and remains unchanged.

The new index maps physical cells to the first matching room. It also indexes
room IDs and their physical levels. It retains room ordering, inherited ground
levels, explicit upper levels and rounded actor positions. The visibility
decision still reads the current tile, object tag and revealed-room set.

Each index belongs to a weakly held simulation snapshot. Replacing the snapshot,
building or room arrays, changing their ordered members, or replacing/resizing
a room's cells invalidates the index. Room IDs and default physical levels are
also checked. In-place edits to individual cell coordinates or levels require
a fresh snapshot or cells array; runtime room topology follows this contract.
Door and breach changes continue through the ordinary reducer and current tiles.

## Controlled render comparison

The baseline source is `74cb625`; the final implementation starts from
`5df4e86`, which has the same rendering and visibility source. The fixture uses
initial campaign seed 8, six paid day hires (128, 142, 123, 115, 131, 110), an
ordinary Buenos Aires attack and sector entry. It contains 3,072 ground tiles,
125 upper cells, 20 buildings, 12 units and one light.

Each separate process renders the initial state and twelve ordinary ambient
snapshots through the actual `Battlefield`, with its default 960 × 540 field
size and 200% camera. There are three warmup renders and thirteen measured
renders per lighting case. The same inputs are rendered with day and night
lighting. Timers surround existing memo computations; a V8 CPU profiler is
enabled for the measured loop. Final timings include index validation overhead.

Median milliseconds:

| Work | Day, before → after | Night, before → after |
|---|---:|---:|
| Minimap terrain computation | 137.12 → 2.27 | 138.16 → 1.89 |
| Complete server render | 198.20 → 52.09 | 199.21 → 51.14 |

All 26 complete HTML hashes match. These ambient snapshots move unseen patrols;
their visible HTML remains stable within each lighting case. Separate behavioral
tests cover changing room membership, same-array reordering, doors, breaches,
roof disclosure, and all actual Buenos Aires/Tucumán ground and upper cells
against the original uncached scan. No artwork or minimap geometry changes.

[Timing samples and complete output hashes](evidence/room-visibility/benchmark.json)
record the fixture and measurement settings. React serialization, profiling,
JIT and garbage collection affect these figures. Browser DOM, paint, animation
updates and long-session retained memory require separate validation.
