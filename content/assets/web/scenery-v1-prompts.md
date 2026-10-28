# Original scenery sprites, version 1

Generated with the built-in imagegen tool on 2026-09-05. Original art, not extracted from Jagged Alliance assets. The supplied screenshot was inspected for camera/material/style context only and was not used as a compositing source.

Final generation prompt:

> Create an ORIGINAL game scenery spritesheet on a TRANSPARENT BACKGROUND, actual alpha transparency, six isolated cutouts. Large generous EMPTY transparent outer margins. 2columns3rows equal-sized cells. ALL SIX objects same maximum bounding box size350x350 so the trees are miniatures. Image1024x1536, eachcell512x512, objectsmustfit completely within cells. ROW1 small broadleaf scrub tree / small slender poplar tree. ROW2 dense shrub / grayrockcluster. ROW3 wooden barrelpair / haystack. Argentina1812 scenery. Realistic crisp natural raster textures with muted olivebrown colors, late1990s isometric tacticalgame sprite quality, original design not copied. Orthographic2:1 isometric downward view, lighting upperleft. Everyobjectmustfloatisolated on actual transparent PNG alpha with no platformground, no backgroundcolor, no checkerboardpattern, no text, no shadowcast. No outerclipping, allfoliage andtwigs fullyvisible withwidepadding. Very important: return actual transparent alpha—not an image of a checkerboard. Six isolated transparent game sprites with at least80pixels clearance between objects.

The first generation had genuine alpha but uneven oversized trees. Two layout/extraction edits incorrectly produced opaque checkerboard images; those were rejected and are not runtime assets. The final fresh generation produced RGBA with 1,065,966 fully transparent source pixels and alpha extrema 0–254.

Preparation is cropping/padding only, with no recoloring, background synthesis, alpha replacement or image redraw. Bounding boxes use alpha>16 plus eight pixels of safety margin to exclude remote nearly invisible alpha noise. Original alpha inside each crop is preserved byte-for-byte in lossless WebP exports. No sprite is scaled during export. `scenery-source-v1.png` preserves the complete generated original; `scenery-atlas-v1.png` repacks the six sprites into equal 512×640 cells. `scenery-v1.json` records source crop and content box coordinates.

Runtime filenames: scenery-tree-v1.webp, scenery-poplar-v1.webp, scenery-shrub-v1.webp, scenery-rocks-v1.webp, scenery-barrels-v1.webp, scenery-hay-v1.webp. Copies reside in web/public/art. All images are 512×640 with a common nominal ground anchor [0.5,0.9], pixel [256,576]. Content bottoms include eight pixels of transparent edge safety, so visible ground contact is approximately y568. Use the metadata content boxes when tuning apparent size; the tree is broader and shorter than the poplar by design.

These are natural textured raster sprites with a downward orthographic view; final perceived camera matching should be checked in the renderer at actual tactical scale.
