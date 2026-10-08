# AI recovery of usable firearms

This is a small T07 admission correction after [serviceable cartridge handovers](ai-serviceable-cartridge-sharing.md). It uses the existing [firearm serviceability rule](firearm-serviceability.md) and [paid recovery path](../gameplay/tactical/ai-scavenging.md). It does not complete the full AI parity requirement.

The old search considered a loaded, unjammed source usable even at condition zero. A real enemy turn spent 8 internal AP picking up a broken ground or dropped gun, then left it in the pack without a shot. A broken loaded held gun also blocked recovery of a healthy source. An empty broken-only held gun picked up a cartridge it could not load.

The search now checks `firearmServiceable` for both the held gun and each actual recovered gun. Ground and dropped views use the source record's condition, with the existing helper default of 100 when the field is absent. A body view uses that body's primary gun condition. A broken held load, ignition fault or unusable reserve does not block recovery of a healthy source. Broken-only primary ammunition demand is rejected.

A measured useful legacy route remains: a broken empty primary pistol, a healthy empty held secondary of the same selected family, one visible pistol cartridge and 46 internal AP. Ordinary pickup spends 8 AP, secondary-only loading spends 28, hand swap spends 4 and firing spends 6. The primary broken item remains exact in the other hand; the healthy gun wears 100→99 and its one charge is consumed. This correction preserves that route without adding cross-family secondary searches or packed-gun ammunition demand.

The five actual before/current turns retain exact input and validated saved replay:

- Healthy ground pistol: identical pickup, equip and shot; AP20→0 and target HP100→36.
- Broken ground or dropped pistol: old AP20→12 after a useless pickup; current AP stays20 and the gun remains at its source.
- Broken loaded held gun beside a healthy pistol: old action was null with20AP unused; current pays pickup8+equip6+shot6, keeps the displaced broken load and identity, and damages the target.
- Empty broken-only held gun beside a cartridge: old AP20→12 and cartridge moved unused; current retains20AP and the finite source cartridge.

The existing plans retain identity, fitted bayonets, authored definitions, selected load, partial work and real capacity. The source and the displaced gun keep their own records. Observation, body-search distance, approach budget, exposure, stable scoring, current queue, reaction and saved interruption paths are unchanged. Positive-condition source/held cases are compared against the predecessor, including full real turn results.

A missing condition on a current dropped-weapon snapshot is invalid under the unchanged save validator. Its default is only a direct search-helper fallback. Ground records may omit it; legacy body records are normalized to100 by the existing validator. The correction does not relax these save rules or make a broken item disappear. Player pickup, repair and other ownership actions remain available through their existing authority.

Run the affected core checks:

```sh
node --test tests/tactical-ai-serviceable-scavenging.test.mjs tests/tactical-ai-scavenging.test.mjs tests/firearm-serviceability.test.mjs
```

Only `game/tactical-ai-scavenging.js` changes in production. The publication cut adds the focused test above and this note. It adds no action, cost, save field, reserve, source item, art asset or presentation change. Broader pack/secondary searches, specialist recovery and general AI parity remain separate work. The inherited search may pick up a healthy gun when only pickup+equip AP is available, while useful shot admission can defer the later equip; this correction does not redesign that scheduling policy.
