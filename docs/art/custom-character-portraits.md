# Custom-character portraits

This guide covers the 180-portrait character creator catalog (186 save-compatible portrait IDs in total), its save and sprite-mapping contract, and artwork build scripts. Code paths such as `game/`, `web/`, and `assets/` refer to the pre-monorepo layout (`packages/game/`, `apps/web/`, and `content/assets/` in the current repository).

The character creator offers 180 faces: five portraits for each combination of two genders, six visual roles, and three skin tones. Every gender and role shows 15 choices, arranged as five Clara, five Morena, and five Oscura portraits. The roles are soldier, officer, scout, gaucho, artisan and medic.

The original 64 portrait IDs remain valid. The balanced chooser retains 58 of these faces and adds 122 individually generated portraits. Six surplus faces remain available to their paid recruit owners and to existing saved custom characters. They are excluded from new chooser selections so every group contains exactly five faces. The complete save-compatible catalog therefore contains 186 portraits.

The chooser asks for gender first, then a portrait type. It then shows the matching faces in skin-tone groups (Clara, Morena, Oscura). The role describes the portrait's clothing and appearance. It does not select the character's gameplay class. A larger selected-face preview stays visible while the player browses other groups. Portrait selection does not change the character's name, class, attributes, questionnaire answers, equipment or pay.

## Save and rendering contract

- Keep `profile.version = 2` and custom officer ID `1000`.
- Keep portrait IDs as strings: the four original `avatar-*` IDs, `"100"` through `"147"`, and the 12 `avatar-{man|woman}-black-{role}` IDs. The balancing expansion uses `avatar-{gender}-{role}-{skinTone}-{number}`. No old choice is renumbered or deleted.
- `CHARACTER_PORTRAITS` is the full save-compatible catalog. `SELECTABLE_CHARACTER_PORTRAITS` contains the 180 chooser entries. Portraits `104`, `113`, `143`, `100`, `106` and `108` are legacy-only choices; their image paths and paid recruit appearances are unchanged.
- Portraits 103 and 104 remain PNG; the other numeric portraits remain WebP. Each new portrait has its own generated source and a 384 × 384 WebP copy in both `assets/web` and `web/public/art`.
- A custom character with a numeric portrait uses the same sprite family and skin palette as that portrait's paid recruit. Saved explicit appearance and skin overrides retain precedence.
- The four original avatars keep their previous appearance. Old custom portrait 103 now uses its recruit's light skin palette instead of the previous custom-ID brown fallback.
- New portraits use explicit shared sprite families and skin palettes. The initial Black gaucho pair uses Morena; the other ten initial Black additions use Oscura. Each balancing portrait has an explicit palette matching its authored skin-tone group. Existing saved appearance and skin overrides retain precedence.
- These portraits survive campaign and tactical save/load, deployment, sector return and both roster displays. No save migration is required.

## Artwork sources

The new artwork was made with the built-in `image_gen` tool, using a separate call for each portrait. The initial 12 Black portrait prompts and sources are listed in `assets/prompts/custom-portraits.json`; rebuild these with `node tools/build-custom-portraits.mjs`.

The 122 balancing prompts, subject metadata and source paths are in `assets/prompts/balanced-portraits.json`. Rebuild their 384 × 384 WebP copies, checksum manifests and runtime metadata with `node tools/build-balanced-portraits.mjs`. Originals remain in `assets/source/balanced-avatar-*-v1.png`. The build fails before writing if any requested source is missing. The web build checks every catalog image, including dynamically constructed URLs.

Run `node tools/audit-portrait-balance.mjs` to check all 36 combinations, detect duplicate files, check both production copies, and make 12 review sheets in `assets/previews/portrait-balance`. Legacy portrait 103 retains a 1254-pixel source PNG in `assets/web` and its existing 384-pixel game copy; all other selectable images have identical copies. Each sheet has five portraits per row and one row per skin tone.

Portrait categories are authored metadata in `game/character-portraits.js`. Skin tone is a visual category, separate from ancestry, ability and gameplay role. Legacy portrait categories come from their art prompts; legacy tactical palettes remain compatible with existing saves.

The 12 initial Black portraits are previewed in
`assets/previews/custom-black-portraits.webp`: men on the top row and women
below; columns show soldiers, officers, scouts, gauchos, artisans and medics.

Run the portrait checks with:

```sh
node --test tests/custom-portraits.test.mjs tests/custom-portrait-appearance.test.mjs tests/custom-portrait-assets.test.mjs tests/portrait-catalog.test.mjs tests/character-profile.test.mjs tests/mercenary-portraits.test.mjs tests/sprite-appearances.test.mjs tests/illustrated-sprite-runtime.test.mjs tests/sprite-skin.test.mjs
npm run typecheck
npm run build
```

These checks cover every supported portrait ID through creation, campaign and
tactical saves, deployment, sector return and both roster displays. They also
cover the gender-first chooser flow, the disabled role step, skin-tone grouping,
group reset and character-field preservation.
