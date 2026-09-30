# Shared battlefield light sources — 2026-09-26

`TacticalScene` now renders `TacticalLight` for the existing source records in
both campaign and standalone battles. Lanterns have an enclosure, candle and
support post. Thrown torches have a short wooden handle and a small flame;
campfires have crossed logs. These replace the identical floating ellipses.

The graphics do not change illumination range, line-of-sight blocking, supply
consumption, weather-dependent lifetime or campaign persistence. Daylight omits
the drawn halo. Extinguished sources retain hardware without flame or glow.
Burned-out finite sources are removed by the existing battle clock. No blur
filters, timers or animation loops were added. A supported source is not
silently moved onto a wall or given a different gameplay position.

## Verification

- Twelve focused tests passed: held supplies, rendering, expiry, extinguished
  sources and bounded rendering of forty fractional night movement frames.
- Type checking passed.
- The normal `localhost:3000/?qa=1` campaign was resumed, using its separate QA
  save key. The Retiro lantern was present as `data-light-source="lantern"` in
  the shared battlefield and visually inspected beside the building at 200%.
- The three graphics were also rendered together and visually reviewed.

This is a source-art improvement, not a loaded-scene 60 FPS acceptance result.
It does not add wall fittings, new lamp inventory items or electric/chemical
lights. Full campaign completion and remaining equipment artwork are still open.
