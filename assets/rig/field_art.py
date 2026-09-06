"""Offline material and mesh finishing for human-scale tactical sprite renders.

Imported by the original Blender authoring scripts. No runtime geometry is used.
"""
import bpy
import math


def cloth_material(material):
    """Broad irregular cloth shading; avoid shiny uniform toy surfaces."""
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .98
    shader.inputs['Specular IOR Level'].default_value = .12
    color = tuple(shader.inputs['Base Color'].default_value)
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 8
    noise.inputs['Detail'].default_value = 1
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .23
    ramp.color_ramp.elements[0].color = tuple(c * .80 for c in color[:3]) + (1,)
    ramp.color_ramp.elements[1].position = .77
    ramp.color_ramp.elements[1].color = tuple(min(1, c * 1.16) for c in color[:3]) + (1,)
    links.new(noise.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs[0], shader.inputs['Base Color'])


def tailored_coat(obj):
    # Elliptical cross sections follow waist, ribs, shoulders and collar.
    # Existing belts/facings retain their authored front surface positions.
    rings = [(-.295,.17,.115),(-.18,.172,.123),(-.02,.196,.142),
             (.14,.214,.142),(.245,.20,.117),(.295,.135,.088)]
    vertices = []
    sides = 16
    for z, width, depth in rings:
        for i in range(sides):
            angle = i * math.tau / sides
            vertices.append((math.cos(angle)*width,math.sin(angle)*depth,z))
    faces = []
    for j in range(len(rings)-1):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple(range((len(rings)-1)*sides,len(rings)*sides))]
    material = obj.data.materials[0]
    mesh = bpy.data.meshes.new('Tailored coat panels')
    mesh.from_pydata(vertices,[],faces);mesh.materials.append(material)
    obj.data=mesh;obj.scale=(1,1,1)
    obj.modifiers.clear()
    for face in mesh.polygons: face.use_smooth=True


def finish_infantry():
    tailored_coat(bpy.data.objects['wool_coat'])
    head=bpy.data.objects['head'];head.scale=(.70,.76,.70)
    for obj in bpy.data.objects:
        name=obj.name
        if obj.type!='MESH': continue
        if any(part in name for part in ['_thigh','_shin','_upperarm','_forearm']):
            # Reshape cylinder rings into soft, irregular fabric folds. Cylinders
            # already use local Z for their long axis, irrespective of joint pose.
            old=obj.data
            radius=max(math.hypot(v.co.x,v.co.y) for v in old.vertices)
            length=max(v.co.z for v in old.vertices)-min(v.co.z for v in old.vertices)
            vertices=[];count=12
            for j,(along,width) in enumerate([(-.5,.72),(-.38,.89),(-.20,.91),(0,1),(.21,.98),(.38,.91),(.5,.80)]):
                for i in range(count):
                    a=math.tau*i/count
                    fold=1+.055*math.sin(i*2.7+j*2.1)
                    vertices.append((math.cos(a)*radius*width*fold,math.sin(a)*radius*width*fold,along*length))
            faces=[]
            for j in range(6):
                for i in range(count):
                    a=j*count+i;b=j*count+(i+1)%count
                    faces.append((a,b,b+count,a+count))
            faces += [tuple(reversed(range(count))),tuple(range(6*count,7*count))]
            mesh=bpy.data.meshes.new(name+' cloth contour');mesh.from_pydata(vertices,[],faces)
            for mat in old.materials:mesh.materials.append(mat)
            obj.data=mesh
            for face in mesh.polygons:face.use_smooth=True
        if '_hand_skin' in name:obj.scale*=.79
        if '_boot' in name and '_bootleg' not in name:obj.scale.x*=.87;obj.scale.y*=.87
        if '_epaulette' in name:obj.scale*=.68
        if name.startswith('shako') and 'brim' not in name:obj.scale.x*=.88;obj.scale.y*=.88
        if name.startswith('red_plume'):obj.scale*=.78
        if name.startswith('eye'):obj.scale*=.55
        if name.startswith('nose'):obj.scale*=.74
    for name in ['Navy wool','Unbleached wool','Crimson facings','Walnut']:
        cloth_material(bpy.data.materials[name])
    # Small directional highlights describe form at native pixel size.
    lights=[o for o in bpy.data.objects if o.type=='LIGHT']
    for light in lights:light.data.size=2.0


def native_pixels(scene, size):
    from mathutils import Vector
    # Match the map diamond slope (14/26) and place the world origin exactly
    # on the integer anchor used by the native atlas renderer.
    elevation=math.asin(14/26)
    anchor_y={52:46,62:40,70:62,76:63,80:47}[size]
    camera=scene.camera
    target=(anchor_y/size-.5)*camera.data.ortho_scale/math.cos(elevation)
    camera.location=(6,-6,target+math.sqrt(72)*math.tan(elevation))
    camera.rotation_euler=(Vector((0,0,target))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=size;scene.render.resolution_y=size
    scene.render.resolution_percentage=100
    scene.cycles.samples=24
    scene.cycles.use_denoising=False
    scene.cycles.filter_width=.1
    scene.render.film_transparent=True
    scene.render.image_settings.color_mode='RGBA'
    scene.render.image_settings.file_format='PNG'
    scene['logical_pixel_size']=size
    bpy.context.view_layer.update()
