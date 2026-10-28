import test from 'node:test';
import assert from 'node:assert/strict';
import{banks,sampleBank}from'./character-bank-fixture.mjs';
import{Vector3,Matrix4,Quaternion}from'../web/node_modules/three/build/three.module.js';
for(const[gender,bank]of Object.entries(banks))test(`${gender} task and crouched punch wrists remain native and clear the floor`,()=>{
const skin=bank.body.json.skins[0],names=skin.joints.map(i=>bank.body.json.nodes[i].name),inverse=bank.body.access(skin.inverseBindMatrices),bind=names.map((_,i)=>new Matrix4().fromArray(inverse,i*16)),vertices=[];
for(const node of bank.body.json.nodes){if(node.mesh===undefined||node.skin===undefined||!/(skin|outfit)/.test(node.name))continue;for(const prim of bank.body.json.meshes[node.mesh].primitives){const p=bank.body.access(prim.attributes.POSITION),j=bank.body.access(prim.attributes.JOINTS_0),w=bank.body.access(prim.attributes.WEIGHTS_0);for(let i=0;i<p.length/3;i++){const js=j.slice(i*4,i*4+4),ws=w.slice(i*4,i*4+4);let kind=node.name.includes('skin')?'hand':'sleeve';if(ws.reduce((s,v,k)=>s+((kind==='hand'?/^(hand_|thumb_|index_|middle_|ring_|pinky_)/:/^lowerarm_/).test(names[js[k]])?v:0),0)<.5)continue;vertices.push({p:new Vector3().fromArray(p,i*3),j:js,w:ws,kind});}}}
for(const spec of bank.specs.filter(s=>['pickup','heal','free'].includes(s.gesture)||s.name==='crouch.punch.unarmed')){
const min={hand:{height:Infinity},sleeve:{height:Infinity}},n=Math.ceil(spec.duration*120); let previous=null;
sampleBank(bank,spec.name,Array.from({length:n+1},(_,i)=>i/n),(point,scene,time)=>{const matrices=names.map((name,i)=>new Matrix4().multiplyMatrices(scene.getObjectByName(name).matrixWorld,bind[i]));for(const v of vertices){const p=new Vector3();for(let k=0;k<4;k++)if(v.w[k])p.addScaledVector(v.p.clone().applyMatrix4(matrices[v.j[k]]),v.w[k]);if(p.y<min[v.kind].height)min[v.kind]={height:p.y,time};}const frame={time,wrists:['l','r'].map(side=>point('hand_'+side)),joints:['upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r'].map(name=>scene.getObjectByName(name).quaternion.clone())};
for(const side of['l','r']){const hand=point('hand_'+side),angle=point('middle_01_'+side).sub(hand).angleTo(hand.clone().sub(point('lowerarm_'+side)));assert.ok(angle<35*Math.PI/180,`${spec.name} ${side} ${time}: actual palm folds back ${angle*180/Math.PI} degrees`);}
if(spec.name.startsWith('stand.gesture.')&&Math.abs(time-spec.duration*.5)<.0042){
 const palm=point('hand_r').lerp(point('middle_01_r'),.72),pelvis=point('pelvis');
 assert.ok(Math.hypot(palm.x-(pelvis.x-.12),palm.z-(pelvis.z+.43))<.001,`${spec.name}: the low work hand keeps its horizontal contact point`);
}
if(spec.name==='crouch.punch.unarmed'){
 const palm=point('middle_01_r').sub(point('hand_r')).normalize();
 for(const finger of['index','middle','ring','pinky'])assert.ok(point(finger+'_03_r').sub(point(finger+'_02_r')).normalize().dot(palm)<-.7,`${spec.name}: ${finger} closes back into the palm rather than forming a claw`);
}
if(previous){
 for(let k=0;k<2;k++)assert.ok(frame.wrists[k].distanceTo(previous.wrists[k])/(time-previous.time)<4,`${spec.name} ${time}: wrist position is continuous`);
 for(let k=0;k<frame.joints.length;k++)assert.ok(frame.joints[k].angleTo(previous.joints[k])/(time-previous.time)<20,`${spec.name} ${time}: arm joint ${k} has no compressed-chain reversal`);
}previous=frame;
return{};});
for(const[kind,value]of Object.entries(min))assert.ok(value.height>-.002,`${spec.name} ${value.time}: actual ${kind} surface crosses the floor by ${-value.height} m`);
} 
});
