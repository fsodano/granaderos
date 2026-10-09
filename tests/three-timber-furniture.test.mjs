import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Quaternion,Raycaster,Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildProps}=await import('../web/lib/three/world-props.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482,eps=1e-5,heights={table:.8,bench:.45,chest:.8};
function render(options,input={terrain:{tiles:[]}}){
 const prop={id:'furniture',x:2,y:3,footprint:{width:2,height:1},rotation:0,...options},before=structuredClone(prop),h=prop.obstacleHeight??heights[prop.type];
 Object.freeze(prop.footprint);Object.freeze(prop);
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),group=buildProps('furniture',[prop],input,T,geometry,materials);
 assert.deepEqual(prop,before);group.updateMatrixWorld(true);
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-prop.rotation*Math.PI/180),centre=new Vector3((prop.x+(prop.footprint.width-1)*.5)*T,prop.elevation??0,(prop.y+(prop.footprint.height-1)*.5)*T);
 const swapped=prop.rotation===90||prop.rotation===270,w=(swapped?prop.footprint.height:prop.footprint.width)*T,d=(swapped?prop.footprint.width:prop.footprint.height)*T;
 const point=values=>new Vector3(...values).applyQuaternion(rotation).add(centre),direction=values=>new Vector3(...values).applyQuaternion(rotation);
 return {prop,h,w,d,group,point,hit(position,vector,far,object=group){return new Raycaster(point(position),direction(vector),0,far).intersectObject(object,true);},dispose(){disposeWorldNode(group);geometry.dispose();materials.dispose();}};
}
function assertFootprint(r){
 const b=new Box3().setFromObject(r.group),p=r.prop;
 assert.ok(b.min.x>=(p.x-.5)*T-eps&&b.max.x<=(p.x+p.footprint.width-.5)*T+eps,`${p.type}/${p.rotation}/${p.open}: X bounds`);
 assert.ok(b.min.z>=(p.y-.5)*T-eps&&b.max.z<=(p.y+p.footprint.height-.5)*T+eps,`${p.type}/${p.rotation}/${p.open}: Z bounds`);
 assert.ok(b.min.y>=(p.elevation??0)-eps,'furniture must stay above its floor');
 if(!p.open)assert.ok(Math.abs(b.max.y-(p.elevation??0)-r.h)<eps,'closed furniture must keep its authored height');
 else assert.ok(b.max.y>(p.elevation??0)+r.h+.3,'the open lid must rise above its closed position');
}

test('timber furniture and raised chest lids fit every authored rotation and floor',()=>{
 for(const type of ['table','bench','chest'])for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2},{width:2,height:2},{width:3,height:1},{width:1,height:3}])for(const rotation of [0,90,180,270])for(const elevation of [0,3])for(const open of type==='chest'?[false,true]:[false]){
  const r=render({type,footprint,rotation,elevation,open});assertFootprint(r);r.dispose();
 }
 for(const type of ['table','bench','chest'])for(const rotation of [0,90,180,270]){
  const r=render({type,rotation,obstacleHeight:heights[type]+.12});assertFootprint(r);assert.equal(r.prop.obstacleHeight,heights[type]+.12);r.dispose();
 }
});

test('table and bench boards expose narrow joints above an open frame with edge rails',()=>{
 for(const type of ['table','bench'])for(const rotation of [0,90,180,270]){
  const r=render({type,rotation}),depth=r.d*(type==='bench'?.35:.68);let runs=0,inside=false,gapSamples=0;
  // Sample the visible top, without reaching its underside or the frame.
  for(let n=0;n<400;n++){
   const hit=r.hit([0,r.h+.02,-depth*.5+(n+.5)*depth/400],[0,-1,0],.03).length>0;
   if(hit&&!inside)runs++;if(!hit)gapSamples++;inside=hit;
  }
  assert.ok(runs>=(type==='bench'?2:3)&&runs<=(type==='bench'?4:6),`${type} must have separate boards`);
  assert.ok(gapSamples>0&&gapSamples*depth/400<.05,'joints must remain narrow');
  assert.equal(r.hit([0,r.h-.09,0],[0,-1,0],r.h).length,0,'the centre below the boards must stay open');
  assert.ok(r.hit([r.w*.5,r.h-.18,0],[-1,0,0],r.w).length>0,'an edge rail must support the board assembly');
  const contact=r.hit([r.w*.80*.40,r.h-.072,.02],[0,1,0],.004);
  assert.ok(contact.length>=2,'edge rails must touch the boards without a floating gap');
  for(const hit of contact)assert.ok(Math.abs(hit.point.y-(r.h-.07))<eps);r.dispose();
 }
});

test('closed timber chest rests on its rim; its raised lid exposes the hollow body',()=>{
 for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2}])for(const rotation of [0,90,180,270]){
  const closed=render({type:'chest',footprint,rotation}),open=render({type:'chest',footprint,rotation,open:true}),cd=closed.d*.51;
  const closedHit=closed.hit([0,closed.h+cd+1,-cd*.20],[0,-1,0],closed.h+cd+1)[0],openHit=open.hit([0,open.h+cd+1,-cd*.20],[0,-1,0],open.h+cd+1)[0];
  assert.ok(closedHit&&closedHit.point.y>closed.h-.02,'closed boards must cover the cavity');
  assert.ok(openHit&&openHit.point.y<open.h*.20,'the open chest must reveal the low interior floor');
  assert.equal(openHit.object.material.name,'world:darkwood');
  const dark=closed.group.children.find(mesh=>mesh.material.name==='world:darkwood'),contact=closed.hit([closed.w*.68*.31,closed.h-.102,-cd*.5+.0175],[0,1,0],.004,dark);
  assert.ok(contact.length>=2,'rim and underside batten must meet without a floating gap');
  for(const hit of contact)assert.ok(Math.abs(hit.point.y-(closed.h-.10))<eps);
  closed.dispose();open.dispose();
 }
});

test('chest handles have open centres and the lid carries its straps through each rotation',()=>{
 for(const rotation of [0,90,180,270])for(const open of [false,true]){
  const r=render({type:'chest',rotation,open}),cw=r.w*.68,cd=r.d*.51,iron=r.group.children.find(mesh=>mesh.material.name==='world:iron');
  for(const side of [-1,1]){
   assert.ok(r.hit([side*(cw*.5+.15),r.h*.44-.033,0],[-side,0,0],.15,iron).length>0,'a side handle must have a lower grip');
   assert.equal(r.hit([side*(cw*.5+.15),r.h*.44,0],[-side,0,0],.15,iron).length,0,'a side handle must retain its opening');
   assert.ok(r.hit([side*cw*.31,r.h-.05,cd*.5+.1],[0,0,-1],.13,iron).length>0,'both rear hinges must retain their pins');
   const q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),open?Math.PI*.42:0),normal=new Vector3(0,1,0).applyQuaternion(q),surface=new Vector3(side*cw*.31,.05,-cd*.40).applyQuaternion(q).add(new Vector3(0,r.h-.05,cd*.5));
   const hit=r.hit(surface.clone().addScaledVector(normal,.05).toArray(),normal.clone().negate().toArray(),.06,iron)[0];
   assert.ok(hit,'lid straps must move with the boards');
  }r.dispose();
 }
});

test('stone furniture keeps solid slabs and furniture detail stays within shared material budgets',()=>{
 for(const type of ['table','bench']){
  const r=render({type,material:'stone'});assert.ok(r.hit([0,r.h-.09,0],[0,-1,0],r.h).length>0,'stone apron must retain its solid form');
  assert.equal(r.group.children.some(mesh=>mesh.material.name==='world:wood'),false);r.dispose();
 }
 for(const rotation of [0,90,180,270])for(const open of [false,true]){
  const r=render({type:'chest',material:'stone',rotation,open});assertFootprint(r);
  assert.equal(r.group.children.some(mesh=>mesh.material.name==='world:wood'),false);r.dispose();
 }
 for(const type of ['table','bench','chest'])for(const footprint of [{width:1,height:1},{width:2,height:1},{width:3,height:3}])for(const open of type==='chest'?[false,true]:[false]){
  const r=render({type,footprint,open}),triangles=r.group.children.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,0);
  assert.ok(triangles<={table:216,bench:144,chest:528}[type],`${type}: ${triangles} triangles exceeds its fixed detail budget`);
  assert.equal(r.group.children.length,{table:2,bench:1,chest:3}[type],'detail must reuse the existing material batches');
  r.dispose();
 }
});

test('chest lid construction uses the same admitted illumination as its body',()=>{
 for(const open of [false,true]){
  const r=render({type:'chest',open},{terrain:{tiles:[],night:true},illumination:{'0:2,3':.25}}),expected=.27+.73*.25;
  for(const mesh of r.group.children)for(const value of mesh.geometry.getAttribute('color').array)assert.ok(Math.abs(value-expected)<eps,'lid transforms must not apply illumination twice');
  r.dispose();
 }
});

test('chest state changes replace and dispose their batch while unchanged states reuse it',()=>{
 const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path}),prop=Object.freeze({id:'chest',type:'chest',x:2,y:3,open:false,obstacleHeight:.8,blocksMovement:true,footprint:Object.freeze({width:1,height:1})}),input={terrain:{tiles:[],props:[prop]}};
 world.update(input);const root=scene.getObjectByName('sector-world'),closed=root.getObjectByName('props:0:0,0');let released=0;
 for(const mesh of closed.children)mesh.geometry.addEventListener('dispose',()=>released++);
 world.update(input);assert.equal(root.getObjectByName('props:0:0,0'),closed);
 const opened={terrain:{tiles:[],props:[{...prop,open:true}]}};world.update(opened);const open=root.getObjectByName('props:0:0,0');
 assert.notEqual(open,closed);assert.equal(released,closed.children.length);assert.ok(new Box3().setFromObject(open).max.y>prop.obstacleHeight+.3);
 world.update(opened);assert.equal(root.getObjectByName('props:0:0,0'),open);assert.equal(prop.open,false);assert.equal(prop.obstacleHeight,.8);assert.equal(prop.blocksMovement,true);
 world.dispose();world.dispose();assert.equal(released,closed.children.length);
});
