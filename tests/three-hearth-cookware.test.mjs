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
// Exact stone/brick/ember/log attributes before the piece15 addition at cc1b6f60.
const fabricHashes={
 0:'16fd070e9f47a5bf576b9a9eb65d112ee65b2612245445a827020f328768ac16',
 90:'f38c6ac78b0b191493a27ccd23ebf2b568c6dd990385e7055365bfcf8f22ea17',
 180:'5f86df8b9e161830400cc127e9f748eb4cd512502b266958bf1619c9b6af77ce',
 270:'0ecd2675d75301c3b941c9de95f674734777f41a39493d1be604e03f8f5f8888'
};
function render(options={},input={terrain:{tiles:[]}}){
 const prop={id:'hearth',type:'hearth',x:2,y:3,footprint:{width:1,height:1},rotation:0,...options},before=structuredClone(prop),h=prop.obstacleHeight??.7;
 Object.freeze(prop.footprint);Object.freeze(prop);
 const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path}),group=buildProps('hearth',[prop],input,T,geometry,materials),pieces=[];
 assert.deepEqual(prop,before);group.updateMatrixWorld(true);
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-prop.rotation*Math.PI/180),centre=new Vector3((prop.x+(prop.footprint.width-1)*.5)*T,prop.elevation??0,(prop.y+(prop.footprint.height-1)*.5)*T),swapped=prop.rotation===90||prop.rotation===270;
 const w=(swapped?prop.footprint.height:prop.footprint.width)*T,d=(swapped?prop.footprint.width:prop.footprint.height)*T,lintel=h*.73-.09,outside=lintel<.412,potZ=outside?-d*.265-.145:-d*.265-.012;
 const point=values=>new Vector3(...values).applyQuaternion(rotation).add(centre),direction=values=>new Vector3(...values).applyQuaternion(rotation),mesh=kind=>group.children.find(child=>child.material.name===`world:${kind}`);
 const assemblies=[['pot',geometry.get('hearth-pot').index.count],['bail',geometry.get('hearth-bail').index.count],['hinges',48*3*2],['beam',12*3],...(outside?[['anchor',48*3]]:[['arm',12*3]]),['hanger',48*3]];
 const piece=kind=>{
  const iron=mesh('iron'),source=iron.geometry.getAttribute('position').array;let start=0;
  for(const [name,count]of assemblies){if(name===kind){const shape=new BufferGeometry().setAttribute('position',new BufferAttribute(source.slice(start*3,(start+count)*3),3)),item=new Mesh(shape,iron.material);item.updateMatrixWorld(true);pieces.push(item);return item;}start+=count;}
  throw Error(`Unknown iron assembly ${kind}`);
 };
 return {prop,h,w,d,lintel,outside,potZ,group,mesh,piece,point,hit(position,vector,far,object=group){return new Raycaster(point(position),direction(vector),0,far).intersectObject(object,true);},dispose(){for(const item of pieces)item.geometry.dispose();disposeWorldNode(group);geometry.dispose();materials.dispose();}};
}

test('complete hearths retain floor, obstacle height and authored cells at every rotation',()=>{
 for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2},{width:2,height:2},{width:8,height:8}])for(const rotation of [0,90,180,270])for(const elevation of [0,3])for(const obstacleHeight of [.4,.65,.7,1]){
  const r=render({footprint,rotation,elevation,obstacleHeight,blocksMovement:true}),b=new Box3().setFromObject(r.group),p=r.prop,visualHeight=r.outside?Math.max(obstacleHeight,obstacleHeight*.73+.102,.424):obstacleHeight;
  assert.ok(b.min.x>=(p.x-.5)*T-eps&&b.max.x<=(p.x+p.footprint.width-.5)*T+eps,'all cookware must fit its X cells');
  assert.ok(b.min.z>=(p.y-.5)*T-eps&&b.max.z<=(p.y+p.footprint.height-.5)*T+eps,'all cookware must fit its Z cells');
  assert.ok(Math.abs(b.min.y-elevation)<eps,'the stone base must retain its floor contact');
  assert.ok(Math.abs(b.max.y-elevation-visualHeight)<eps,'the complete height must include the outside arm on low fireboxes');
  assert.equal(p.obstacleHeight,obstacleHeight);assert.equal(p.blocksMovement,true);r.dispose();
 }
});

test('hearth cookware leaves every original stone, brick, ember and log attribute exact',()=>{
 for(const rotation of [0,90,180,270]){
  const r=render({rotation}),hash=createHash('sha256');for(const kind of ['stone','brick','ember','darkwood'])for(const attribute of ['position','normal','uv','color'])hash.update(r.mesh(kind).geometry.getAttribute(attribute).array);
  assert.equal(hash.digest('hex'),fabricHashes[rotation]);assert.equal(r.mesh('ember').material.emissiveIntensity,1.3);
  assert.ok(new Box3().setFromObject(r.piece('pot')).min.y>new Box3().setFromObject(r.mesh('darkwood')).max.y+.004,'the pot must clear the unchanged burning logs');r.dispose();
 }
});

test('the rolled pot rim opens into a cavity and both bail hinges join the iron walls',()=>{
 for(const rotation of [0,90,180,270])for(const obstacleHeight of [.4,.7,1]){
  const r=render({rotation,obstacleHeight}),pot=r.piece('pot'),bail=r.piece('bail'),hinges=r.piece('hinges'),z=r.potZ;
  const floor=r.hit([0,.36,z],[0,-1,0],.20,pot)[0],rim=r.hit([0,.36,z+.133],[0,-1,0],.05,pot)[0];
  assert.ok(floor&&Math.abs(floor.point.y-.192)<eps,'the centre must open down to the interior floor');assert.ok(rim&&Math.abs(rim.point.y-.330)<eps,'the rolled rim must enclose the open mouth');
  assert.equal(r.hit([0,.362,z+.10],[0,0,-1],.20,bail).length,0,'the upright bail must retain its opening');
  assert.ok(r.hit([0,.406,z+.10],[0,0,-1],.20,bail).length>0,'the arch must retain its grip');
  for(const side of [-1,1]){
   const wall=r.hit([0,.318,z],[side,0,0],.20,pot);assert.ok(wall.length>=2);assert.ok(.132>wall[0].distance&&.132<wall.at(-1).distance,'bail ends must enter the iron wall');
   assert.ok(r.hit([side*.137,.318,z+.05],[0,0,-1],.10,hinges).length>0,'each bail end needs a rim-side hinge');
  }
  const potBounds=new Box3().setFromObject(pot);assert.ok(Math.abs(potBounds.max.y-potBounds.min.y-.16)<eps);r.dispose();
 }
});

test('the iron hanger touches the bail, and its beam rests on the preserved lintel',()=>{
 for(const rotation of [0,90,180,270])for(const obstacleHeight of [.4,.65,.7,1]){
  const r=render({rotation,obstacleHeight}),bail=r.piece('bail'),beam=r.piece('beam'),hanger=r.piece('hanger'),stone=r.mesh('stone'),z=r.potZ;
  const arch=r.hit([0,.45,z],[0,-1,0],.07,bail)[0],stem=r.hit([0,.40,z],[0,1,0],.05,hanger)[0];assert.ok(arch&&stem&&arch.point.y>stem.point.y,'the hanger must enter the arch without a floating gap');
  if(r.outside){
   const anchorZ=-r.d*.265+.012,top=r.h*.73+.09,anchor=r.piece('anchor');
   assert.ok(r.hit([0,top-.006,anchorZ],[0,1,0],.04,anchor).length>0,'the outside arm must enter the top stone');
   const stoneTop=r.hit([0,top+.002,anchorZ],[0,-1,0],.004,stone)[0];assert.ok(stoneTop&&Math.abs(stoneTop.point.y-top)<eps);
   assert.equal(r.hit([0,.26,z],[0,0,1],.001,stone).length,0);assert.ok(z+.142<-r.d*.265,'the full pot must stand clear of the lintel face');
  }else{
   const anchorZ=-r.d*.265+.020,header=r.hit([0,r.lintel-.005,anchorZ],[0,1,0],.01,stone)[0],bar=r.hit([.10,r.lintel-.010,anchorZ],[0,1,0],.02,beam)[0];assert.ok(header&&bar&&bar.point.y<header.point.y,'the hanging beam must enter the lintel underside');
   assert.ok(new Box3().setFromObject(bail).max.y<r.lintel,'the free bail arch must clear the stone');
  }
  const beamY=r.outside?Math.max(r.h*.73+.096,.418):r.lintel+.002;
  assert.ok(r.hit([0,beamY-.020,z],[0,1,0],.04,r.outside?beam:r.piece('arm')).length>0);assert.ok(r.hit([0,beamY+.005,z],[0,-1,0],.02,hanger).length>0,'the hanger must enter the supporting beam');r.dispose();
 }
});

test('front placement exposes the pot rim and bail to both native front views',()=>{
 const pitch=Math.asin(14/26),towardsCamera=new Vector3(Math.cos(pitch)/Math.SQRT2,Math.sin(pitch),Math.cos(pitch)/Math.SQRT2);
 for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2}])for(const rotation of [90,180]){
  const r=render({footprint,rotation}),fabric=[r.mesh('stone'),r.mesh('brick'),r.mesh('darkwood')];
  for(const position of [[0,.330,r.potZ-.133],[0,.406,r.potZ]]){
   const target=r.point(position),ray=new Raycaster(target.clone().addScaledVector(towardsCamera,.006),towardsCamera,0,4);assert.equal(ray.intersectObjects(fabric,true).length,0,'the existing fabric must leave the front rim and bail visible');
  }
  assert.ok(r.potZ+.132*.04<-r.d*.265,'the bail must clear the stone front face');r.dispose();
 }
});

test('hearth cookware has bounded cost, one shared iron batch, admitted light and owned caches',()=>{
 for(const obstacleHeight of [.4,.7]){
  const r=render({obstacleHeight},{terrain:{tiles:[],night:true},illumination:{'0:2,3':.25}}),triangles=r.group.children.reduce((sum,item)=>sum+item.geometry.getAttribute('position').count/3,0);
  assert.equal(triangles,r.outside?756:720);assert.deepEqual(r.group.children.map(item=>item.material.name),['world:stone','world:brick','world:ember','world:darkwood','world:iron']);
  for(const item of r.group.children)for(const attribute of ['position','normal','uv','color'])for(const value of item.geometry.getAttribute(attribute).array)assert.ok(Number.isFinite(value));
  for(const item of r.group.children)for(const value of item.geometry.getAttribute('color').array)assert.ok(Math.abs(value-(.27+.73*.25))<eps);
  let lamps=0;r.group.traverse(item=>{if(item.isPointLight)lamps++;});assert.equal(lamps,0,'a hearth prop must not create a new light source');r.dispose();
 }
 const geometry=new WorldGeometry();let released=0;for(const kind of ['hearth-pot','hearth-bail']){const cached=geometry.get(kind);assert.equal(geometry.get(kind),cached);cached.addEventListener('dispose',()=>released++);}
 geometry.dispose();geometry.dispose();assert.equal(released,2);
});

test('hearth batches reuse iron and dispose removed cookware without changing fire expiry rules',()=>{
 const scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path}),props=[{id:'hearth-a',type:'hearth',x:2,y:3},{id:'hearth-b',type:'hearth',x:4,y:3}],source={id:'fire',type:'campfire',x:2,y:3},input={terrain:{tiles:[],props,lights:[source]}};
 world.update(input);const root=scene.getObjectByName('sector-world'),batch=root.getObjectByName('props:0:0,0');assert.equal(batch.children.length,5);
 let released=0;for(const item of batch.children)item.geometry.addEventListener('dispose',()=>released++);
 world.update(input);assert.equal(root.getObjectByName('props:0:0,0'),batch);
 const countLamps=()=>{let count=0;root.traverse(item=>{if(item.isPointLight)count++;});return count;};assert.equal(countLamps(),1);
 for(const change of [{extinguished:true},{turns:0},{remainingSeconds:0}]){world.update({terrain:{...input.terrain,lights:[{...source,...change}]}});assert.equal(countLamps(),0);assert.equal(root.getObjectByName('props:0:0,0'),batch,'light expiry must not rebuild or remove hearth cookware');}
 world.update({terrain:{tiles:[],props:[],lights:[]}});assert.equal(released,5);assert.deepEqual(world.inspect().semanticIds,[]);
 world.dispose();world.dispose();assert.equal(released,5);
});
