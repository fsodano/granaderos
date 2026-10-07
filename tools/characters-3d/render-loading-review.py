#!/usr/bin/env python3
"""Render native loading poses with the same timed props as the published clip.

Run through Blender, with arguments after --. This is a source review, not a
browser rendering check. No production asset is written by this tool.
"""
from pathlib import Path
import argparse,sys
import bpy
from mathutils import Matrix,Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'assets/source/characters-3d/authoring'))
from character import create_character
from equipment_library import create_library
from equipment_dimensions import PISTOL_STRETCH,RIFLE_STRETCH
from motion import apply_animations
from sockets import create_sockets

parser=argparse.ArgumentParser()
parser.add_argument('--preset',default='woman-scout')
parser.add_argument('--item',required=True,choices=tuple(PISTOL_STRETCH)+tuple(RIFLE_STRETCH))
parser.add_argument('--pose',action='append',required=True,help='stand:0.58, crouch:0.58, prone:0.58 or mounted:0.58')
parser.add_argument('--output-dir',type=Path,required=True)
parser.add_argument('--detail',action='store_true',help='Frame the hands, muzzle and actual timed tool')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
poses=[]
for value in args.pose:
    posture,fraction=value.split(':');fraction=float(fraction)
    assert posture in ('stand','crouch','prone','mounted') and 0<=fraction<=1
    poses.append((posture,fraction))
equipment='short-gun' if args.item in PISTOL_STRETCH else 'long-gun'
names={f'{posture}.reload.{equipment}.{args.item}' for posture,_ in poses}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
ctx=create_character(args.preset);body_objects=list(ctx['objects']);create_library(ctx)
motion=apply_animations(ctx,only=names);create_sockets(ctx)
specs={clip['name']:clip for clip in motion['clips']};rig=ctx['rig']

def attach(item,socket):
    # Equipment groups originate under a bone. Changing only their parent
    # retains BONE mode, which misplaces the prop under an EMPTY socket.
    item.parent=bpy.data.objects[socket];item.parent_type='OBJECT';item.parent_bone=''
    item.matrix_parent_inverse=Matrix.Identity(4);item.matrix_basis=Matrix.Identity(4)

gun=bpy.data.objects['item_'+args.item]
attach(gun,'socket_handRight_'+('pistol' if equipment=='short-gun' else 'rifle'))
props={item:bpy.data.objects['item_'+item] for spec in specs.values() for item in [cue['item'] for cue in spec.get('propCues',[])]}
visible=set(body_objects+[rig,gun,*gun.children_recursive])
for prop in props.values():visible.update([prop,*prop.children_recursive])
for obj in bpy.data.objects:
    if obj.type=='MESH' and obj not in visible:obj.hide_render=True
scene=bpy.context.scene;scene.render.fps=30
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.world.color=(.14,.14,.14)
for loc,power,size in [((2,-4,6),650,4),((-3,-1,4),220,4),((1,4,5),350,4)]:
    data=bpy.data.lights.new('Review_Light','AREA');data.energy=power;data.size=size
    light=bpy.data.objects.new('Review_Light',data);bpy.context.collection.objects.link(light);light.location=loc
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Review_Camera');camera=bpy.data.objects.new('Review_Camera',data);bpy.context.collection.objects.link(camera)
camera.location=(3,-5,2.3);data.type='ORTHO';data.ortho_scale=2.4;scene.camera=camera
scene.render.resolution_x=650;scene.render.resolution_y=750;scene.render.resolution_percentage=100
args.output_dir.mkdir(parents=True,exist_ok=True)
for posture,fraction in poses:
    name=f'{posture}.reload.{equipment}.{args.item}';spec=specs[name];time=spec['duration']*fraction
    for track in rig.animation_data.nla_tracks:track.mute=True
    action=bpy.data.actions[name];rig.animation_data.action=action
    if action.slots:rig.animation_data.action_slot=action.slots[0]
    frame=1+time*scene.render.fps;scene.frame_set(int(frame),subframe=frame-int(frame))
    gun.location=(0,0,0)
    for offset in spec.get('gripOffsets',[]):
        if offset['hand']!='handRight':continue
        keys=offset['keys'];position=keys[0]['position']
        for previous,current in zip(keys,keys[1:]):
            if time>=current['time']:position=current['position'];continue
            u=max(0,(time-previous['time'])/(current['time']-previous['time']))
            position=[a+(b-a)*u for a,b in zip(previous['position'],current['position'])];break
        gun.location=(position[0],-position[2],position[1])
    for item,prop in props.items():
        cue=next((cue for cue in spec.get('propCues',[]) if cue['item']==item and cue['start']<=time<=cue['end']),None)
        for obj in [prop,*prop.children_recursive]:obj.hide_render=cue is None
        if cue:
            attach(prop,cue['socket']);prop.scale=(cue.get('scale',1),)*3
            assert prop.parent_type=='OBJECT' and not prop.hide_render
    bpy.context.view_layer.update()
    for cue in spec.get('propCues',[]):
        if cue['start']<=time<=cue['end']:
            prop=props[cue['item']]
            contact=spec['loadingContact']['muzzle'];muzzle=gun.matrix_world @ Vector((contact[0],-contact[2],contact[1]))
            axis=(gun.matrix_world.to_3x3() @ Vector((1,0,0))).normalized();tool_axis=(prop.matrix_world.to_3x3() @ Vector((0,0,1))).normalized()
            delta=prop.matrix_world.translation-muzzle;offset=(delta-axis*delta.dot(axis)).length
            assert offset<.006 and tool_axis.dot(axis)<-.9999,'The visible source rod must fit the actual selected muzzle'
            print('LOADING_REVIEW_CONTACT',name,offset,tool_axis.dot(axis),list(muzzle),list(prop.matrix_world.translation),flush=True)
    target=Vector((0,-.1,.65 if posture=='prone' else 1))
    camera.location=(-3,-5,1.1) if posture=='prone' else (3,-5,2.3)
    if args.detail:
        contact=spec['loadingContact']['muzzle'];muzzle=gun.matrix_world @ Vector((contact[0],-contact[2],contact[1]))
        active=next((cue for cue in spec.get('propCues',[]) if cue['start']<=time<=cue['end']),None)
        target=(muzzle+props[active['item']].matrix_world.translation)*.5 if active else muzzle
        camera.location=target+Vector((-2,-4,.45 if posture=='prone' else 1))
        data.ortho_scale=.8 if equipment=='short-gun' else 1.4
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(args.output_dir/f'{args.preset}-{args.item}-{posture}-{fraction:.2f}{"-detail" if args.detail else ""}.png')
    bpy.ops.render.render(write_still=True)
    print('LOADING_REVIEW',name,round(time,6),[cue['item'] for cue in spec.get('propCues',[]) if cue['start']<=time<=cue['end']],flush=True)
