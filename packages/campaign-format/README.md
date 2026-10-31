# Campaign format

This package owns the portable campaign-file contract. It imports neither the
game nor the campaign editor. Use direct module imports. Package exports expose
each module by its name.

[`CampaignDefinition`](campaign-definition.ts) admits the manifest and complete
published documents, checks their references, and owns immutable copies. The
editor can retain incomplete projects. Publication requires format admission and
the public game validation report.

| Published data                                                                    | Shared schema owner                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest, JSON limits, file paths, assets and identity                            | `campaign-manifest`, `campaign-data-validation`, `campaign-assets`, `content-identity`                                                                                                                                                  |
| Characters, equipment, placements and campaign settings                           | [`CampaignContentSchema`](content-schema.js), the character schemas, `force-equipment-schema`, `projectile-profile-schema`, `campaign-rules-schema`, `campaign-location-schema`, `ammunition-market-schema`, `artillery-profile-schema` |
| Dialogue, objectives, chapter conditions and timed events                         | `dialogue-schema`, `quest-schema`, `errand-schema`, `story-schema`, `event-schema`, `roadside-discovery-schema`                                                                                                                         |
| World grid, localities, districts, roads and configured sources                   | [`world-schema`](world-schema.js), `enemy-strategy-schema`, `merchant-policy-schema`, `physical-schema`                                                                                                                                 |
| Map records, identities, rooms, containers, wall edges and upper-floor references | [`map-schema`](map-schema.js), `tactical-space-schema`, `environment-record-schema`, `cover-metadata-schema`                                                                                                                            |
| Presentation, portraits, introductions and character-creation references          | [`presentation-schema`](presentation-schema.js), `officer-creation-schema`                                                                                                                                                              |

File admission preserves the existing versioned values and diagnostics. It checks
that referenced characters, equipment, locations, maps, dialogue passages and
quest records exist. Shared coordinate helpers describe serialized map records;
they do not run movement or combat.

The game compiler applies runtime rules after file admission. It checks supported
weapon, projectile and sprite capabilities; concrete equipment and fittings;
physical item behavior; compiled map access and geometry; actual escort paths;
historical scenario compatibility; and valid campaign setup. Runtime chapter
progress, event receipts, enemy actions, dialogue effects, and mutable game
progress stay in the game. A valid file does not prove that every objective can
be completed.

Existing game validation entry points delegate to these shared schemas. They add
runtime checks where required. This keeps current import contracts usable without
maintaining another copy of the file rules.

From the repository root, run `npm --prefix packages/campaign-format run test`
for contract tests and
`npm --prefix packages/campaign-format run build` for syntax and dependency checks.
