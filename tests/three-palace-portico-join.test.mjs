import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {palacePorticoHipReturn}=await import('../web/lib/three/world-palace-portico.ts');
const {entranceFrame}=await import('../game/building-profile.js');
const {buildTerrace}=await import('../game/buildings.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ProjectedRoofSurface,ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<3e-5,`${message}: ${a} versus ${b}`);
function fixture(rotation,view='exterior',roof='original'){
 const s=createArchitectureReviewBattle('palacio',rotation,view,roof),b=s.buildings[0],frame=entranceFrame({...b,walls:s.tiles}),input={terrain:{width:s.width,height:s.height,tiles:s.tiles,buildings:s.buildings,upperSurfaces:s.upperSurfaces},revealedRooms:s.revealedRooms},g=new WorldGeometry(),m=new WorldMaterials({tileMetres:T,assetUrl:p=>p});
 return {b,input,frame,point(u,v,y){const p=frame.at(u,v),inset=buildingArtInset(b,input);return new Vector3((p.x+inset)*T,y,(p.y+inset)*T);},feature(n,name){return n.getObjectByName(`building-detail:${b.id}:${name}`);},build(){const before=JSON.stringify(input),n=buildBuilding(b,input,T,g,m);n.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before,'rendering must preserve authored collision, doors and floor state');return n;},dispose(n){disposeWorldNode(n);g.dispose();m.dispose();}};
}
function vertices(node){const result=[];node?.traverse(n=>{if(n instanceof Mesh){const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)result.push(new Vector3(p.getX(i),p.getY(i),p.getZ(i)));}});return result;}
function direct(f){const roof=[],beam=[];const visit=e=>{if(!e)return;if(Array.isArray(e)){e.forEach(visit);return;}if(e.type===ProjectedRoofSurface&&String(e.props.id??'').includes('-palace-portico-'))roof.push(e.props);if(e.type===ArchitectureVolume&&e.props.label==='palace-portico-entablature')beam.push(e.props);visit(e.props?.children);};for(const e of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(t=>t.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(e.node);assert.equal(roof.length,2);assert.equal(beam.length,1);return {roof,beam:beam[0]};}
function roofing(f,n){const finish=f.b.roofFinish??'clay',portico=f.feature(n,'palace-portico-roof'),surface=portico.children.find(m=>m.material?.name===`world:${finish}`),fabric=n.getObjectByName(`building-fabric:${f.b.id}`),main=fabric.children.find(m=>m.material?.name===`world:${finish}`);assert.ok(surface&&main);return {portico,surface,main};}
function top(f,mesh,u,v){const hit=new Raycaster(f.point(u,v,20),new Vector3(0,-1,0),0,30).intersectObject(mesh,true)[0];assert.ok(hit,`actual roof must cover u=${u}, v=${v}`);return hit.point.y;}

test('the supported ordinary palace roof return physically enters the main hip at all four rotations, saved finishes and elevations',()=>{
 for(const rotation of rotations)for(const finish of ['clay','aged','thatch'])for(const base of [0,1.7]){
  const f=fixture(rotation);f.b.roofFinish=finish;for(const tile of f.input.terrain.tiles)tile.elevation=base;const n=f.build(),{surface,main}=roofing(f,n),center=f.frame.doorU,back=1.2,eave=base+n.userData.height+8/V,peak=eave+27/V;
  near(top(f,surface,center,.31),peak-27/V*.01/.9,'the rear tile plane starts at the actual entablature return');near(top(f,surface,center,back-.001),eave+27/V*.001/.9,'the rear closure descends to the source eave');
  assert.ok(top(f,surface,center,.31)>top(f,main,center,.31)+.6,'retain the front pediment roof height');
  assert.ok(top(f,surface,center,back-.001)+.075+.095<top(f,main,center,back-.001),'the entire rear edge, underside and ridge caps must enter the actual main roof');
  let lo=.31,hi=back-.001;for(let i=0;i<30;i++){const v=(lo+hi)*.5;if(top(f,surface,center,v)>top(f,main,center,v))lo=v;else hi=v;}const join=(lo+hi)*.5;assert.ok(join>.3&&join<back-.05);near(top(f,surface,center,join),top(f,main,center,join),'the actual tile planes intersect without a floating gap');
  for(const u of [center-2,center,center+2])assert.ok(top(f,surface,u,back-.001)+.17<top(f,main,u,back-.001),'the whole rear eave joins the main roof');
  assert.equal(f.feature(n,'palace-portico-return'),undefined,'ordinary joined roofing must not expose the obsolete rear masonry triangle');f.dispose(n);
 }
});

test('current source eave corners, front ridge, supported entablature and pediment survive the explicitly bounded rear adaptation',()=>{
 for(const rotation of rotations){const f=fixture(rotation),source=direct(f),n=f.build(),{surface}=roofing(f,n),actual=vertices(surface),origin=f.frame.at(0,0),local=p=>({u:(p.x-origin.x)*f.frame.u.x+(p.y-origin.y)*f.frame.u.y,v:(p.x-origin.x)*f.frame.v.x+(p.y-origin.y)*f.frame.v.y});
  for(const p of source.roof.flatMap(r=>r.points)){const {u,v}=local(p);if(u!==f.frame.doorU||v<0)assert.ok(actual.some(a=>a.distanceTo(new Vector3(p.x*T,p.z/V,p.y*T))<3e-5),'all four outer source eave corners and the complete front ridge stay exact');}
  const support=Math.max(...source.beam.points.map(p=>local(p).v));near(support,.3,'the measured source entablature return');assert.ok(actual.some(p=>p.distanceTo(f.point(f.frame.doorU,support,n.userData.height+35/V))<3e-5),'the ridge ends over its real supported source return');
  assert.ok(f.feature(n,'palace-pediment'));assert.ok(f.feature(n,'palace-portico-crest'));assert.ok(f.feature(n,'palace-portico-entablature'));f.dispose(n);
 }
});

test('every real return facet has outward normals, metre UVs and a closed timber underside with original roof thickness',()=>{
 for(const rotation of rotations){const f=fixture(rotation),n=f.build(),{surface,portico}=roofing(f,n),pos=surface.geometry.attributes.position,uv=surface.geometry.attributes.uv,normal=surface.geometry.attributes.normal,index=surface.geometry.index?.array,edges=portico.getObjectByName(`building-roof-edges:${f.b.id}:palace-portico`);assert.ok(edges);
  for(let i=0;i<(index?.length??pos.count);i+=3){const ks=[0,1,2].map(j=>index?index[i+j]:i+j),ps=ks.map(k=>new Vector3(pos.getX(k),pos.getY(k),pos.getZ(k)));for(const k of ks){assert.ok(normal.getY(k)>0,'all exterior tile planes face the sky');for(const channel of ['getX','getY','getZ'])assert.ok(Number.isFinite(pos[channel](k)));}for(const [a,b]of [[0,1],[1,2],[2,0]])near(Math.hypot(uv.getX(ks[a])-uv.getX(ks[b]),uv.getY(ks[a])-uv.getY(ks[b])),ps[a].distanceTo(ps[b]),'unchanged metre texture density');}
  for(const v of [.35,.65,.9,1.15]){const u=f.frame.doorU,y=top(f,surface,u,v),hit=new Raycaster(f.point(u,v,y-.2),new Vector3(0,1,0),0,.3).intersectObject(edges,true)[0];assert.equal(hit?.object.material.name,'world:darkwood');near(y-hit.point.y,.075,'the complete rear roof has its real timber underside');}f.dispose(n);
 }
});

test('the bounded return preserves standing door and window approaches, exact source footprints and ordinary room cutaways',()=>{
 for(const rotation of rotations){const f=fixture(rotation),n=f.build(),{portico}=roofing(f,n);for(const tile of f.input.terrain.tiles.filter(t=>t.buildingId===f.b.id&&['door','window'].includes(t.type))){const out=tile.x===f.b.x?new Vector3(-1,0,0):tile.x===f.b.x+f.b.width-1?new Vector3(1,0,0):tile.y===f.b.y?new Vector3(0,0,-1):new Vector3(0,0,1);for(const y of [1,1.3,1.9])for(const along of [-.2,0,.2]){const p=new Vector3(tile.x*T,y,tile.y*T).addScaledVector(new Vector3(-out.z,0,out.x),along);assert.equal(new Raycaster(p.addScaledVector(out,T),out.clone().negate(),0,1.6*T).intersectObject(portico,true).length,0,'standing window/door sight and approach remains clear');}}
  const origin=f.frame.at(0,0);for(const p of vertices(portico)){const u=(p.x/T-origin.x)*f.frame.u.x+(p.z/T-origin.y)*f.frame.u.y,v=(p.x/T-origin.x)*f.frame.v.x+(p.z/T-origin.y)*f.frame.v.y;assert.ok(u>=f.frame.doorU-3-.08&&u<=f.frame.doorU+3+.08&&v>=-.44&&v<=1.26,'the existing roof/cap footprint stays bounded');}f.dispose(n);
  for(const view of ['partial','interior']){const q=fixture(rotation,view),cut=q.build();assert.ok(q.input.revealedRooms.length);for(const name of ['palace-portico-roof','palace-portico-return','palace-pediment','palace-portico-crest'])assert.equal(q.feature(cut,name),undefined);q.dispose(cut);}
 }
});

test('short or explicit slabs, edited and legacy shells, and actual upper routes keep the released closure and admission',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),n=f.build();assert.equal(palacePorticoHipReturn(f.b,f.input,n.userData.height,buildingArtInset(f.b,f.input),false,3,9,1.2,6),undefined);if(roof==='terrace')assert.ok(f.feature(n,'palace-portico-return'),'a tall explicit terrace retains its released gable');else assert.equal(f.feature(n,'palace-portico-roof'),undefined);f.dispose(n);}
  for(const type of ['door','window','rubble']){const f=fixture(rotation),p=f.frame.at(0,0);f.input.terrain.tiles.find(t=>t.x===p.x&&t.y===p.y).type=type;f.input.terrain.tiles=[f.frame.door,...f.input.terrain.tiles.filter(t=>t!==f.frame.door)];const n=f.build();assert.equal(buildingArtInset(f.b,f.input),.4);assert.ok(f.feature(n,'palace-portico-return'),'edited corner closure stays released');f.dispose(n);}
  for(const mode of ['blocked','ground','front-route','return-route','inner-route']){const f=fixture(rotation),terrace=buildTerrace({...f.b,roof:'terrace'},{elevation:4.9});f.input.terrain.upperSurfaces=terrace.upperSurfaces.map(s=>({...s,blocked:true,obstacleHeight:0}));if(mode!=='blocked'){const p=f.frame.at(f.frame.doorU,mode==='inner-route'?3:mode==='return-route'?1:0),s=f.input.terrain.upperSurfaces.find(s=>s.x===p.x&&s.y===p.y);s.blocked=false;if(mode==='ground')s.tacticalLevel=0;}const n=f.build(),present=['blocked','ground','inner-route'].includes(mode);assert.equal(Boolean(f.feature(n,'palace-portico-roof')),present);assert.equal(Boolean(f.feature(n,'palace-portico-return')),present,'authored upper slabs retain their exact released clearance');f.dispose(n);}
  const f=fixture(rotation);f.b.architecture='palace';f.b.kind=undefined;f.b.wallFinish=undefined;const n=f.build();assert.equal(f.feature(n,'palace-portico-return'),undefined,'the released compact legacy house-height shell has no upper portico');assert.equal(palacePorticoHipReturn({...f.b,kind:'palace'},f.input,5,0,true,3,9,1.2,6),undefined);f.dispose(n);
 }
 const f=fixture(0);for(const height of [NaN,Infinity,-1,3.99])assert.equal(palacePorticoHipReturn(f.b,f.input,height,0,false,3,9,1.2,6),undefined);for(const args of [[NaN,9,1.2,6],[3,Infinity,1.2,6],[3,9,.3,6],[3,9,1.2,NaN],[0,13,1.2,6]])assert.equal(palacePorticoHipReturn(f.b,f.input,4.946808510638298,0,false,...args),undefined);f.dispose(f.build());
});
