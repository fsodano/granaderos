"""Small adult facial planes on the existing native skin surface.

The source rig, UVs, topology, eye rims, lips and all skin weights stay fixed.
Only the facial soft tissue moves, by less than 2.5 mm.
"""
import math


def shape_face(skin, eye_z, gender):
    def g(value, centre, width):
        return math.exp(-((value-centre)/width)**2)
    for vertex in skin.data.vertices:
        p=vertex.co.copy();n=vertex.normal.copy();x=abs(p.x)
        if p.z<eye_z-.085 or p.z>eye_z+.035 or p.y>-.080 or x>.081:
            continue
        # Avoid the mouth and nose: these are thin fitted native structures.
        front=max(0,min(1,(-n.y-.20)/.60))
        lateral=max(0,min(1,(x-.021)/.015))
        eye_clear=1-g(x,.031,.020)*g(p.z,eye_z,.013)
        mature=.78 if gender=='female' else 1
        # Broad cheekbone ridge, then the softer concavity below it. Different
        # widths prevent a paired round bulge from reading as a new sphere.
        relief=.0016*g(x,.048,.023)*g(p.z,eye_z-.023,.014)
        relief-=.0019*g(x,.053,.022)*g(p.z,eye_z-.047,.023)
        relief-=.0007*g(x,.070,.015)*g(p.z,eye_z+.004,.030)
        # A small continuous brow pad, not an extruded brow bar.
        relief+=.0010*g(x,.032,.022)*g(p.z,eye_z+.017,.008)
        relief*=lateral*eye_clear
        # Small alar and philtrum planes follow the existing features. Keep
        # their silhouette and the actual lip seam; avoid engraved ageing lines.
        relief+=.00060*g(x,.016,.005)*g(p.z,eye_z-.036,.006)
        relief-=.00038*g(x,.022,.003)*g(p.z,eye_z-.038,.008)
        relief+=.00042*g(x,.0045,.002)*g(p.z,eye_z-.050,.007)
        relief-=.00022*g(p.x,0,.002)*g(p.z,eye_z-.050,.006)
        naso_z=(eye_z-p.z-.037)/.030
        if 0<naso_z<1:
            crease_x=.024+.008*naso_z-.003*naso_z*naso_z
            relief-=.00043*g(x,crease_x,.0028)*math.sin(math.pi*naso_z)
        # Unequal soft tissue, well below 1 mm, removes perfect bilateral
        # symmetry without translating the eyes or skewing the jaw.
        relief+=.00028*g(p.x,.046,.026)*g(p.z,eye_z-.034,.025)
        shift=relief*front*mature
        if abs(shift)>=.000005:vertex.co+=n*shift
    skin.data.update()


def surface_uv(obj, point, face_index):
    from mathutils import Vector
    from mathutils.geometry import barycentric_transform, closest_point_on_tri
    loops=list(obj.data.polygons[face_index].loop_indices);candidates=[]
    for i in range(1,len(loops)-1):
        triangle=[loops[0],loops[i],loops[i+1]]
        coords=[obj.data.vertices[obj.data.loops[j].vertex_index].co for j in triangle]
        tex=[Vector((*obj.data.uv_layers.active.data[j].uv,0)) for j in triangle]
        nearest=closest_point_on_tri(point,*coords)
        candidates.append(((nearest-point).length_squared,barycentric_transform(nearest,*coords,*tex)))
    return min(candidates,key=lambda candidate:candidate[0])[1].xy
