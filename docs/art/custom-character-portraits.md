# Custom-character portraits

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

Run `node tools/audit-portrait-balance.mjs` to check all 36 combinations, detect duplicate files, check both production copies, and make 12 review sheets in `assets/previews/portrait-balance`. Legacy portrait 103 retains a 1254-pixel source PNG in `assets/web` and its existing 384-pixel game copy; all other selectable images have identical copies. Each sheet has five portraits per row and one row per skin tone. The full counts and portrait IDs are saved in `docs/evidence/portrait-balance-2026-09-27.json`.

Portrait categories are authored metadata in `game/character-portraits.js`. Skin tone is a visual category, separate from ancestry, ability and gameplay role. Legacy portrait categories come from their art prompts; legacy tactical palettes remain compatible with existing saves.

## Balanced 180-portrait verification — 2026-09-27

- The full audit passed: 36 combinations with five portraits each; 90 per gender, 30 per role, and 60 per skin tone. All 180 selectable image files have different checksums. The original 64 IDs and all 122 additions remain valid for saves.
- All 122 new sources and their production copies passed visual review. All 12 final review sheets were inspected, including the retained portraits. Faces within each five-choice row are distinguishable; similar age-based face archetypes recur across roles.
- All 229 focused portrait, profile, artwork, sprite and save/load tests passed. These cover every one of the 186 supported IDs through creation, campaign and tactical saves, deployment, sector return and both roster displays. Mounted chooser tests reach every selectable portrait and preserve the gameplay profile.
- Typecheck and the production build passed. The export contains 1098 files and 992 checked asset references.
- A separate production-preview browser tab checked every gender and role: all 12 selections rendered three groups of five and loaded all 180 images. Selecting `avatar-man-medic-dark-3` updated the selected marker and loaded the correct 384-pixel preview. The test tab recorded no console errors. At 390 pixels wide, the page had no horizontal overflow and retained all three five-choice groups. The user's existing tab was preserved.

## Previous 64-portrait verification — 2026-09-27

- All 105 portrait, profile, sprite-appearance, sprite-skin and artwork-integrity tests passed. Coverage includes all 64 faces through creation, campaign and tactical saves, deployment, sector return and both roster displays. All 12 additions also retain their expected sprite family and palette.
- Mounted UI checks passed for the gender-first flow, disabled role step, skin-tone grouping, group reset and character-field preservation.
- Typecheck and the production build passed. The export contains 975 files and 870 checked asset references, including every custom portrait.
- Browser review confirmed the sequential chooser, a 390-pixel-wide layout without horizontal overflow, and loaded portrait images in the production export. Selecting the new Black woman medic updated the enlarged preview and selected marker.
- All 12 new source images and their production-size copies were visually reviewed. The preview sheet is `assets/previews/custom-black-portraits.webp`: men on the top row and women below; columns show soldiers, officers, scouts, gauchos, artisans and medics.

Run the focused checks with:

```sh
node --test tests/custom-portraits.test.mjs tests/custom-portrait-appearance.test.mjs tests/custom-portrait-assets.test.mjs tests/portrait-catalog.test.mjs tests/character-profile.test.mjs tests/mercenary-portraits.test.mjs tests/sprite-appearances.test.mjs tests/illustrated-sprite-runtime.test.mjs tests/sprite-skin.test.mjs
npm run typecheck
npm run build
```

## Previous 52-portrait verification — 2026-09-27

The portrait-only change was verified in an isolated worktree based on `eb39ef7`:

```sh
node --test tests/custom-portraits.test.mjs tests/custom-portrait-appearance.test.mjs tests/character-profile.test.mjs tests/mercenary-portraits.test.mjs
# 68 passed
node --test tests/illustrated-sprite-runtime.test.mjs tests/sprite-appearances.test.mjs tests/sprite-skin.test.mjs
# 19 passed
npm run typecheck
npm run build
```

The build verified 960 exported files and 856 asset references. The shared working checkout also passed the 68 portrait/profile tests, typecheck and production build (962 files, 858 asset references). Its other gameplay changes are outside this commit.

Browser review of the shared production build confirmed the 52-choice gallery, selections at both ends of the list, enlarged previews, successful creation with portrait 147, and the same portrait in the character dossier after reloading and continuing the campaign. No browser console errors were recorded. The player's open campaign was left in place.

The commit excludes the shared checkout's separate changes to attribute minimums and range controls. It does not change story content, campaign progression or story-editor modules.
