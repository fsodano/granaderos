import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {publishedActor} from './published-actor-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');

const assets=new Map();
const held={unarmed:null,'long-gun':1800,'short-gun':1805,blade:1810,knife:1813,lance:1812};
async function fixture(appearance,equipment,posture){
  if(!assets.has(appearance))assets.set(appearance,await publishedActor(appearance,0));
  const asset=assets.get(appearance),visual={key:'unit:transition',id:'transition',kind:'unit',appearance,skin:'light',side:'player',position:[0,0,0],yaw:0,tacticalLevel:0,posture,mounted:false,action:'idle',idleAction:'idle',equipment:['knife','lance'].includes(equipment)?'blade':equipment,items:held[equipment]?[{id:String(held[equipment]),reference:'primary',socket:'handRight'}]:[],garments:{},selected:false,bodyHeights:{}};
  const actor=new ActorRuntime(asset,visual),mesh=actor.model.getObjectByName('Human_footwear_LOD0'),boots={l:[],r:[]};
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)boots[mesh.geometry.attributes.position.getX(i)>0?'l':'r'].push(i);
  assert.ok(boots.l.length>200&&boots.r.length>200,'Use each complete boot, including heel, toe and ankle');
  const point=i=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
  const lowest=side=>{let height=Infinity,index;for(const i of boots[side]){const y=point(i).y;if(y<height){height=y;index=i;}}return{height,index};};
  return{asset,visual,actor,mesh,boots,point,lowest};
}
const snapshotGoals=plan=>JSON.stringify([...plan.final].map(([side,goal])=>[side,goal.p.toArray(),goal.q.toArray(),goal.knee?.toArray(),goal.height]));
const leg=/^(thigh|calf|foot)_[lr]$/;

for(const appearance of ['granadero','woman-scout'])for(const posture of ['standing','crouched'])for(const equipment of posture==='standing'?['unarmed','long-gun','short-gun','blade','knife','lance']:['unarmed'])for(const direction of ['Left','Right'])for(const firstFrame of [0,1/60,1/30]){
  test(`${appearance} ${posture} ${equipment} ${direction} first frame ${firstFrame} retains full boot support through normal start and stop`,async()=>{
    const f=await fixture(appearance,equipment,posture),support=f.actor.gaitSupport,spec=f.asset.clips.find(c=>c.name===`${posture==='standing'?'stand':'crouch'}.strafe${direction}.${equipment}`);
    assert.ok(spec?.nativeSidewaysSupport,'The selected source loop must have measured native support');
    const speed=(spec.nativeStrideSpeed??spec.locomotionSpeed)*.8,span=TILE_METRES*2/speed,dt=1/60,sign=direction==='Left'?1:-1;
    const nodes=[];f.actor.model.traverse(n=>{if(n.isBone)nodes.push(n);});
    const apply=support.apply.bind(support);let ordinary=0,bodyDrop=0,maxContact=0,maxRelease=0,maxRecovery=0,activeTicks=0;
    support.apply=(...args)=>{
      f.actor.root.updateWorldMatrix(true,true);
      const before=nodes.map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}));
      apply(...args);f.actor.root.updateWorldMatrix(true,true);
      for(const {n,p,q,s}of before){
        assert.deepEqual(n.scale.toArray(),s.toArray(),n.name+' keeps native scale');
        if(n.name==='Root'){assert.equal(n.position.x,p.x);assert.equal(n.position.z,p.z);assert.ok(Math.abs(n.position.y-p.y+support.maximumBodyDrop)<1e-7);}
        else assert.deepEqual(n.position.toArray(),p.toArray(),n.name+' keeps native joint offset');
        if(!leg.test(n.name)||!support.adjusted)assert.deepEqual(n.quaternion.toArray(),q.toArray(),n.name+' keeps native rotation');
      }
      if(!support.adjusted)ordinary++;
    };
    let prior=[],priorActive=false,priorSide='',previousPlan,finalGoals;
    try{
      for(let i=0;i<=Math.ceil((span+1.8)*60);i++){
        const wall=i*dt,moving=wall>=.5+firstFrame-.00001&&wall<.5+span,distance=speed*Math.max(0,Math.min(span,wall-.5));
        const visual={...f.visual,action:moving?`strafe${direction}`:'idle',position:[sign*distance,0,0],motion:{moving,elapsedDistance:distance/TILE_METRES,speed:moving?speed/TILE_METRES:0}};
        f.actor.update(visual,wall*1000);f.actor.tick(dt,wall*1000);f.actor.root.updateMatrixWorld(true);f.mesh.skeleton.update();
        assert.deepEqual(f.actor.root.position.toArray(),visual.position,'Keep exact saved travel placement');assert.equal(f.actor.root.rotation.y,0);
        assert.equal(support.rejectedFits,0,'Normal measured source admission must not cancel halfway');
        const l=f.lowest('l'),r=f.lowest('r');assert.ok(Math.min(l.height,r.height)>.0005,'Complete boot clearance '+Math.min(l.height,r.height));
        if(support.plan){
          activeTicks++;assert.ok(Math.min(l.height,r.height)<.0035,'At least one complete boot stays planted');
          if(support.plan!==previousPlan){finalGoals=snapshotGoals(support.plan);previousPlan=support.plan;}
          assert.equal(snapshotGoals(support.plan),finalGoals,'The native final knee and foot targets are immutable');
          const side=support.supportSide;
          if(side&&side===priorSide&&priorActive){const p=f.point(f.lowest(side).index),v=p.clone().sub(prior[f.lowest(side).index]).divideScalar(dt);maxContact=Math.max(maxContact,Math.hypot(v.x,v.z));}
        }
        const current=[];
        for(let index=0;index<f.mesh.geometry.attributes.position.count;index++){
          const p=f.point(index);if(priorActive){const v=p.distanceTo(prior[index])/dt;if(support.plan)maxRecovery=Math.max(maxRecovery,v);else maxRelease=Math.max(maxRelease,v);}current.push(p);
        }
        bodyDrop=Math.max(bodyDrop,support.maximumBodyDrop);prior=current;priorActive=Boolean(support.plan);priorSide=support.supportSide;
      }
      assert.ok(activeTicks>40&&ordinary>40,'Cover both temporary fit and ordinary native playback');
      assert.ok(maxContact<.001,'Planted complete-boot horizontal speed '+maxContact);
      assert.ok(maxRecovery<6.5,'Bound complete-boot recovery speed '+maxRecovery);
      assert.ok(maxRelease<3,'No endpoint body jump '+maxRelease);
      assert.ok(bodyDrop<=.05,'Temporary native Root settle is bounded to 50 mm');
      assert.equal(support.plan,undefined);assert.equal(support.adjusted,false,'Exact native idle is restored');
    }finally{f.actor.dispose();}
  });
}

function transforms(actor){const result=[];actor.model.traverse(n=>{if(n.isBone)result.push([n.name,...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);});return result;}
async function admitted(){const f=await fixture('granadero','unarmed','crouched');for(let i=0;i<30;i++)f.actor.tick(1/60,i*1000/60);const v={...f.visual,action:'strafeLeft',position:[.01,0,0],motion:{moving:true,elapsedDistance:.01/TILE_METRES,speed:f.asset.clips.find(c=>c.name==='crouch.strafeLeft.unarmed').locomotionSpeed*.8/TILE_METRES}};f.actor.update(v,600);f.actor.tick(1/60,600);assert.ok(f.actor.gaitSupport.plan);return{f,v};}
test('a held fitted source phase restores before each mixer evaluation',async()=>{const {f}=await admitted();try{const pose=transforms(f.actor);for(let i=0;i<24;i++){f.actor.tick(0,600);assert.deepEqual(transforms(f.actor),pose,'Flat native mixer values must not accumulate a fit');}}finally{f.actor.dispose();}});
test('changed floor cancels the fit and keeps finite native transforms',async()=>{const {f,v}=await admitted();try{f.actor.update({...v,position:[.01,.2,0]},610);f.actor.tick(1/60,610);assert.equal(f.actor.gaitSupport.plan,undefined);assert.equal(f.actor.gaitSupport.adjusted,false);for(const row of transforms(f.actor))assert.ok(row.slice(1).every(Number.isFinite));assert.deepEqual(f.actor.root.position.toArray(),[.01,.2,0]);}finally{f.actor.dispose();}});
test('unsupported reach uses finite native playback without stretching limbs',async()=>{const f=await fixture('granadero','unarmed','crouched');try{for(let i=0;i<30;i++)f.actor.tick(1/60,i*1000/60);f.actor.update({...f.visual,action:'strafeLeft',position:[.01,0,0],motion:{moving:true,elapsedDistance:.01/TILE_METRES,speed:20/TILE_METRES}},600);f.actor.tick(1/60,600);assert.equal(f.actor.gaitSupport.plan,undefined);assert.equal(f.actor.gaitSupport.adjusted,false);assert.ok(f.actor.gaitSupport.rejectedFits);for(const row of transforms(f.actor))assert.ok(row.slice(1).every(Number.isFinite));}finally{f.actor.dispose();}});
