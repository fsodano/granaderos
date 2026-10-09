import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Quaternion,Ray,Raycaster,Scene,Triangle,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildProps}=await import('../web/lib/three/world-props.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const T=1.2360585147470482,eps=1e-5,options={tileMetres:T,assetUrl:p=>p};
const streams=group=>group.children.map(m=>({material:m.material.name,attributes:Object.fromEntries(['position','normal','uv','color'].map(name=>[name,Array.from(m.geometry.getAttribute(name).array)]))}));
function render(type,extra={},input={terrain:{tiles:[]}}){
 const prop={id:type,type,x:2,y:3,footprint:{width:1,height:1},rotation:0,...extra},before=structuredClone(prop),geometry=new WorldGeometry(),materials=new WorldMaterials(options),group=buildProps('review',[prop],input,T,geometry,materials),swapped=[90,270].includes(prop.rotation),w=(swapped?prop.footprint.height:prop.footprint.width)*T,d=(swapped?prop.footprint.width:prop.footprint.height)*T,rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-prop.rotation*Math.PI/180),centre=new Vector3((prop.x+(prop.footprint.width-1)*.5)*T,prop.elevation??0,(prop.y+(prop.footprint.height-1)*.5)*T);
 assert.deepEqual(prop,before);group.updateMatrixWorld(true);return {prop,w,d,group,geometry,materials,point:p=>new Vector3(...p).applyQuaternion(rotation).add(centre),direction:p=>new Vector3(...p).applyQuaternion(rotation),dispose(){disposeWorldNode(group);geometry.dispose();materials.dispose();}};
}
function triangles(mesh,start=0,count=mesh.geometry.getAttribute('position').count/3){const p=mesh.geometry.getAttribute('position');return Array.from({length:count},(_,n)=>[0,1,2].map(i=>new Vector3().fromBufferAttribute(p,(start+n)*3+i)));}
function intersects(a,b){for(const [first,second]of [[a,b],[b,a]])for(let i=0;i<3;i++){const edge=first[(i+1)%3].clone().sub(first[i]),length=edge.length(),hit=new Ray(first[i],edge.normalize()).intersectTriangle(...second,false,new Vector3());if(hit&&hit.distanceTo(first[i])<=length+eps)return true;}return false;}

test('gathered sacks stay closed and bounded with a real foot, neck and broad non-spherical creases',()=>{
 const library=new WorldGeometry();for(const variant of [0,1]){
  const geometry=library.get(`storage-sack-${variant}`),p=geometry.getAttribute('position'),faces=geometry.index.array,edges=new Map();assert.equal(faces.length/3,112);assert.equal(geometry.boundingBox.max.y,1);assert.ok(Math.abs(geometry.boundingBox.min.y+16/17)<1e-6);let volume=0;
  for(let n=0;n<faces.length;n+=3){const face=Array.from(faces.slice(n,n+3)),[a,b,c]=face.map(i=>new Vector3().fromBufferAttribute(p,i));assert.ok(new Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).length()>1e-5);volume+=a.dot(b.clone().cross(c))/6;for(let i=0;i<3;i++){const from=face[i],to=face[(i+1)%3],key=[from,to].sort((a,b)=>a-b).join(',');const row=edges.get(key)??[];row.push([from,to]);edges.set(key,row);}}
  assert.ok(volume>1.5);for(const rows of edges.values()){assert.equal(rows.length,2);assert.deepEqual(rows[0],[...rows[1]].reverse(),'closed edges retain opposing oriented faces');}
  const shoulder=Array.from({length:8},(_,i)=>Math.hypot(p.getX(16+i),p.getZ(16+i))),neck=Array.from({length:8},(_,i)=>Math.hypot(p.getX(40+i),p.getZ(40+i)));assert.ok(Math.min(...shoulder)>Math.max(...neck)*2.5);assert.ok(Math.max(...shoulder)-Math.min(...shoulder)>.05,'body folds are broad geometric creases');assert.ok(Math.min(...Array.from(geometry.getAttribute('color').array))<=.67+eps);assert.equal(library.get(`storage-sack-${variant}`),geometry);
 }
 let released=0;for(const key of ['storage-sack-0','storage-sack-1','floor-rug-body','floor-rug-trim'])library.get(key).addEventListener('dispose',()=>released++);library.dispose();library.dispose();assert.equal(released,4);
});

test('every lower sack meets the exact floor and raised sacks meet lower supports inside authored cells',()=>{
 for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2},{width:2,height:2}])for(const rotation of [0,90,180,270])for(const elevation of [0,3]){
  const r=render('sacks',{footprint,rotation,elevation,obstacleHeight:.7}),mesh=r.group.children[0],bounds=new Box3().setFromObject(r.group);assert.ok(bounds.min.x>=(r.prop.x-.5)*T-eps&&bounds.max.x<=(r.prop.x+footprint.width-.5)*T+eps);assert.ok(bounds.min.z>=(r.prop.y-.5)*T-eps&&bounds.max.z<=(r.prop.y+footprint.height-.5)*T+eps);assert.ok(Math.abs(bounds.min.y-elevation)<eps);assert.ok(Math.abs(bounds.max.y-(elevation+.637))<eps);
  const bags=[0,1,2,3].map(n=>triangles(mesh,n*112,112));for(let n=0;n<3;n++)assert.ok(Math.abs(Math.min(...bags[n].flat().map(p=>p.y))-elevation)<eps);assert.ok(Math.abs(Math.min(...bags[3].flat().map(p=>p.y))-(elevation+.175))<eps);let contact=0;for(const upper of bags[3])for(const lower of bags.slice(0,3).flat())if(intersects(upper,lower))contact++;assert.ok(contact>0,'a raised sack must actually meet a supporting sack body');assert.equal(mesh.material.name,'world:linen');assert.equal(mesh.material.roughness,.94);r.dispose();
 }
});

test('floor rug preserves floor contact and old bounds while exposing broad bands and separate fringe',()=>{
 for(const footprint of [{width:1,height:1},{width:2,height:1},{width:1,height:2},{width:3,height:2}])for(const rotation of [0,90,180,270])for(const elevation of [0,3]){
  const r=render('rug',{footprint,rotation,elevation}),bounds=new Box3().setFromObject(r.group),body=r.group.children[0],trim=r.group.children[1];assert.ok(bounds.min.x>=(r.prop.x-.5)*T-eps&&bounds.max.x<=(r.prop.x+footprint.width-.5)*T+eps);assert.ok(bounds.min.z>=(r.prop.y-.5)*T-eps&&bounds.max.z<=(r.prop.y+footprint.height-.5)*T+eps);assert.ok(Math.abs(bounds.min.y-elevation)<eps&&bounds.max.y<=elevation+.0245+eps);assert.deepEqual(r.group.children.map(m=>m.material.name),['world:rug','world:linen']);
  const down=p=>new Raycaster(r.point(p),r.direction([0,-1,0]),0,.04).intersectObject(r.group,true),surface=down([0,.03,0])[0];assert.ok(surface&&Math.abs(surface.point.y-(elevation+.018))<eps);const position=trim.geometry.getAttribute('position');let floorTips=0;for(let n=0;n<position.count;n++)floorTips+=Math.abs(position.getY(n)-elevation)<eps;assert.equal(floorTips,72,'both end fringes reach the floor');
  for(const sign of [-1,1]){assert.ok(down([.341*r.w,.03,sign*.40*r.d]).length>0,'end fringe has real pale strands');assert.equal(down([.310*r.w,.03,sign*.415*r.d]).length,0,'gaps stay open between neighbouring fringe strands');}
  const bodyFaces=triangles(body).map(points=>new Triangle(...points));let roots=0;for(let n=0;n<position.count;n++)if(Math.abs(position.getY(n)-(elevation+.018))<eps){const point=new Vector3().fromBufferAttribute(position,n);assert.ok(Math.min(...bodyFaces.map(face=>face.closestPointToPoint(point,new Vector3()).distanceTo(point)))<eps,'every actual strand root meets the body edge without a floating gap');roots++;}assert.equal(roots,72);
  assert.equal(body.geometry.getAttribute('position').count/3,36);assert.equal(trim.geometry.getAttribute('position').count/3,64);for(const material of [body.material,trim.material])assert.equal(material.roughness,.94);r.dispose();
 }
});

test('cloth batches have fixed costs and scale the same colour fields by admitted light',()=>{
 for(const type of ['sacks','rug']){
  const day=render(type),night=render(type,{}, {terrain:{tiles:[],night:true},illumination:{'0:2,3':.25}}),light=.27+.73*.25;assert.equal(day.group.children.reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0),type==='sacks'?448:100);assert.equal(day.group.children.length,type==='sacks'?1:2);
  for(let n=0;n<day.group.children.length;n++){const a=day.group.children[n].geometry.getAttribute('color').array,b=night.group.children[n].geometry.getAttribute('color').array;for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]*light-b[i])<eps);for(const name of ['position','normal','uv','color'])for(const value of day.group.children[n].geometry.getAttribute(name).array)assert.ok(Number.isFinite(value));}day.dispose();night.dispose();
 }
});

test('hay and bed material/geometry streams stay outside the sack/rug change',()=>{
 for(const rotation of [0,90,180,270]){
  const r=render('hay',{rotation}),batch=new WorldBatch(r.geometry),thatch=r.materials.get('thatch'),dark=r.materials.get('darkwood'),h=1.3,frameRotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-rotation*Math.PI/180);
  for(let n=0;n<4;n++)batch.primitive('box',thatch,[(n%2-.5)*r.w*.34,h*(n===3?.57:.32),(Math.floor(n/2)-.5)*r.d*.34],[r.w*.33,h*.34,r.d*.31],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),n*.12));for(let n=0;n<6;n++)batch.box(dark,(n-2.5)*r.w*.1,h*.66,0,.006,.015,r.d*.60);const old=batch.finish('old');old.position.copy(r.point([0,0,0]));old.quaternion.copy(frameRotation);old.updateMatrix();const merged=new WorldBatch(r.geometry);for(const mesh of old.children)merged.add(mesh.geometry,mesh.material,old.matrix);const baseline=merged.finish('baseline');assert.deepEqual(streams(r.group),streams(baseline));disposeWorldNode(old);disposeWorldNode(baseline);r.dispose();
 }
 const bed=render('bed',{footprint:{width:1,height:2}});assert.equal(bed.group.children.reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0),420);for(const v of bed.group.children.find(m=>m.material.name==='world:rug').geometry.getAttribute('color').array)assert.equal(v,1);bed.dispose();
});

test('cloth cache follows admitted props, reuses unrelated chunks and releases replaced meshes once',()=>{
 const props=[{id:'sacks',type:'sacks',x:2,y:3,roomId:'known'},{id:'rug',type:'rug',x:4,y:3,roomId:'known'},{id:'remote',type:'rug',x:24,y:18}],scene=new Scene(),world=createSectorWorld(scene,options),input={terrain:{tiles:[],props}};world.update(input);const root=scene.getObjectByName('sector-world'),batch=root.getObjectByName('props:0:0,0'),remote=root.getObjectByName('props:0:3,2');assert.equal(batch.children.length,2);assert.equal(world.inspect().triangles,648);let released=0;for(const mesh of batch.children)mesh.geometry.addEventListener('dispose',()=>released++);world.update({...input,timeSeconds:9});assert.equal(root.getObjectByName('props:0:0,0'),batch);
 world.update({terrain:{tiles:[],props:props.map(p=>p.id==='sacks'?{...p,rotation:90}:p)}});assert.equal(released,2);assert.equal(root.getObjectByName('props:0:3,2'),remote);assert.notEqual(root.getObjectByName('props:0:0,0'),batch);world.update({terrain:{tiles:[],props:[props[2]]}});assert.equal(root.getObjectByName('props:0:0,0'),undefined);assert.deepEqual(world.inspect().semanticIds,['prop:remote']);world.dispose();world.dispose();
});
