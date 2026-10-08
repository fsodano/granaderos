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

# The retained full-body image has a narrow rust stripe above the skirt edge.
# These values anchor the shaded illustrated colour and apparent dimensions.
WOMAN_SHAWL_HEM_SRGB = (105, 50, 40)
WOMAN_SHAWL_HEM_IMAGE_SIZE = (32, 256)
WOMAN_SHAWL_HEM_IMAGE_ROWS = (231, 236)
WOMAN_SHAWL_SKIRT_REST_HEIGHT = (.10, 1.06)
WOMAN_SHAWL_HEM_CENTRE_INSET = 16 / 367 * 1.76
# Reviewed native close sewn shell after optimization and thickness export.
WOMAN_SHAWL_SEWN_SKIRT_VERTEX_COUNT = 675


def woman_shawl_hem_uv(height, sewn=True):
    # Trousers use a fixed charcoal point, independent of their posed height.
    if not sewn:
        return (.5, .25)
    bottom, top = WOMAN_SHAWL_SKIRT_REST_HEIGHT
    ratio = max(0, min(1, (top - height) / (top - bottom)))
    rows = WOMAN_SHAWL_HEM_IMAGE_ROWS
    centre_pixel = (rows[0] + rows[1]) / 2
    span = WOMAN_SHAWL_HEM_IMAGE_SIZE[1] - 4
    offset = centre_pixel - (top - bottom - WOMAN_SHAWL_HEM_CENTRE_INSET) / (top - bottom) * span
    return (.5, (offset + ratio * span) /
            WOMAN_SHAWL_HEM_IMAGE_SIZE[1])


def woman_shawl_sewn_skirt_vertices(positions, indices):
    """Locate the retained indexed sewn shell from its authored bottom edge.

    The source Long_Skirt is one connected surface after its thickness pass.
    Native trousers are separate indexed surfaces. Reject a joined underlayer
    or missing authored hem rather than colouring an ambiguous component.
    """
    bottom, top = WOMAN_SHAWL_SKIRT_REST_HEIGHT
    adjacent = [set() for _ in positions]
    assert len(indices) % 3 == 0
    for offset in range(0, len(indices), 3):
        a, b, c = (int(value) for value in indices[offset:offset + 3])
        for u, v in ((a, b), (b, c), (c, a)):
            adjacent[u].add(v)
            adjacent[v].add(u)
    seeds = {i for i, point in enumerate(positions) if abs(point[1] - bottom) < .002}
    assert seeds, 'Missing authored Long_Skirt bottom edge'
    shell = {next(iter(seeds))}
    pending = list(shell)
    while pending:
        for neighbour in adjacent[pending.pop()]:
            if neighbour not in shell:
                shell.add(neighbour)
                pending.append(neighbour)
    assert seeds <= shell, 'Authored skirt hem has multiple indexed shells'
    assert len(shell) == WOMAN_SHAWL_SEWN_SKIRT_VERTEX_COUNT, 'Changed or joined reviewed Long_Skirt topology'
    assert len(shell) < len(positions), 'Missing separate native trouser boundary'
    assert abs(max(positions[i][1] for i in shell) - top) < .002
    assert min(positions[i][1] for i in shell) > bottom - .002
    assert all(positions[i][1] > bottom + .003 for i in range(len(positions)) if i not in shell)
    return shell
