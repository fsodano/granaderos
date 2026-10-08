"""Fit selected released rifle clips; export only their lower rotations."""
from pathlib import Path
import sys,argparse,json
import bpy
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE))
from guard_support import LEGS,boot_bindings,profiles,fit_pose
from bayonet_support import fit_pose as fit_bayonet_pose
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=a.input)
rig=next(obj for obj in bpy.data.objects if obj.type=='ARMATURE');mesh=next(obj for obj in bpy.data.objects if obj.name.startswith('Human_footwear_'))
print('GUARD_IMPORTED',rig.name,mesh.name,list(rig.rotation_euler),[(track.name,[(strip.action.name,strip.frame_start,strip.frame_end)for strip in track.strips])for track in rig.animation_data.nla_tracks],flush=True)
boots,soles=boot_bindings(rig,mesh);reports={};actions=[]
tracks=list(rig.animation_data.nla_tracks)
for track in tracks:
    assert len(track.strips)==1;strip=track.strips[0];native=strip.action
    for other in tracks:other.mute=True
    rig.animation_data.action=native
    start,end=native.frame_range;duration=(end-start)/bpy.context.scene.render.fps
    bpy.context.scene.frame_set(int(start),subframe=start-int(start));basis=profiles(rig,boots)
    bayonet=track.name=='stand.bayonet.long-gun';fitter=fit_bayonet_pose if bayonet else fit_pose
    # Sample the exact released pose. Native Root, pelvis and weapon tracks
    # are later retained byte for byte by the named rotation transplant.
    # Measure the full native reach demand before choosing a smooth roll.
    # A pointwise minimum would make a tangent corner as the knee reaches
    # its straight-leg reserve. Retain a 2 mm reserve through a C2 envelope.
    raw_times=sorted(set([i/240 for i in range(int(duration*240)+1)]+[duration]));required=[]
    for time in raw_times:
        frame=start+time*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
        try:fitted,report=fitter(rig,boots,soles,basis)
        except Exception:
            print('GUARD_FIT_FAILED',track.name,time,flush=True);raise
        required.append(report)
    envelopes={}
    def smooth(value):
        u=max(0,min(1,value));return u*u*u*(10+u*(-15+6*u))
    for side in ('l','r'):
        active=[i for i,report in enumerate(required)if report[side]['heelRoll']>0]
        if not active:continue
        first,last=raw_times[active[0]],raw_times[active[-1]];peak=max(active,key=lambda i:required[i][side]['heelRoll']);middle=raw_times[peak]
        # Three released 30 Hz pose intervals extend the measured demand
        # into its existing preparation/recovery, without moving a marker.
        begin=max(0,first-.1);end=min(duration,last+.1)
        def envelope(time):return smooth((time-begin)/(middle-begin))if time<=middle else 1-smooth((time-middle)/(end-middle))
        amplitude=max(required[i][side]['heelRoll']/envelope(raw_times[i])for i in active)+.00001
        envelopes[side]={'begin':begin,'peak':middle,'end':end,'amplitude':amplitude}
    def values(windows,time):
        result={}
        for side,window in windows.items():
            u=smooth((time-window['begin'])/(window['peak']-window['begin']))if time<=window['peak']else 1-smooth((time-window['peak'])/(window['end']-window['peak']))
            result[side]=window['amplitude']*u
        return result
    shift_envelopes={}
    if bayonet:
        # A complete sole, rather than an arbitrary angle, bounds the roll.
        # Retain the exact Root/pelvis and measure the smallest hip-directed
        # planar correction for that smooth roll at every native pose.
        for side,window in envelopes.items():
            window['nativeDemandAmplitude']=window['amplitude']
            window['amplitude']=min(window['amplitude'],min(report[side]['maximumHeelRoll']for report in required)-.000001)
        shift_demand=[]
        for time in raw_times:
            frame=start+time*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
            _,report=fitter(rig,boots,soles,basis,values(envelopes,time));shift_demand.append(report)
        for side in ('l','r'):
            active=[i for i,report in enumerate(shift_demand)if report[side]['planarCorrection']>.0000001]
            if not active:continue
            first,last=raw_times[active[0]],raw_times[active[-1]];peak=max(active,key=lambda i:shift_demand[i][side]['planarCorrection']);middle=raw_times[peak];begin=max(0,first-.1);end=min(duration,last+.1)
            def envelope(time):return smooth((time-begin)/(middle-begin))if time<=middle else 1-smooth((time-middle)/(end-middle))
            amplitude=max(shift_demand[i][side]['planarCorrection']/envelope(raw_times[i])for i in active)+.000001
            assert amplitude<.005,('Measured bayonet correction exceeds a 5 mm native support adjustment',side,amplitude)
            shift_envelopes[side]={'begin':begin,'peak':middle,'end':end,'amplitude':amplitude}
    rotations=[];detail=[];fps=120;times=sorted(set([i/fps for i in range(int(duration*fps)+1)]+[duration]))
    for time in times:
        frame=start+time*bpy.context.scene.render.fps;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));rolls={}
        for side,window in envelopes.items():
            u=smooth((time-window['begin'])/(window['peak']-window['begin']))if time<=window['peak']else 1-smooth((time-window['peak'])/(window['end']-window['peak']))
            rolls[side]=window['amplitude']*u
        fitted,report=fitter(rig,boots,soles,basis,rolls,values(shift_envelopes,time))if bayonet else fitter(rig,boots,soles,basis,rolls)
        rotations.append(fitted);detail.append(report)
    action=bpy.data.actions.new(track.name);rig.animation_data.action=action
    for time,sample in zip(times,rotations):
        for name,q in sample.items():
            bone=rig.pose.bones[name];bone.rotation_quaternion=q
            bone.keyframe_insert(data_path='rotation_quaternion',frame=1+time*fps,group=name)
    for layer in action.layers:
        for action_strip in layer.strips:
            for bag in action_strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    actions.append((track.name,action,duration));reports[track.name]={'duration':duration,'sampleRate':fps,'times':times,'samples':detail,'forefootRollEnvelopes':envelopes,'minimumStraightLegReserve':.002}
    if bayonet:reports[track.name].update({'planarShiftEnvelopes':shift_envelopes,'measuredMinimumStraightLegReserve':min(report[side]['straightLegReserve']for report in detail for side in ('l','r')),'numericalReserveBuffer':.000001})
rig.animation_data.action=None
for track in tracks:rig.animation_data.nla_tracks.remove(track)
for name,action,duration in actions:
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action)
bpy.context.scene.render.fps=120
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=False,export_frame_range=False,export_anim_slide_to_zero=True,export_nla_strips=True,export_skins=True,export_extras=False,export_cameras=False,export_lights=False)
output.with_suffix('.json').write_text(json.dumps(reports,indent=2)+'\n')
print('GUARD_SUPPORT_READY',len(actions),flush=True)
