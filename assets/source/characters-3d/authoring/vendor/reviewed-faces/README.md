# Reviewed face source assets

These 24 LOD-specific source assets contain only the reviewed native head/neck, eyes, eyebrows and hair. They are applied after the current appearance export. They contain no costume, hat, hand, boot or animation geometry. The source assets retain the reviewed native skeleton solely to validate their bind and hierarchy against the destination.

The compositor removes complete connected head components from the destination and appends the reviewed face components. It keeps the destination rig, sockets, all other geometry/accessors, original hand Skin material, clothing materials and morph targets. Face_Skin uses role `skin` and `facialSurface: true`; it is independent of the unchanged hand Skin material. Unknown rig signatures and partial component selections are errors.

## Origin and rights

The adult base anatomy, native targets and underlying clean skin maps are MakeHuman Community/MPFB assets under CC0-1.0. See `makehuman-source-manifest.json`, `makehuman-LICENSE.ASSETS.md` and `makehuman-LICENSE.md` for upstream paths, hashes and license text. No MPFB Python add-on code is included in this face package.

The Granadero and Worker facial albedo share one generated image. Worker therefore shares its broad brow/stubble traits; it is not a separate new facial identity. The original PNG and prompt/receipt are in `../../generated/granadero-skin-*`. The Worker cutout hair uses the original transparent `../../generated/hair-strands-v1.png` and adjacent prompt/receipt. No raster pixels were edited during this extraction. The generation receipts describe when the image was made; the extraction manifest records which reviewed model was accepted later.

Native normal/roughness textures and the other six facial albedos retain their reviewed UV0. The generated facial albedo uses bounded UV1 registration already stored in the source geometry. All image bytes are retained exactly and content-addressed in `textures/`.

## Rebuild contract

`accepted_faces.py` applies these sources only to appearance exports. It never runs on animation banks, equipment, horse or garment libraries. The package manifest records each donor hash, extracted source hash and texture hash. Rebuilding with the same main appearance export and reviewed source gives the same composed body bytes. This is a bounded accepted art-source snapshot, not an assertion that every face has reached the final visual target.
