"""Render armed/unarmed prone actions and distinct incapacitated body poses.

All frames are original offline geometry. Breathing changes the torso and near
arm only; dead bodies use one still frame per direction. No raster warping.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'rig'))
from field_art import native_pixels
DIRECTIONS=[('n',225),('ne',180),('e',135),('se',90),('s',45),('sw',0),('w',315),('nw',270)]
OUT=ROOT/'rig/ground-frames';OUT.mkdir(exist_ok=True)


def limb(side, hand_point):
    """Two segment arm placement in world coordinates, with a grounded elbow."""
    shoulder=bpy.data.objects[side+'_shoulder'];elbow=bpy.data.objects[side+'_elbow']
    bpy.context.view_layer.update()
    a=shoulder.matrix_world.translation.copy();b=Vector(hand_point)
    delta=b-a;distance=min(.508,delta.length)
    axis=delta.normalized()
    # Arm segments measure .25 + .26. Choose the lower elbow solution.
    along=(.25**2-.26**2+distance**2)/(2*distance)
    bend=Vector((0,0,-1));bend=(bend-axis*bend.dot(axis)).normalized()
    middle=a+axis*along+bend*math.sqrt(max(0,.25**2-along**2))
    upper=(middle-a).to_track_quat('-Z','Y')
    parent=shoulder.parent.matrix_world.to_quaternion()
    shoulder.rotation_euler=(parent.inverted()@upper).to_euler()
    bpy.context.view_layer.update()
    lower=(b-middle).to_track_quat('-Z','Y')
    elbow.rotation_euler=(shoulder.matrix_world.to_quaternion().inverted()@lower).to_euler()


def pose_prone(armed,action,frame):
    body=bpy.data.objects['torso_pivot'];head=bpy.data.objects['head']
    phase=frame/8;wave=math.sin(phase*math.tau) if action=='walk' else 0
    recoil=[0,.075,.035,.01,0,0,0,0][frame] if action=='fire' else 0
    body.location=(0,.10+recoil,.27+abs(wave)*.012)
    body.rotation_euler=(math.pi/2,0,0);head.rotation_euler=(-.48,0,.05)
    for side,sign in [('left',-1),('right',1)]:
        hip=bpy.data.objects[side+'_hip'];knee=bpy.data.objects[side+'_knee'];ankle=bpy.data.objects[side+'_ankle']
        hip.location=(sign*.13,.10,.25)
        hip.rotation_euler=(math.pi/2-.08+sign*.08*wave,sign*.12,0)
        knee.rotation_euler=(.12+sign*.09*wave,0,0);ankle.rotation_euler=(-.26,0,0)
    bpy.context.view_layer.update()
    # Supporting forearms extend forward under the raised head. A live prone
    # soldier visibly braces on elbows, unlike either collapsed pose.
    if armed:
        musket=bpy.data.objects['flintlock_musket']
        musket.parent=None;musket.location=(.11,-.54+recoil,.35)
        musket.rotation_euler=(math.pi/2,0,0)
        right=(.11,-.61+recoil,.34)
        left=(.11,-.73+recoil,.34)
        if action=='reload':
            lift=math.sin(math.pi*phase)**2
            left=(-.03,-.75+lift*.18,.34+lift*.12)
            musket.rotation_euler.z=.12*lift
        if action=='walk':left=(-.13,-.77+wave*.10,.22)
    else:
        right=(.25,-.77-wave*.12,.13);left=(-.25,-.77+wave*.12,.13)
    limb('right',right);limb('left',left)
    if action=='fire':
        flash=bpy.data.objects.get('prone_muzzle_flash')
        if flash is None:
            bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.075,radius2=0,depth=.18)
            flash=bpy.context.object;flash.name='prone_muzzle_flash'
            flash.parent=bpy.data.objects['ROOT_world_reference']
            material=bpy.data.materials.new('Brief flintlock flash');material.use_nodes=True
            shader=material.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Base Color'].default_value=(1,.38,.035,1)
            shader.inputs['Emission Color'].default_value=(1,.48,.04,1)
            shader.inputs['Emission Strength'].default_value=3
            flash.data.materials.append(material)
        flash.location=(.11,-1.71+recoil,.319);flash.rotation_euler=(math.pi/2,0,0)
        flash.hide_render=frame!=1


def pose_collapsed(state,frame):
    body=bpy.data.objects['torso_pivot'];head=bpy.data.objects['head']
    # Side-lying unconscious posture; one restrained rise/fall over four seconds.
    breath=(1-math.cos(math.tau*frame/8))*.5 if state=='unconscious' else 0
    if state=='unconscious':
        body.location=(0,.10,.20+breath*.045);body.rotation_euler=(math.pi/2,1.10,.12)
        head.rotation_euler=(.10,.28,.20)
    else:
        # Distinct supine, asymmetric, relaxed still body. No breathing curves.
        body.location=(0,.10,.16);body.rotation_euler=(-math.pi/2,0,.10)
        head.rotation_euler=(.15,-.20,-.35)
    for side,sign in [('left',-1),('right',1)]:
        hip=bpy.data.objects[side+'_hip'];knee=bpy.data.objects[side+'_knee'];ankle=bpy.data.objects[side+'_ankle']
        hip.location=(sign*.13,.10,.17)
        hip.rotation_euler=((-math.pi/2 if state=='dead' else math.pi/2)-.06,sign*(.30 if state=='dead' else .13),0)
        knee.rotation_euler=(.08 if state=='dead' else (.46 if sign<0 else .18),0,0)
        ankle.rotation_euler=(-.25,0,sign*.22)
        shoulder=bpy.data.objects[side+'_shoulder'];elbow=bpy.data.objects[side+'_elbow']
        shoulder.rotation_euler=(.36 if state=='unconscious' else -.30,sign*(.80 if state=='dead' else .25),sign*.15)
        elbow.rotation_euler=(-.65 if state=='unconscious' else -.10,0,0)


for family in ['granadero','royalist','civilian']:
    sequences=[('dead','idle',False),('unconscious','breathe',False)]
    if family!='civilian':
        sequences += [('prone-armed',action,True) for action in ['idle','walk','fire','reload']]
        sequences += [('prone-unarmed',action,False) for action in ['idle','walk']]
    for state,action,armed in sequences:
        source='civilian.blend' if family=='civilian' else f'infantry-{family}.blend'
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/'rig'/source))
        for obj in bpy.data.objects:obj.animation_data_clear()
        root=bpy.data.objects['ROOT_world_reference'];root.rotation_euler=(0,0,0)
        weapon=bpy.data.objects.get('flintlock_musket')
        if weapon:
            for obj in [weapon,*weapon.children_recursive]:obj.hide_render=not armed
        scene=bpy.context.scene;scene.camera.data.ortho_scale=4
        native_pixels(scene,80)
        for direction,angle in DIRECTIONS:
            for frame in range(1 if action=='idle' else 8):
                root.rotation_euler=(0,0,0)
                if state.startswith('prone'):pose_prone(armed,action,frame)
                else:pose_collapsed(state,frame)
                if armed:
                    weapon=bpy.data.objects['flintlock_musket']
                    # Place firearm in world space, then rotate it with the unit.
                    bpy.context.view_layer.update()
                    matrix=weapon.matrix_world.copy();weapon.parent=root;weapon.matrix_world=matrix
                root.rotation_euler.z=math.radians(angle)
                scene.render.filepath=str(OUT/f'{family}-{state}-{action}-{direction}{"" if action=="idle" else "-"+str(frame)}.png')
                bpy.ops.render.render(write_still=True)
print('Rendered distinct prone, unconscious breathing, and dead states in eight directions.')
