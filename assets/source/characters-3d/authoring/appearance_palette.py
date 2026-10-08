"""Source-derived garment pigments, independent of mesh authoring and lighting."""

# Median fabric swatch in the retained full-body front identity reference.
# The illustrated image already contains shading; this is a palette anchor,
# not a measurement of an unlit physically based material.
WOMAN_SHAWL_SKIRT_SRGB = (49, 48, 49)


def srgb_byte_to_linear(value):
    value = value / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


WOMAN_SHAWL_SKIRT_LINEAR = tuple(map(srgb_byte_to_linear, WOMAN_SHAWL_SKIRT_SRGB))
WOMAN_SHAWL_BURGUNDY_LINEAR = (.105, .025, .035)
