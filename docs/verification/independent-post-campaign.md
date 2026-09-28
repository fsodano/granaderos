# Independent post campaign

Source: `2ed9f7ac0eb2b20a2d52a9b4a4b4667699b930b1`.
[Recorded route](../evidence/independent-post-campaign-2026-09-28.json).
[Player and author guide](../development/example-post-campaign.md).

**La ruta de las postas** is a complete compact authored scenario: ten new paid
identities, three world contacts, three chapters, local dialogue, a seven-day
objective and distinct victory/defeat text. Its package uses the existing authoring
schema. No special campaign identifier or scenario logic was added to the engine.
It reuses the stock geography, opposition, equipment families and bundled images.

The editor loads the package with one control, selects its first character,
clears the character search and sets the verified seed 8. Loading can be undone;
started campaigns retain their own pinned content. The same JSON is downloadable
and passes ordinary import/export validation.

## Acceptance

`tests/post-campaign.test.mjs` runs from a fresh imported package, an empty force,
6,000 pesos and Córdoba as the only controlled locality. Six week contracts are
paid and arrive after six hours. Actual local dialogue accepts the assignment.
Two real battles liberate Tucumán and Salta, with every order replayed through
campaign time and a midpoint save. Units, civilians, RNG and elapsed time agree.

After Tucumán, the force fortifies the locality, pays for two controlled replacement
arrivals, returns to the Córdoba workshop, uses finite dressings in a real visit,
pays replenishment and returns to the front. Three soldiers die permanently over
the route. Both local contacts confirm their reopened post and issue one reward.
The squad returns to Inés; her final reward and the settled scene yield the authored
ending at hour 84, second 130, with 6,566 pesos and five survivors. There is no
historical roster, officer injection, granted battle result or state patch.

A further 24 hours and sector re-entry retain victory, the three deaths and the
single ending log. A separate fresh accepted assignment waits out its real
168-hour deadline and saves the authored defeat instead of a false success.
A later external draft edit cannot change a pinned campaign.

The mounted editor test loads the example, undoes/redoes the draft replacement,
edits a character name, checks the preset seed, launches, pays a real hire, waits
for arrival and enters the Córdoba encounter with the authored name and fourteen
cartridges. This exercises the actual campaign/save path and the separate
[cartridge-admission correction](authored-cartridge-save.md).

Release checks: **810/810 tests**, zero failures or skips (192,882 ms); type
check; production export (722 files, 632 asset references, including the package);
36 baseline checks; documentation audit (206 requirements, all 50 original and
87 parity rows, 45 evidence records). [PR #68](https://github.com/fsodano/granaderos/pull/68)
merged after [CI](https://github.com/fsodano/granaderos/actions/runs/36416617388/job/108909164560)
passed at `000a91ba63b9910ad892263c23474afd120dba0b`.

## Limits

This accepts one complete three-chapter scenario and one seed/strategy, not every
possible authored campaign or force. A preliminary controller run using the
editor's former default seed lost at Tucumán; that seed/strategy is not accepted
as a winning route. The example control deliberately selects the verified seed 8.
This does not establish universal balance or make defeat impossible.

Geography, enemy command, strategic diplomacy and equipment mechanics still use
the published game. The richer advanced care, rescue, custody and tactical systems
remain separate integration work. This is simulation, replay, save and mounted-DOM
acceptance; it does not establish live-browser usability or sustained frame rate.
