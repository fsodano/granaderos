"""Resolve the retained charcoal surface from the active hem's map bindings."""
import copy


def material_signature(doc, material, omit_colour=False):
    result = copy.deepcopy(material)
    result.pop('name', None)
    if omit_colour:
        result['pbrMetallicRoughness'].pop('baseColorTexture', None)

    def links(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                    texture = copy.deepcopy(doc['textures'][child['index']])
                    if 'source' in texture:
                        image = copy.deepcopy(doc['images'][texture['source']])
                        image.pop('name', None)
                        texture['source'] = image
                    if 'sampler' in texture:
                        texture['sampler'] = copy.deepcopy(doc['samplers'][texture['sampler']])
                    child['index'] = texture
                else:
                    links(child)
        elif isinstance(value, list):
            for child in value:
                links(child)
    links(result)
    return result


def retained_charcoal_material(doc, active_index):
    active = doc['materials'][active_index]
    assert active['name'] == 'Apparel_Atlas_Charcoal_Legwear_Rust_Hem'
    assert active['pbrMetallicRoughness']['baseColorTexture'].get('texCoord') == 1
    surface = material_signature(doc, active, omit_colour=True)
    selected = [i for i, value in enumerate(doc['materials'])
                if value.get('name') == 'Apparel_Atlas_Charcoal_Legwear'
                and value['pbrMetallicRoughness']['baseColorTexture'].get('texCoord', 0) == 0
                and material_signature(doc, value, omit_colour=True) == surface]
    assert selected, 'Missing retained charcoal material for the active hem surface'
    # Old inactive donors remain in the file. Equivalent index aliases are safe;
    # different colour resources with the same surface would be ambiguous.
    signature = material_signature(doc, doc['materials'][selected[0]])
    assert all(material_signature(doc, doc['materials'][i]) == signature for i in selected), 'Ambiguous retained charcoal resources for the active hem'
    return selected[0]
