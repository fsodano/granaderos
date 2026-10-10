import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Box3,Raycaster,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {WorldGeometry,WorldBatch,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {addWindowSill}=await import('../web/lib/three/world-window-sills.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {buildingArtInset}=await import('../web/lib/three/world-building-placement.ts');
const {BUILDING_OPENINGS}=await import('../game/building-scale.js');
const {ARCHITECTURE_REVIEW_TEMPLATES}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
const {createArchitectureReviewBattle}=await import('./legacy-building-fixtures.mjs');
const {createElement}=await import('../web/node_modules/react/index.js');
const {renderToStaticMarkup}=await import('../web/node_modules/react-dom/server.node.js');
const {Opening,WALL_COLOURS}=await import('../web/app/TacticalArchitectureMaterials.tsx');
const T=1.2360585147470482,V=25.066666666666666,eps=1e-5;

function source(style,trim){
  const html=renderToStaticMarkup(createElement(Opening,{type:'window',style,trim}));
  const path=html.match(/<path d="(M[^\"]+)" fill="none" stroke="#675942"/)[1];
  const left=Number(path.match(/^M([^,]+)/)[1]),right=Number(path.match(/H([^V]+)/)?.[1]??path.match(/ 1 ([^,]+)/)[1]);
  const sill=[...html.matchAll(/<path d="M(-?[\d.]+),(-?[\d.]+)H(-?[\d.]+)" stroke="([^\"]+)" stroke-width="([^\"]+)"/g)].find(m=>m[4]===trim&&Number(m[5])===2.5);
  assert.ok(sill,'Current sprite contains a projecting sill');
  return {ratio:(Number(sill[3])-Number(sill[1]))/(right-left),thickness:Number(sill[5])/V,colour:sill[4]};
}
function isolated(style,axis,finish='ochre',extra={}){
  const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),batch=new WorldBatch(geometry),face={axis,mid:3,cross:7,base:1.2,sill:.765,top:1.85,width:.74,span:T,thickness:.18,style,finish,light:.65,...extra};
  addWindowSill(batch,materials,face);const node=batch.finish('sill');node.updateMatrixWorld(true);
  return {face,node,dispose(){disposeWorldNode(node);geometry.dispose();materials.dispose();}};
}
for(const style of ['barred','small','arched','lattice','shutters'])test(`${style}: both sill faces follow the actual sprite, stay below the aperture and have outward normals`,()=>{
  for(const axis of ['x','y'])for(const finish of Object.keys(WALL_COLOURS)){
    const f=isolated(style,axis,finish),native=source(style,WALL_COLOURS[finish].trim),bounds=new Box3().setFromObject(f.node),size=bounds.getSize(new Vector3()),mesh=f.node.children[0];
    assert.ok(mesh);assert.equal(mesh.material.color.getHexString(),native.colour.slice(1));assert.ok(Math.abs((axis==='x'?size.x:size.z)/f.face.width-native.ratio)<eps);assert.ok(Math.abs(size.y-native.thickness)<eps);
    assert.ok(Math.abs(bounds.max.y-f.face.base-f.face.sill)<eps,'Whole sill stays outside the retained aperture');assert.ok((axis==='x'?size.z:size.x)>.24,'Both sill faces project past existing trim');assert.ok((axis==='x'?size.x:size.z)<f.face.span,'Sill remains supported by the actual wall span');
    const centre=bounds.getCenter(new Vector3()),position=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal');
    for(let i=0;i<position.count;i+=3){const c=new Vector3();for(let j=0;j<3;j++)c.add(new Vector3().fromBufferAttribute(position,i+j));c.multiplyScalar(1/3);assert.ok(new Vector3().fromBufferAttribute(normal,i).dot(c.sub(centre))>0,'Complete convex sill has outward lit faces');}
    for(const side of [-1,1]){const y=f.face.base+f.face.sill+.002,start=axis==='x'?new Vector3(f.face.mid,y,f.face.cross+side):new Vector3(f.face.cross+side,y,f.face.mid),direction=axis==='x'?new Vector3(0,0,-side):new Vector3(-side,0,0);assert.equal(new Raycaster(start,direction,0,2).intersectObject(f.node,true).length,0,'The near-sill sight gap is open from either face');}
    f.dispose();
  }
});
function render(battle){
  const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres:T,assetUrl:p=>p}),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),b=battle.buildings[0],node=buildBuilding(b,input,T,geometry,materials);node.updateMatrixWorld(true);assert.equal(JSON.stringify(input),before);
  return {node,b,input,sills:node.getObjectByName(`window-sills:${b.id}`),dispose(){disposeWorldNode(node);geometry.dispose();materials.dispose();}};
}
test('all fourteen compiled templates retain clear standing doors and window sight gaps through four rotations and three roof states',()=>{
  let cases=0,sills=0;
  for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270])for(const roof of ['original','slab','roof-route']){
    const battle=createArchitectureReviewBattle(id,rotation,'exterior',roof);for(const tile of battle.tiles)if(tile.type==='door')tile.open=true;const f=render(battle),inset=buildingArtInset(f.b,f.input);
    for(const record of f.node.userData.openings){
      const tile=battle.tiles.find(t=>(t.doorId??`${t.type}:${t.x},${t.y}`)===record.id),axis=record.axis,cross=((axis==='x'?tile.y:tile.x)+inset)*T,mid=(axis==='x'?tile.x:tile.y)*T,base=tile.elevation??0;
      const levels=record.type==='door'?[1.3,1.8]:[BUILDING_OPENINGS.windowSill/V+.003,BUILDING_OPENINGS.windowSill/V+.4];
      for(const side of [-1,1])for(const y of levels){const start=axis==='x'?new Vector3(mid,base+y,cross+side*T):new Vector3(cross+side*T,base+y,mid),direction=axis==='x'?new Vector3(0,0,-side):new Vector3(-side,0,0);assert.equal(new Raycaster(start,direction,0,2*T).intersectObject(f.sills,true).length,0,`${id}/${rotation}/${roof}: sill never enters a retained approach or sight gap`);}
    }
    f.sills.traverse(mesh=>{if(mesh.isMesh){const p=mesh.geometry.getAttribute('position');assert.ok(p.count>0);sills+=p.count/60;const bounds=new Box3().setFromObject(mesh);assert.ok(bounds.min.y>=0&&bounds.max.y<f.node.userData.height);}});f.dispose();cases++;
  }
  assert.equal(cases,168);assert.ok(sills>300);
});
test('cutaways, breach edits, painted legacy shells, corner windows and short slabs retain physical admission',()=>{
  for(const rotation of [0,90,180,270])for(const view of ['exterior','partial','interior']){
    const battle=createArchitectureReviewBattle('capilla',rotation,view),f=render(battle),retained=f.node.userData.openings.filter(o=>o.type==='window'&&o.height>.28).length;assert.equal(f.sills.children.reduce((n,m)=>n+m.geometry.getAttribute('position').count/60,0),retained);f.dispose();
  }
  for(const rotation of [0,90,180,270]){
    const battle=createArchitectureReviewBattle('capilla',rotation,'exterior','slab');battle.upperSurfaces=battle.upperSurfaces.map(s=>({...s,elevation:1.8}));const tile=battle.tiles.find(t=>t.x===battle.buildings[0].x&&t.y===battle.buildings[0].y);tile.type='window';tile.style='small';const f=render(battle);assert.ok(f.sills.children.length);assert.ok(new Box3().setFromObject(f.sills).max.y<1.8);f.dispose();
    for(const t of battle.tiles)if(t.type==='window')t.type='rubble';const broken=render(battle);assert.equal(broken.sills.children.length,0);broken.dispose();
  }
  const battle=createArchitectureReviewBattle('capilla',0,'exterior');battle.buildings[0].architecture='chapel';battle.buildings[0].kind=undefined;battle.buildings[0].wallFinish=undefined;const old=render(battle);assert.equal(old.sills.children.length,0);old.dispose();battle.buildings[0].wallFinish='ochre';const painted=render(battle);assert.ok(painted.sills.children.length);painted.dispose();
  for(const extra of [{span:.8},{sill:.01},{width:NaN},{base:Infinity},{finish:'unknown'},{style:'unknown'}]){const f=isolated('small','x','ochre',extra);assert.equal(f.node.children.length,0);f.dispose();}
});
