"""Fit the three stored native reach gestures against all released boot LODs."""
from pathlib import Path
import sys,argparse,json
import bpy
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE))
from gesture_support import NAMES,LEGS,bindings,profiles,fit_pose
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--body',action='append',required=True);p.add_argument('--output',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=a.input)
rig=next(obj for obj in bpy.data.objects if obj.type=='ARMATURE');boots={'l':[],'r':[]};soles={'l':[],'r':[]};counts=[]
for path in a.body:
    prior=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=path);added=set(bpy.data.objects)-prior
    mesh=next(obj for obj in added if obj.name.startswith('Human_footwear_'));body_rig=next(obj for obj in added if obj.type=='ARMATURE')
    assert set(b.name for b in body_rig.data.bones)==set(b.name for b in rig.data.bones),'Released LOD skeleton differs'
    for bone in rig.data.bones:assert max(abs(bone.matrix_local[i][j]-body_rig.data.bones[bone.name].matrix_local[i][j])for i in range(4)for j in range(4))<.00002,bone.name+' LOD bind differs'
    full,outline=bindings(rig,mesh);counts.append({'lod':Path(path).stem,'vertices':{s:len(full[s])for s in full},'soleVertices':{s:len(outline[s])for s in outline}})
    for side in('l','r'):boots[side]+=full[side];soles[side]+=outline[side]
    for obj in added:bpy.data.objects.remove(obj,do_unlink=True)
reports={};actions=[];tracks=list(rig.animation_data.nla_tracks)
assert{track.name for track in tracks}==NAMES,'Input is not the bounded gesture inventory'
for track in tracks:
    strip=track.strips[0];native=strip.action
    for other in tracks:other.mute=True
    rig.animation_data.action=native;start,end=native.frame_range;duration=(end-start)/bpy.context.scene.render.fps
    bpy.context.scene.frame_set(int(start),subframe=start-int(start));profile=profiles(rig,soles)
    fps=120;times=sorted(set([i/fps for i in range(int(duration*fps)+1)]+[duration]));rotations=[];detail=[];rolls={'l':0,'r':0}
    # This authored gesture has no step. A fixed measured forefoot contact
    # avoids a pointwise reach envelope moving its planted sole during a bend.
    for time in times:
        frame=start+time*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
        _,report=fit_pose(rig,boots,soles,profile)
        for side in rolls:rolls[side]=max(rolls[side],report[side]['heelRoll'])
    rolls={side:roll+.00001 if roll else 0 for side,roll in rolls.items()}
    for time in times:
        frame=start+time*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
        fitted,report=fit_pose(rig,boots,soles,profile,rolls);rotations.append(fitted);detail.append(report)
    action=bpy.data.actions.new(track.name);rig.animation_data.action=action;previous={}
    for time,sample in zip(times,rotations):
        for name,q in sample.items():
            if name in previous and previous[name].dot(q)<0:q.negate()
            previous[name]=q.copy();bone=rig.pose.bones[name];bone.rotation_quaternion=q;bone.keyframe_insert(data_path='rotation_quaternion',frame=1+time*fps,group=name)
    for layer in action.layers:
        for action_strip in layer.strips:
            for bag in action_strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    actions.append((track.name,action));reports[track.name]={'duration':duration,'sampleRate':fps,'times':times,'samples':detail,'lodSurfaces':counts,'fixedForefootRoll':rolls,'minimumStraightLegReserve':.002}
rig.animation_data.action=None
for track in tracks:rig.animation_data.nla_tracks.remove(track)
for name,action in actions:
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action)
bpy.context.scene.render.fps=120;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=False,export_frame_range=False,export_anim_slide_to_zero=True,export_nla_strips=True,export_skins=True,export_extras=False,export_cameras=False,export_lights=False)
output.with_suffix('.json').write_text(json.dumps(reports,indent=2)+'\n');print('GESTURE_SUPPORT_READY',len(actions),flush=True)
