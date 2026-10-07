"""Native ladder contacts, followed by a supported step onto the roof.

The same measured geometry and contact plan also drives the visible ladder
and the bounded runtime fit for other authored link heights.
"""
import json,math,subprocess
from pathlib import Path
from mathutils import Vector,Quaternion


def _native_limb(rig,names,target,pole,folded_bend=None,folded_weight=0):
    """Fit native child-head segments; native tails are not contact joints."""
    from motion import _head,_set_world_rotation
    bones=[rig.data.bones[name]for name in names];base=_head(rig,names[0])
    offsets=[bones[index+1].head_local-bones[index].head_local for index in (0,1)]
    lengths=[point.length for point in offsets];a,b=lengths
    direction=Vector(target)-base;distance=min(a+b-.0005,max(abs(a-b)+.0005,direction.length));direction.normalize()
    bend=Vector(pole)-base;bend-=direction*bend.dot(direction)
    if bend.length<.001:bend=Vector((1,0,0))
    bend.normalize()
    if folded_bend is not None and folded_weight:
        # A roof step brings the ankle close to the hip. A high point pole
        # then changes sides as the boot rises, flipping the folded knee.
        # Keep a continuous bend plane through that interval. The caller
        # returns it to the actual idle knee plane after both roof supports.
        safe=Vector(folded_bend);safe-=direction*safe.dot(direction);safe.normalize()
        bend=bend.lerp(safe,folded_weight).normalized()
    along=(a*a-b*b+distance*distance)/(2*distance)
    middle=base+direction*along+bend*math.sqrt(max(0,a*a-along*along))
    for index,end in ((0,middle),(1,base+direction*distance)):
        start=_head(rig,names[index]);rotation=offsets[index].rotation_difference(end-start)@bones[index].matrix_local.to_quaternion()
        _set_world_rotation(rig,names[index],rotation)


def _palm_contact(rig,side,target,pole,long,normal,curl,bend_weight=0):
    from motion import _hand_rotation,_set_world_rotation,_finger_curl
    hand=rig.data.bones['hand_'+side];rotation=_hand_rotation(rig,side,long,normal)
    fitting=hand.matrix_local.inverted()@hand.head_local.lerp(rig.data.bones['middle_01_'+side].head_local,.72)
    _native_limb(rig,('upperarm_'+side,'lowerarm_'+side,'hand_'+side),Vector(target)-rotation@fitting,pole,(1 if side=='l'else -1,0,0),bend_weight)
    _set_world_rotation(rig,'hand_'+side,rotation);_finger_curl(rig,curl,side)


def _authoring(ctx,idle=None):
    cached=ctx.get('climbing_authoring')
    if cached and (idle is None or cached.get('idle_feet')):return cached
    rig=ctx['rig'];feet={};fittings={}
    for side in ('l','r'):
        ball=rig.data.bones['ball_'+side];foot=rig.data.bones['foot_'+side]
        sole=next(obj for obj in ctx['objects']if obj.name=='Boot_Sole_'+side)
        contact=Vector((ball.head_local.x,ball.head_local.y,min(v.co.z for v in sole.data.vertices)))
        feet[side]=[contact.x,contact.z,-contact.y]
        fittings[side]=foot.matrix_local.inverted()@contact
    feet_bind={side:list(point)for side,point in feet.items()}
    if idle is not None:
        from motion import _apply_sample
        _apply_sample(rig,idle)
        for side in ('l','r'):
            contact=rig.pose.bones['foot_'+side].matrix@fittings[side]
            feet[side]=[contact.x,contact.z,-contact.y]
    script="""
import{readFileSync}from'node:fs';
import{ladderGeometry,sampleLadderClimb}from'./game/climb-geometry.js';
import{BUILDING_TYPES}from'./game/building-types.js';
import{BUILDING_VERTICAL_SCALE}from'./game/building-scale.js';
const{feet}=JSON.parse(readFileSync(0,'utf8'));
const tile=26*Math.SQRT2*Math.sqrt(1-(14/26)**2)*3/(BUILDING_TYPES.house.height+BUILDING_VERTICAL_SCALE);
const geometry=ladderGeometry([0,0,0],[0,3,tile],tile),duration=Math.ceil(3/.65*60)/60,count=Math.round(duration*60),fractions=new Set(Array.from({length:count+1},(_,i)=>i/count));
    for(const t of [0,.02,.04,.06,.08,.10,.12,.60,.70,.72,.76,.772,.79,.80,.802,.81,.82,.83,.84,.85,.86,.88,.91,.96,.98,1])fractions.add(t);
for(let step=0;step<geometry.steps-2;step++)for(const phase of [0,.03,.46,.55,.94,1])fractions.add(.12+.64*(step+phase)/(geometry.steps-2));
const keys=[...fractions].sort((a,b)=>a-b);
console.log(JSON.stringify({geometry,duration,keys,plans:keys.map(t=>sampleLadderClimb(geometry,t,feet)),feet}));
"""
    root=Path(__file__).resolve().parents[4]
    data=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=root,input=json.dumps({'feet':feet}),text=True))
    data['fittings']=fittings;data['feet_bind']=feet_bind;data['idle_feet']=idle is not None;ctx['climbing_authoring']=data
    return data


def fractions(ctx):return _authoring(ctx)['keys']
def duration(ctx):return _authoring(ctx)['duration']


def pose(ctx,idle,t,reverse=False):
    from motion import _apply_sample,_collect,_root_shift,_set_world_rotation,_blend
    data=_authoring(ctx,idle);t=1-t if reverse else t
    # The increment compiler includes each exact contact key. The nearest
    # key absorbs only floating point rounding in seconds-to-phase conversion.
    plan=min(data['plans'],key=lambda entry:abs(entry['fraction']-t))
    rig=ctx['rig'];_apply_sample(rig,idle)
    idle_feet={name:rig.pose.bones[name].matrix.to_quaternion()for side in ('l','r')for name in ('foot_'+side,'ball_'+side)}
    idle_knees={}
    for side in ('l','r'):
        hip=rig.pose.bones['thigh_'+side].head
        axis=(rig.pose.bones['foot_'+side].head-hip).normalized()
        bend=rig.pose.bones['calf_'+side].head-hip
        idle_knees[side]=(bend-axis*bend.dot(axis)).normalized()
    if t<=0 or t>=1:return _collect(rig)
    _root_shift(rig,(0,0,-plan['crouch']))
    crest=plan.get('crestSupport',0)
    rotations=[plan['lean'],plan['lean'],max(0,plan['lean']-.20)*3.25]
    if crest:
        amount,total=crest,1.85
        rotations=[angle*(1-amount)+total*weight*amount for angle,weight in zip(rotations,(.80,.15,.05))]
    for name,angle in zip(('spine_01','spine_02','spine_03'),rotations):
        _set_world_rotation(rig,name,Quaternion((1,0,0),angle)@rig.pose.bones[name].matrix.to_quaternion())
    if crest:
        for name,angle in [('neck_01',-.40),('head',-.30)]:
            _set_world_rotation(rig,name,Quaternion((1,0,0),angle*crest)@rig.pose.bones[name].matrix.to_quaternion())
    pelvis=rig.pose.bones['pelvis'].head.copy();origin=plan['root']
    for side,sign in [('l',1),('r',-1)]:
        contact=plan['feet'][side];x,height,forward=contact['position']
        target=Vector((x,-(forward-origin['forward']),height-origin['height']))
        tilt=Quaternion((1,0,0),-math.radians(contact['tilt']))
        foot=rig.data.bones['foot_'+side];rotation=(tilt@foot.matrix_local.to_quaternion()).slerp(idle_feet['foot_'+side],contact['restWeight'])
        ankle=target-rotation@data['fittings'][side]
        crest=plan['kneeRise']/.70
        # Keep the trailing knee outside the wall. Once its boot crosses
        # the edge, the knee bends forward above the supported roof foot.
        forward_pole=(-.35*contact['roofWeight']+.30*(1-contact['roofWeight']))*crest-.35*(1-crest)
        # Set the bend plane while the boot still supports a rung, before
        # its fast lift crosses the hip. Changing it during the lift would
        # simply move the knee snap to the start of the roof-step interval.
        entering=max(0,min(1,(t-.48)/.10));entering=entering*entering*(3-2*entering)
        standing=max(0,min(1,(t-.91)/.09));standing=standing*standing*(3-2*standing)
        bend=Vector((sign,0,0)).lerp(idle_knees[side],standing).normalized()
        _native_limb(rig,('thigh_'+side,'calf_'+side,'foot_'+side),ankle,pelvis+Vector((sign*(.10+.15*crest),forward_pole,-.25+crest)),bend,entering)
        for name in ('foot_'+side,'ball_'+side):
            _set_world_rotation(rig,name,(tilt@rig.data.bones[name].matrix_local.to_quaternion()).slerp(idle_feet[name],contact['restWeight']))
        contact=plan['hands'][side];x,height,forward=contact['position']
        if contact['weight']<=0:continue
        target=Vector((x,-(forward-origin['forward']),height-origin['height']))
        roof=contact.get('roofWeight',0);turn=Quaternion((1,0,0),-math.pi*.5*roof)
        curl=(1.15 if contact['planted']else .55)*(1-roof)+.10*roof
        # Open the elbow before moving the palm over the lip. A point pole
        # otherwise turns sharply as the folded wrist passes the shoulder.
        arm_bend=max(0,min(1,(t-.76)/.06));arm_bend=arm_bend*arm_bend*(3-2*arm_bend)
        before=_collect(rig)
        _palm_contact(rig,side,target,pelvis+Vector((sign*.40,-.18,.35)),turn@Vector((0,0,-1)),turn@Vector((0,1,0)),curl,arm_bend)
        # Fade the complete arm, including its wrist orientation, back to
        # idle. Position-only fading left a 60-degree final wrist reset.
        _apply_sample(rig,_blend(before,_collect(rig),contact['weight']))
    return _collect(rig)


def metadata(ctx,seconds,reverse=False):
    data=_authoring(ctx);geometry=data['geometry']
    return {'freeHands':['handRight','handLeft'],'sampleRate':60,
        'markers':{'support':round(seconds*(.24 if reverse else .12),6),'crest':round(seconds*(.09 if reverse else .76),6),'roof':round(seconds*(.09 if reverse else .91),6)},
        'climbSupport':{'coordinateSpace':'lower-link-local','height':geometry['height'],'span':geometry['span'],
            'ladderSpan':geometry['ladderSpan'],'roofEdgeSpan':geometry['edgeSpan'],'steps':geometry['steps'],
            'rungRadius':geometry['rungRadius'],'feetRest':data['feet'],'feetBindRest':data['feet_bind']},
        'source':{'type':'native-ladder-contact-authoring','helper':'climbing_motion.py','geometry':'game/climb-geometry.js','reversed':reverse}}
