"""Run frozen family formulae with verified split-poncho selection lineage.

Only the two bounded normal-only Gaucho corrections may use this adapter.
Their original connected drape mask is computed by the unchanged recipe on the
exact restored native body. Every split corner then maps to the same original
position, UV, colour, weights and material. Unrelated disconnected cloth still
uses the frozen selector and fails its existing topology checks.
"""
from pathlib import Path
import copy
import json
import sys
from family_surface_context import _asset_path,_module,_sha

FIELD='coarseGarmentSurface'


def _selection_rows(root,original):
    root=Path(root).resolve();assets=root/'web/public/models/characters';manifest=json.loads((assets/'manifest.json').read_bytes())
    correction=_module('family_selection_correction',root/'tools/characters-3d/build-coarse-garment-surfaces.py')
    family=_module('family_selection_frozen',root/'tools/characters-3d/build-family-cloth-depth.py')
    glb=_module('family_selection_glb',root/'tools/characters-3d/merge-animation-bank.py');views=[]
    for record in manifest['appearances']['gaucho']['lods']:
        if FIELD not in record:continue
        assert record['lod'] in (1,2) and record[FIELD]['preset']=='gaucho' and record[FIELD]['role']=='poncho', 'Unowned split-drape selection context'
        path=_asset_path(assets,record['url']);raw=path.read_bytes();assert _sha(raw)==record['sha256'] and len(raw)==record['bytes'], 'Selection body differs from manifest'
        assert 'apparelSurface' not in record, 'Verify and unwrap apparel before frozen family selection'
        doc,binary=glb.read_glb(path);native_record=copy.deepcopy(record)
        if 'familyClothDepth' in record:
            doc,binary=family.restore_body(doc,binary,record['familyClothDepth']);native_record=family.restore_record(record)
        correction._verify_native(doc,binary,native_record,correction.recipe_for(root),root)
        meta=native_record[FIELD];old_doc,old_binary=correction.restore_body(doc,binary,meta)
        mesh,primitive=correction.primitive_for(doc,record['lod']);old_primitive=old_doc['meshes'][mesh]['primitives'][0]
        data={key:correction.rows(doc,binary,index) for key,index in primitive['attributes'].items()}
        old_data={key:correction.rows(old_doc,old_binary,index) for key,index in old_primitive['attributes'].items()}
        old_triangles=correction.triangles(old_doc,old_binary,old_primitive);new_triangles=correction.triangles(doc,binary,primitive)
        old_indices=[vertex for triangle in old_triangles for vertex in triangle]
        drape,protected=original('gaucho','outfit',old_data['POSITION'],old_indices,old_data['TEXCOORD_0'],None)
        assert not protected and max(old_data['POSITION'][index][1] for index in drape)>1.45
        assert primitive['material']==old_primitive['material'], 'Split drape changes original material role'
        mapped={};selected=set(drape)
        for old_index,new_index in zip(meta['primitive']['oldOwnedTriangles'],meta['primitive']['ownedTriangles']):
            for old_vertex,new_vertex in zip(old_triangles[old_index],new_triangles[new_index]):
                assert old_vertex in drape, 'Owned poncho corner is outside the original hanging drape'
                assert new_vertex not in mapped or mapped[new_vertex]==old_vertex, 'Ambiguous split drape correspondence'
                for semantic in ('POSITION','TEXCOORD_0','COLOR_0','JOINTS_0','WEIGHTS_0'):
                    assert data[semantic][new_vertex]==old_data[semantic][old_vertex], 'Split corner changes retained drape data'
                mapped[new_vertex]=old_vertex;selected.add(new_vertex)
        active={vertex for index in meta['primitive']['ownedTriangles'] for vertex in new_triangles[index]}
        assert set(mapped)==active and all(abs(data['POSITION'][vertex][1]-.89)>=.002 or vertex in selected for vertex in active), 'Missing active hem corner in verified drape selection'
        indices=[vertex for triangle in new_triangles for vertex in triangle]
        views.append((data['POSITION'],indices,data['TEXCOORD_0'],selected))
    return views


def installer_for(root):
    """Return the unchanged installer with one explicit checked selector hook."""
    root=Path(root).resolve();installer=_module('verified_family_installer',root/'tools/characters-3d/build-family-cloth-depth.py')
    loader=installer.module
    def module(name,path):
        source=loader(name,path)
        if name=='family_cloth_recipe':
            original=source.selections;views=_selection_rows(root,original)
            def selections(preset,part,positions,indices,uvs,hem=None):
                if preset=='gaucho' and part=='outfit':
                    matches=[selected for expected_positions,expected_indices,expected_uvs,selected in views
                             if positions==expected_positions and indices==expected_indices and uvs==expected_uvs]
                    assert len(matches)<=1, 'Ambiguous verified poncho selection view'
                    if matches:return set(matches[0]),set()
                return original(preset,part,positions,indices,uvs,hem)
            source.selections=selections
        return source
    installer.module=module;return installer


def verify_completed(root,presets,*,allow_stale_donor=False):
    return installer_for(root).verify_completed(root,presets,allow_stale_donor=allow_stale_donor)


def main(argv=None):
    arguments=list(sys.argv[1:] if argv is None else argv)
    root=Path(arguments[arguments.index('--root')+1]) if '--root' in arguments else Path(__file__).resolve().parents[2]
    installer=installer_for(root);previous=sys.argv
    try:
        sys.argv=[str(root/'tools/characters-3d/build-family-cloth-depth.py'),*arguments];installer.main()
    finally:sys.argv=previous


if __name__=='__main__':main()
