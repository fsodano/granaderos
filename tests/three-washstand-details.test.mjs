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
const T=1.2360585147470482,eps=1e-5;
// Exact wood/darkwood frame positions before the piece14 additions at ae02697e.
const frameHashes={
 0:'fcd15cf9e750890f1515f579dfa922d7340ab49feb0fe1b34f5f5cde770e70a8',
 90:'57e80abb3c876df072c89ae2c59996f9129a2027cacffed5f6ea5227ec1cbcdb',
 180:'287ab034876b00e32c88fcbcf000dce0d964aed3efb3b2c17dc615d713ff7b1b',
 270:'fa58ad241367a061e91a36677c14a927c4d0eae1560d5f4528e1569c7abacc99'
};
function render(options={},input={terrain:{tiles:[]}}){
 const prop={id:'washstand',type:'washstand',x:2,y:3,footprint:{width:1,height:1},rotation:0,...options},before=structuredClone(prop),h=prop.obstacleHeight??.8;
 Object.freeze(prop.footprint);Object.freeze(prop);
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),group=buildProps('washstand',[prop],input,T,geometry,materials),pieces=[];
 assert.deepEqual(prop,before);group.updateMatrixWorld(true);
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-prop.rotation*Math.PI/180),centre=new Vector3((prop.x+(prop.footprint.width-1)*.5)*T,prop.elevation??0,(prop.y+(prop.footprint.height-1)*.5)*T),swapped=prop.rotation===90||prop.rotation===270;
 const w=(swapped?prop.footprint.height:prop.footprint.width)*T,d=(swapped?prop.footprint.width:prop.footprint.height)*T,point=values=>new Vector3(...values).applyQuaternion(rotation).add(centre),direction=values=>new Vector3(...values).applyQuaternion(rotation);
 const mesh=kind=>group.children.find(child=>child.material.name===`world:${kind}`);
 const piece=kind=>{
  const names=['basin','pitcher','handle'],ceramic=mesh('ceramic'),source=ceramic.geometry.getAttribute('position').array;let start=0;
  for(const name of names){const primitive=geometry.get(`washstand-${name}`),count=primitive.index?.count??primitive.getAttribute('position').count;if(name===kind){const shape=new BufferGeometry().setAttribute('position',new BufferAttribute(source.slice(start*3,(start+count)*3),3)),item=new Mesh(shape,ceramic.material);item.updateMatrixWorld(true);pieces.push(item);return item;}start+=count;}
  throw Error(`Unknown ceramic assembly ${kind}`);
 };
 return {prop,h,w,d,group,mesh,piece,point,hit(position,vector,far,object=group){return new Raycaster(point(position),direction(vector),0,far).intersectObject(object,true);},dispose(){for(const item of pieces)item.geometry.dispose();disposeWorldNode(group);geometry.dispose();materials.dispose();}};
}

test('complete washstands retain floor, gameplay height and authored cells at all rotations',()=>{
 for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2},{width:2,height:2},{width:8,height:8}])for(const rotation of [0,90,180,270])for(const elevation of [0,3])for(const obstacleHeight of [.4,.8,1]){
  const r=render({footprint,rotation,elevation,obstacleHeight,blocksMovement:true}),b=new Box3().setFromObject(r.group),p=r.prop;
  assert.ok(b.min.x>=(p.x-.5)*T-eps&&b.max.x<=(p.x+p.footprint.width-.5)*T+eps,'every detail must fit its X cells');
  assert.ok(b.min.z>=(p.y-.5)*T-eps&&b.max.z<=(p.y+p.footprint.height-.5)*T+eps,'every detail must fit its Z cells');
  assert.ok(Math.abs(b.min.y-elevation)<eps,'original legs must meet the floor');assert.ok(Math.abs(b.max.y-(elevation+obstacleHeight+.24))<eps,'the complete visual height must include the 24 cm jug');
  assert.equal(p.obstacleHeight,obstacleHeight);assert.equal(p.blocksMovement,true);r.dispose();
 }
});

test('washstand construction retains the original frame position bytes and tabletop height',()=>{
 for(const rotation of [0,90,180,270]){
  const r=render({rotation}),hash=createHash('sha256');for(const kind of ['wood','darkwood'])hash.update(r.mesh(kind).geometry.getAttribute('position').array);
  assert.equal(hash.digest('hex'),frameHashes[rotation]);const top=r.hit([0,r.h+.01,0],[0,-1,0],.02,r.mesh('wood'))[0];assert.ok(top&&Math.abs(top.point.y-r.h)<eps);r.dispose();
 }
});

test('basin and jug rest on the tabletop while water remains below the basin rim',()=>{
 for(const rotation of [0,90,180,270]){
  const r=render({rotation}),basin=r.piece('basin'),pitcher=r.piece('pitcher'),wood=r.mesh('wood'),water=r.mesh('water');
  for(const [x,z,item]of [[0,0,basin],[r.w*.29,-r.d*.16,pitcher]]){
   const foot=r.hit([x,r.h-.002,z],[0,1,0],.004,item)[0],top=r.hit([x,r.h+.002,z],[0,-1,0],.004,wood)[0];assert.ok(foot&&top&&Math.abs(foot.point.y-top.point.y)<eps,'vessels must touch the table');
  }
  const surface=r.hit([0,r.h+.20,0],[0,-1,0],.20,water)[0],floor=r.hit([0,r.h+.20,0],[0,-1,0],.20,basin)[0];
  assert.ok(surface&&floor&&surface.point.y>floor.point.y+.03);assert.ok(Math.abs(surface.point.y-(r.h+.098))<eps);
  assert.ok(new Box3().setFromObject(basin).max.y>surface.point.y+.04,'water must stay inside the rim');
  const position=water.geometry.getAttribute('position'),centre=r.point([0,r.h+.098,0]);let edges=0;
  for(let n=0;n<position.count;n++){
   const vertex=new Vector3().fromBufferAttribute(position,n),radial=vertex.clone().sub(centre);radial.y=0;
   if(Math.abs(vertex.y-centre.y)<eps&&radial.length()>.1){edges++;assert.ok(new Raycaster(vertex,radial.normalize(),0,.03).intersectObject(basin,true).length>0,'every actual water edge must face an enclosing basin wall');}
  }
  assert.ok(edges>=12);
  r.dispose();
 }
});

test('jug neck and D handle stay open, with handle attachments inside the vessel walls',()=>{
 for(const rotation of [0,90,180,270]){
  const r=render({rotation}),x=r.w*.29,z=-r.d*.16,pitcher=r.piece('pitcher'),handle=r.piece('handle');
  const mouth=r.hit([x,r.h+.30,z],[0,-1,0],.30,pitcher)[0];assert.ok(mouth&&mouth.point.y<r.h+.04,'the neck must open into the jug cavity');
  assert.equal(r.hit([x+.086,r.h+.122,z+.1],[0,0,-1],.2,handle).length,0,'the handle must have a real opening');
  assert.ok(r.hit([x+.099,r.h+.122,z+.1],[0,0,-1],.2,handle).length>0,'the outside grip must remain present');
  for(const [y,attachment]of [[.072,.061],[.172,.061-.22*.038]]){
   const wall=r.hit([x,r.h+y,z],[1,0,0],.15,pitcher);assert.ok(wall.length>=2);assert.ok(attachment>wall[0].distance&&attachment<wall.at(-1).distance,'handle ends must enter the ceramic wall');
  }
  const p=pitcher.geometry.getAttribute('position'),inverse=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),rotation*Math.PI/180),centre=new Vector3(r.prop.x*T,0,r.prop.y*T);let lip=false;
  for(let n=0;n<p.count;n++){const v=new Vector3().fromBufferAttribute(p,n).sub(centre).applyQuaternion(inverse);lip||=v.y>r.h+.23&&v.x<x-.058;}assert.ok(lip,'a small pouring lip must point towards the basin');r.dispose();
 }
});

test('folded towel rests on the table and hangs clear of the front legs and floor',()=>{
 for(const rotation of [0,90,180,270])for(const obstacleHeight of [.4,.8,1]){
  const r=render({rotation,obstacleHeight}),linen=r.mesh('linen'),wood=r.mesh('wood'),x=-r.w*.25,z=r.d*.18;
  const cloth=r.hit([x,r.h+.01,z],[0,-1,0],.02,linen)[0],top=r.hit([x,r.h+.01,z],[0,-1,0],.02,wood)[0];assert.ok(cloth&&top&&Math.abs(cloth.point.y-top.point.y)<eps,'a towel trough must touch the table');
  const b=new Box3().setFromObject(linen);assert.ok(b.min.y>.03&&b.min.y<r.h-.25,'the hanging portion must stay above the floor');
  const low=r.hit([x,r.h-.20,r.d*.60],[0,0,-1],r.d*.50,linen)[0];assert.ok(low,'the front drape must retain its folded surface');
  assert.equal(r.hit([x,r.h-.20,r.d*.60],[0,0,-1],r.d*.30,wood).length,0,'the front cloth must clear the legs and apron');r.dispose();
 }
});

test('washstand details have a fixed cost, shared materials, admitted lighting and owned cached forms',()=>{
 for(const material of ['wood','stone']){
  const r=render({material},{terrain:{tiles:[],night:true},illumination:{'0:2,3':.25}}),triangles=r.group.children.reduce((sum,item)=>sum+(item.geometry.index?.count??item.geometry.getAttribute('position').count)/3,0);
  assert.equal(triangles,864);assert.deepEqual(r.group.children.map(item=>item.material.name),[`world:${material}`,'world:darkwood','world:ceramic','world:water','world:linen']);
  for(const item of r.group.children)for(const attribute of ['position','normal','uv','color'])for(const value of item.geometry.getAttribute(attribute).array)assert.ok(Number.isFinite(value));
  for(const item of r.group.children)for(const value of item.geometry.getAttribute('color').array)assert.ok(Math.abs(value-(.27+.73*.25))<eps);r.dispose();
 }
 const geometry=new WorldGeometry();let released=0;
 for(const kind of ['washstand-basin','washstand-pitcher','washstand-handle','washstand-towel']){const first=geometry.get(kind);assert.equal(geometry.get(kind),first);first.addEventListener('dispose',()=>released++);}
 geometry.dispose();geometry.dispose();assert.equal(released,4);
});

test('multiple washstands share material batches and removed details dispose once',()=>{
 const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path}),props=[{id:'wash-a',type:'washstand',x:2,y:3},{id:'wash-b',type:'washstand',x:4,y:3}],input={terrain:{tiles:[],props}};
 world.update(input);const root=scene.getObjectByName('sector-world'),batch=root.getObjectByName('props:0:0,0');assert.equal(batch.children.length,5);
 assert.equal(world.inspect().triangles,864*2);let released=0;for(const item of batch.children)item.geometry.addEventListener('dispose',()=>released++);
 world.update(input);assert.equal(root.getObjectByName('props:0:0,0'),batch);
 world.update({terrain:{tiles:[],props:[]}});assert.equal(released,5);assert.deepEqual(world.inspect().semanticIds,[]);
 world.dispose();world.dispose();assert.equal(released,5);
});
