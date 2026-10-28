"""Finish sewn clothing surfaces before their normal LOD reduction.

This pass is restricted to military shoulder pads. It does not change the
reviewed face, the native body, the rig, or the positions and weights of the
remaining clothing pieces.
"""
import bmesh


def finish_shoulder_pads(ctx):
    if ctx['preset'] not in ('granadero', 'royalist'):
        return
    for obj in ctx['objects']:
        if not obj.name.startswith('Crimson_Epaulette_'):
            continue
        # The sampled ellipsoid has coincident vertices at both poles and
        # inward face winding. Close the poles before calculating outward
        # normals, so reduced pads do not show black holes in their top faces.
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-7)
        bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
        mesh.normal_update()
        if mesh.calc_volume(signed=True) < 0:
            bmesh.ops.reverse_faces(mesh, faces=list(mesh.faces))
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()
