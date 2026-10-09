import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,BufferAttribute,BufferGeometry,Mesh,Quaternion,Raycaster,Scene,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildProps}=await import('../web/lib/three/world-props.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482,eps=1e-5,kinds=['shelf-jar','shelf-bottle','shelf-bowl','shelf-jar','shelf-bottle'];
// Complete frame/render attribute fingerprints at committed piece14 cc1b6f60.
const frameHashes={0:'436a24e52f72f0cf52321d8cc7081968c427c6668d81f3b6d5e6a95b07d3fc67',90:'28505ec8811ac9324e4c75e408a18c811f72b224c17d4c41e44a7a561eaf943b',180:'37ba4aed7f403cfab87074218fd397b372ff5ffaf485398e6d9e9218af5676fb',270:'39fa90b9d6283402e72dd032db0a4797272c1e4f1d15c8c68de46b968ab4a723'};
const ledgerHashes={0:'cc9037a1632eb3ee77bd2ab00ab1917cffc291dd122655a9dece0c7a2be9c0a2',90:'3433292d959f5dd9e857ac80564e96a63f89299c43a16f9e0dd0202f537a2c62',180:'43e20f535117eb0c49d70f56be363921594cf97d217b32d37150b3433a411b59',270:'c2116f561d747264a040deb35403772c66402b9703c48afd04220ff406162b86'};
function fingerprint(items){const hash=createHash('sha256');for(const mesh of items){hash.update(mesh.material.name);for(const name of ['position','normal','uv','color'])hash.update(mesh.geometry.getAttribute(name).array);}return hash.digest('hex');}
function render(options={},input={terrain:{tiles:[]}}){
 const prop={id:'shelf',type:'shelf',x:2,y:3,footprint:{width:1,height:1},purpose:'kitchen',rotation:0,...options},before=structuredClone(prop),h=prop.obstacleHeight??1.5,scale=Math.min(1,Math.max(0,Math.min(h*.30-.06,h*.35-.10))*.94/.257);
 Object.freeze(prop.footprint);Object.freeze(prop);
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:x=>x}),group=buildProps('shelf',[prop],input,T,geometry,materials),pieces=[];assert.deepEqual(prop,before);group.updateMatrixWorld(true);
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-prop.rotation*Math.PI/180),centre=new Vector3((prop.x+(prop.footprint.width-1)*.5)*T,prop.elevation??0,(prop.y+(prop.footprint.height-1)*.5)*T),swapped=prop.rotation===90||prop.rotation===270;
 const w=(swapped?prop.footprint.height:prop.footprint.width)*T,d=(swapped?prop.footprint.width:prop.footprint.height)*T,point=values=>new Vector3(...values).applyQuaternion(rotation).add(centre),direction=values=>new Vector3(...values).applyQuaternion(rotation);
 const mesh=kind=>group.children.find(item=>item.material.name===`world:${kind}`);
 const piece=n=>{const source=mesh(n%2?'ceramic':'food');let start=0;for(let i=n%2;i<n;i+=2)start+=geometry.get(kinds[i]).index.count;const count=geometry.get(kinds[n]).index.count,shape=new BufferGeometry();for(const name of ['position','normal','uv','color']){const attribute=source.geometry.getAttribute(name);shape.setAttribute(name,new BufferAttribute(attribute.array.slice(start*attribute.itemSize,(start+count)*attribute.itemSize),attribute.itemSize));}const item=new Mesh(shape,source.material);item.updateMatrixWorld(true);pieces.push(item);return item;};
 return {prop,h,w,d,scale,group,geometry,materials,mesh,piece,point,hit(position,vector,far,object=group){return new Raycaster(point(position),direction(vector),0,far).intersectObject(object,true);},dispose(){for(const item of pieces)item.geometry.dispose();disposeWorldNode(group);geometry.dispose();materials.dispose();}};
}

test('shelf frame and office/archive ledgers keep complete baseline render attributes at every rotation',()=>{
 for(const purpose of ['kitchen','office','archive'])for(const rotation of [0,90,180,270]){
  const r=render({purpose,rotation,footprint:{width:2,height:1}});assert.equal(fingerprint(purpose==='kitchen'?[r.mesh('wood')]:r.group.children),purpose==='kitchen'?frameHashes[rotation]:ledgerHashes[rotation]);
  assert.deepEqual(r.group.userData.semanticIds,['prop:shelf']);if(purpose!=='kitchen')assert.ok(!r.mesh('food')&&!r.mesh('ceramic'));r.dispose();
 }
});

test('all five vessels rest on board tops and retain hollow openings with rolled lips',()=>{
 for(const rotation of [0,90,180,270])for(const elevation of [0,3])for(const obstacleHeight of [.4,.8,1.5,2]){
  const r=render({rotation,elevation,obstacleHeight});
  for(let n=0;n<5;n++){
   const vessel=r.piece(n),x=(n-2)*r.w*.74*.15,base=r.h*(n%2?.65:.35)+.03,shape=r.geometry.get(kinds[n]);shape.computeBoundingBox();const top=shape.boundingBox.max.y*r.scale;
   const foot=r.hit([x,base-.002,0],[0,1,0],.004,vessel)[0],board=r.hit([x,base+.002,0],[0,-1,0],.004,r.mesh('wood'))[0];assert.ok(foot&&board&&Math.abs(foot.point.y-board.point.y)<eps,'vessel foot must touch the existing board');
   const mouth=r.hit([x,base+top+.02,0],[0,-1,0],top+.02,vessel)[0];assert.ok(mouth&&mouth.point.y<elevation+base+top*.30,'centre ray must enter the cavity, without a closed cap');
   const radius=kinds[n]==='shelf-bowl'?.064:kinds[n]==='shelf-jar'?.036:.020,lip=r.hit([x+radius,base+top+.02,0],[0,-1,0],.03,vessel)[0];assert.ok(lip&&Math.abs(lip.point.y-(elevation+base+top))<eps,'rolled lip must surround the opening');
   assert.ok(base+top<r.h*(n%2?1:.65)-(n%2?.07:.03),'contents must remain below the next board');
  }r.dispose();
 }
});

test('varied vessel silhouettes stay inside authoritative shelf cells and gameplay height',()=>{
 const heights=new Set();for(const kind of new Set(kinds)){const geometry=new WorldGeometry(),shape=geometry.get(kind);shape.computeBoundingBox();heights.add(shape.boundingBox.max.y.toFixed(3));assert.ok(shape.boundingBox.min.y===0&&Math.max(Math.abs(shape.boundingBox.min.x),shape.boundingBox.max.x,Math.abs(shape.boundingBox.min.z),shape.boundingBox.max.z)<=.070001);geometry.dispose();}assert.equal(heights.size,3);
 for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2},{width:2,height:2}])for(const rotation of [0,90,180,270])for(const elevation of [0,3])for(const obstacleHeight of [.4,.8,1.5,2]){
  const r=render({footprint,rotation,elevation,obstacleHeight,blocksMovement:false}),b=new Box3().setFromObject(r.group),p=r.prop;
  assert.ok(b.min.x>=(p.x-.5)*T-eps&&b.max.x<=(p.x+p.footprint.width-.5)*T+eps);assert.ok(b.min.z>=(p.y-.5)*T-eps&&b.max.z<=(p.y+p.footprint.height-.5)*T+eps);
  assert.ok(Math.abs(b.min.y-elevation)<eps&&Math.abs(b.max.y-elevation-obstacleHeight)<eps);assert.equal(p.blocksMovement,false);assert.equal(p.obstacleHeight,obstacleHeight);r.dispose();
 }
});

test('vessels have bounded geometry cost, existing material batches and admitted room light',()=>{
 for(const material of ['wood','stone']){
  const r=render({material},{terrain:{tiles:[],night:true},illumination:{'0:2,3':.25}}),light=.27+.73*.25;
  assert.equal(r.group.children.reduce((sum,item)=>sum+item.geometry.getAttribute('position').count/3,0),1048);assert.deepEqual(r.group.children.map(item=>item.material.name),[`world:${material}`,'world:food','world:ceramic']);
  for(const item of r.group.children)for(const attribute of ['position','normal','uv','color'])for(const value of item.geometry.getAttribute(attribute).array)assert.ok(Number.isFinite(value));
  for(let n=0;n<5;n++){const actual=r.piece(n).geometry.getAttribute('color').array,source=r.geometry.get(kinds[n]).toNonIndexed();for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-source.getAttribute('color').array[i]*light)<eps);source.dispose();}r.dispose();
 }
 const geometry=new WorldGeometry();let released=0;for(const kind of new Set(kinds)){const first=geometry.get(kind);assert.equal(geometry.get(kind),first);first.addEventListener('dispose',()=>released++);}geometry.dispose();geometry.dispose();assert.equal(released,3);
});

test('multiple shelves retain three shared batches, stable cache and exact removal disposal',()=>{
 const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:x=>x}),props=[{id:'shelf-a',type:'shelf',x:2,y:3},{id:'shelf-b',type:'shelf',x:4,y:3}],input={terrain:{tiles:[],props}};
 world.update(input);const root=scene.getObjectByName('sector-world'),batch=root.getObjectByName('props:0:0,0');assert.equal(batch.children.length,3);assert.equal(world.inspect().triangles,1048*2);let released=0;for(const item of batch.children)item.geometry.addEventListener('dispose',()=>released++);
 world.update(input);assert.equal(root.getObjectByName('props:0:0,0'),batch);world.update({terrain:{tiles:[],props:[]}});assert.equal(released,3);assert.deepEqual(world.inspect().semanticIds,[]);world.dispose();world.dispose();assert.equal(released,3);
});
