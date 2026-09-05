# Fictional player portraits

Four original player identities were generated with the built-in image generator,
using separate prompts and no reference face or historical portrait input.
They are fictional depictions in clothing inspired by the Río de la Plata circa
1812, not authenticated depictions of real people. They do not reuse the named
operative portraits. Their clothing is cosmetic and does not restrict classes.

- `avatar-woman-scout.webp`: woman with braid, indigo coat and red scarf.
- `avatar-woman-civilian.webp`: woman with pinned hair, linen and brown shawl.
- `avatar-man-gaucho.webp`: man with mustache and woven poncho.
- `avatar-man-soldier.webp`: man with sideburns and navy/red military coat.

All four are square 384px WebP files installed in `web/public/art`, totalling
about 53KB. Full originals remain in `assets/source/{id}-v1.png`; exact prompts
and generator output source paths are recorded in `prompts/custom-avatars.json`.
Rebuild with `python3 assets/build_avatars.py`. Once originals are copied into
the repository, rebuilding does not require the original generator cache.

Each generated portrait was visually inspected for a distinct readable face,
intact head, period-inspired clothing, matching painterly treatment and absence
of text. The output manifest records dimensions, byte counts and SHA-256 hashes.
