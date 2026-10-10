import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Mesh,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {entranceFrame,getBuildingProfile}=await import('../game/building-profile.js');
const {buildingDetails}=await import('../web/app/TacticalBuildingDetails.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const T=1.2360585147470482,V=25.066666666666666,rotations=[0,90,180,270];
function fixture(rotation,view='exterior',roof='original'){
 const battle=createArchitectureReviewBattle('deposito',rotation,view,roof),b=battle.buildings[0],input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},frame=entranceFrame({...b,walls:battle.tiles}),geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:path=>path});
 return {b,input,frame,materials,point(u,v,y){const p=frame.at(u,v);return new Vector3(p.x*T,y,p.y*T);},feature(building){const node=building.getObjectByName(`building-detail:${b.id}:depot-masonry-piers`);return node?.children.length?node:undefined;},build(){const before=JSON.stringify(input),building=buildBuilding(b,input,T,geometry,materials);building.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);return building;},dispose(building){disposeWorldNode(building);geometry.dispose();materials.dispose();}};
}
function boxes(f,node){
 const result=[],origin=f.frame.at(0,0);node?.traverse(mesh=>{if(!(mesh instanceof Mesh))return;const p=mesh.geometry.getAttribute('position');assert.equal(p.count%36,0);for(let n=0;n<p.count;n+=36){const box={u0:Infinity,u1:-Infinity,v0:Infinity,v1:-Infinity,y0:Infinity,y1:-Infinity,material:mesh.material};for(let i=n;i<n+36;i++){const x=p.getX(i)/T-origin.x,z=p.getZ(i)/T-origin.y,u=x*f.frame.u.x+z*f.frame.u.y,v=x*f.frame.v.x+z*f.frame.v.y;box.u0=Math.min(box.u0,u);box.u1=Math.max(box.u1,u);box.v0=Math.min(box.v0,v);box.v1=Math.max(box.v1,v);box.y0=Math.min(box.y0,p.getY(i));box.y1=Math.max(box.y1,p.getY(i));}result.push(box);}});return result;
}
function supported(f,node){node?.traverse(mesh=>{if(mesh instanceof Mesh){const p=mesh.geometry.getAttribute('position');for(let n=0;n<p.count;n++)assert.equal(f.input.terrain.tiles.find(tile=>tile.x===Math.round(p.getX(n)/T)&&tile.y===Math.round(p.getZ(n)/T))?.type,'wall','all pier parts stay in an intact actual support cell');}});}
function sourcePiers(f){
 const result=[];const visit=node=>{if(!node)return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type===ArchitectureVolume&&String(node.props.label).startsWith('depot-masonry-'))result.push(node.props);visit(node.props?.children);};
 for(const object of buildingDetails({...f.b,walls:f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id)},new Set(),(x,y)=>({x:(x-y)*26,y:(x+y)*14})))visit(object.node);
 assert.ok(result.length>=6);return result;
}
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-5,`${message}: ${actual} versus ${expected}`);
function sourceBounds(f,part){const origin=f.frame.at(0,0),us=part.points.map(p=>(p.x-origin.x)*f.frame.u.x+(p.y-origin.y)*f.frame.u.y),vs=part.points.map(p=>(p.x-origin.x)*f.frame.v.x+(p.y-origin.y)*f.frame.v.y);return {u0:Math.min(...us),u1:Math.max(...us),v0:Math.min(...vs),v1:Math.max(...vs)};}

test('depot foot and capital footprints match the actual current sprite at all four rotations',()=>{
 for(const rotation of rotations){const f=fixture(rotation),building=f.build(),node=f.feature(building),native=boxes(f,node),height=building.userData.height;assert.equal(buildingArtInset(f.b,f.input),0);supported(f,node);
  for(const part of sourcePiers(f)){const match=/depot-masonry-(pier|foot|cap)-(\d+)-(\d+)/.exec(part.label),[,kind,u0,v0]=match,u=Number(u0),v=Number(v0),index={pier:0,foot:1,cap:2}[kind],set=native.filter(box=>Math.abs((box.u0+box.u1)*.5-u)<1e-5&&Math.abs((box.v0+box.v1)*.5-v)<1e-5),box=set[index],direct=sourceBounds(f,part);assert.equal(set.length,3);for(const key of ['u0','u1','v0','v1'])near(box[key],direct[key],`${rotation}/${part.label}/${key}`);
   if(kind==='foot'){near(box.y0,0,'foot starts on ground');near(box.y1,part.top/V,'source plinth height');}if(kind==='cap'){near(box.y0,height-(getBuildingProfile(f.b).wallHeight-part.bottom)/V,'capital lower plane');near(box.y1,height-(getBuildingProfile(f.b).wallHeight-part.top)/V,'capital upper plane');}if(kind==='pier'){near(box.y0,(getBuildingProfile(f.b).plinthHeight+2)/V,'shaft joins the foot');near(box.y1,height-7/V,'shaft joins the capital');}
  }
  f.dispose(building);
 }
});

test('depot piers keep standing door and window apertures clear, including removed and corner supports',()=>{
 for(const rotation of rotations){const f=fixture(rotation);f.frame.door.open=true;const building=f.build(),node=f.feature(building);for(const offset of [-.20,0,.20])for(const y of [1.3,1.8]){const start=f.point(f.frame.doorU,-1,y).add(new Vector3(offset*f.frame.u.x,0,offset*f.frame.u.y));assert.equal(new Raycaster(start,new Vector3(f.frame.v.x,0,f.frame.v.y),0,T*1.6).intersectObject(building,true).length,0);}
  for(const tile of f.input.terrain.tiles.filter(tile=>tile.buildingId===f.b.id&&tile.type==='window')){const onX=tile.x===f.b.x||tile.x===f.b.x+f.b.width-1,sign=onX?(tile.x===f.b.x?-1:1):(tile.y===f.b.y?-1:1),start=onX?new Vector3((tile.x+sign)*T,1.3,tile.y*T):new Vector3(tile.x*T,1.3,(tile.y+sign)*T),direction=onX?new Vector3(-sign,0,0):new Vector3(0,0,-sign);assert.equal(new Raycaster(start,direction,0,T*1.6).intersectObject(node,true).length,0);}f.dispose(building);
  for(const corner of [false,true])for(const type of ['door','window','rubble']){const edited=fixture(rotation),p=edited.frame.at(0,corner?0:6),tile=edited.input.terrain.tiles.find(tile=>tile.x===p.x&&tile.y===p.y);tile.type=type;edited.input.terrain.tiles=[edited.frame.door,...edited.input.terrain.tiles.filter(tile=>tile!==edited.frame.door)];const object=edited.build(),piers=edited.feature(object);assert.ok(piers);supported(edited,piers);const y=type==='window'?1.3:1.8,axis=corner?edited.frame.v:edited.frame.u,start=new Vector3(p.x*T,y,p.y*T).add(new Vector3(-axis.x*T,0,-axis.y*T));assert.equal(new Raycaster(start,new Vector3(axis.x,0,axis.y),0,T*1.6).intersectObject(piers,true).length,0);
   if(corner){assert.equal(buildingArtInset(edited.b,edited.input),.4);for(const [index,w,d]of [[1,.70,.70],[2,.66,.66]])for(let n=index;n<boxes(edited,piers).length;n+=3){const box=boxes(edited,piers)[n];near(box.u1-box.u0,w,'edited front retains the released foot/capital width');near(box.v1-box.v0,d,'edited front retains the released foot/capital depth');}}edited.dispose(object);
  }
 }
});

test('depot stone uses the current warm local volume recipe without repainting authored walls and roofs',()=>{
 for(const finish of ['adobe','limewash','ochre','stone','brick'])for(const rotation of rotations){const f=fixture(rotation);f.b.wallFinish=finish;f.b.roofFinish='aged';const source=sourcePiers(f),building=f.build(),node=f.feature(building),material=node.children[0].material;assert.equal(source[0].texture,'stone');assert.equal(material.color.getHexString(),source[0].palette.base.slice(1));assert.equal(material.userData.architectureFinish.texture,'/art/architecture-stone-v2.png');assert.equal(material.userData.architectureFinish.textureOpacity,.60);assert.equal(material.userData.architectureFinish.multiplyOpacity,0);assert.ok(building.getObjectByName(`building-fabric:${f.b.id}`).children.some(mesh=>mesh.material.name===`world:${finish}`&&mesh.material.userData.architectureFinish.role==='wall'));assert.ok(building.getObjectByName(`building-detail:${f.b.id}:gallery`).children.some(mesh=>mesh.material.name==='world:aged'));f.dispose(building);}
});

test('depot source piers follow real roof heights and lower usable upper cells while retaining ordinary disclosure',()=>{
 for(const rotation of rotations){
  for(const roof of ['slab','terrace','roof-route']){const f=fixture(rotation,'exterior',roof),building=f.build(),parts=boxes(f,f.feature(building));assert.ok(parts.length);near(Math.max(...parts.map(part=>part.y1)),building.userData.height-2/V,'pier stays below actual roof route');supported(f,f.feature(building));f.dispose(building);}
  const short=fixture(rotation,'exterior','slab');short.input.terrain.upperSurfaces=short.input.terrain.upperSurfaces.map(surface=>({...surface,elevation:1.8}));const object=short.build();near(Math.max(...boxes(short,short.feature(object)).map(part=>part.y1)),1.8-2/V,'short authored slab');short.dispose(object);
  for(const elevation of [2.2,4])for(const blocked of [false,true]){const f=fixture(rotation),p=f.frame.at(0,6),expected=blocked||elevation>3;f.input.terrain.upperSurfaces=[{...p,tacticalLevel:1,elevation,blocked,kind:'platform',type:'floor',buildingId:f.b.id}];const building=f.build(),parts=boxes(f,f.feature(building)),atCell=parts.filter(box=>Math.abs((box.u0+box.u1)*.5)<1e-5&&Math.abs((box.v0+box.v1)*.5-6)<1e-5);assert.equal(atCell.length,expected?3:0);supported(f,f.feature(building));f.dispose(building);}
  for(const view of ['partial','interior']){const f=fixture(rotation,view),building=f.build();assert.equal(f.feature(building),undefined);f.dispose(building);}
 }
});

test('unpainted legacy depots retain the released square footing, cap and ordinary stone selection',()=>{
 for(const rotation of rotations){const f=fixture(rotation);f.b.architecture='depot';f.b.kind=undefined;f.b.wallFinish=undefined;const building=f.build(),node=f.feature(building),parts=boxes(f,node);assert.equal(buildingArtInset(f.b,f.input),.4);assert.ok(parts.length);assert.equal(node.children[0].material,f.materials.get('stone'));assert.equal(node.children[0].material.userData.architectureFinish,undefined);for(let n=0;n<parts.length;n+=3){near(parts[n].y0,0,'released legacy body starts on ground');near(parts[n+1].u1-parts[n+1].u0,.70,'legacy footing width');near(parts[n+1].v1-parts[n+1].v0,.70,'legacy footing depth');near(parts[n+2].u1-parts[n+2].u0,.66,'legacy cap width');near(parts[n+2].v1-parts[n+2].v0,.66,'legacy cap depth');}supported(f,node);f.dispose(building);}
});

test('depot local stone keeps metre texture spacing and normal day and night vertex illumination',()=>{
 for(const rotation of rotations)for(const night of [false,true]){const f=fixture(rotation);f.input.terrain.night=night;f.input.illumination={[`0:${f.b.x},${f.b.y}`]:.5};const building=f.build(),node=f.feature(building),expected=night?.27+.73*.5:1;for(const mesh of node.children){const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv'),normal=mesh.geometry.getAttribute('normal'),colour=mesh.geometry.getAttribute('color');let vertical=0;for(let n=0;n<p.count;n++){for(const key of ['getX','getY','getZ'])near(colour[key](n),expected,'ordinary vertex light');if(n%3===0&&Math.abs(normal.getY(n))<.5)for(const next of [n+1,n+2])if(Math.abs(p.getY(n)-p.getY(next))>.10){near(Math.abs(uv.getY(n)-uv.getY(next)),Math.abs(p.getY(n)-p.getY(next)),'metre texture course spacing');vertical++;}}assert.ok(vertical>0);}f.dispose(building);}
});
