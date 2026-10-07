import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {createElement}=await import('../web/node_modules/react/index.js');
const {renderToStaticMarkup}=await import('../web/node_modules/react-dom/server.node.js');
const {ShaderLib,Texture,TextureLoader}=await import('../web/node_modules/three/build/three.module.js');
const {WALL_COLOURS,ArchitectureDefs,WallSurface}=await import('../web/app/TacticalArchitectureMaterials.tsx');
const {ArchitectureVolume}=await import('../web/app/TacticalBuildingVolumes.tsx');
const {architectureFinish}=await import('../web/lib/three/world-architecture-finish.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {buildBuilding}=await import('../web/lib/three/world-buildings.ts');
const {ARCHITECTURE_REVIEW_TEMPLATES,createArchitectureReviewBattle}=await import('../web/app/renderer-sandbox/architecture-fixtures.js');
class OrdinaryMaterials extends WorldMaterials {get(kind,settings={}){const {architectureRole,...ordinary}=settings;return super.get(kind,ordinary);}}
const T=1.2360585147470482,options={tileMetres:T,assetUrl:path=>path};

test('architecture finish recipes retain the actual authored source paints, assets and role-specific overlay formulas',()=>{
 const defs=renderToStaticMarkup(createElement('svg',null,createElement(ArchitectureDefs)));
 for(const finish of Object.keys(WALL_COLOURS)){
  const material=['stone','brick'].includes(finish)?finish:'plaster',wall=architectureFinish(finish,'wall'),volume=architectureFinish(finish,'volume');assert.equal(wall.base,WALL_COLOURS[finish].base);assert.equal(volume.base,wall.base);assert.equal(wall.texture,`/art/architecture-${material}-v2.png`);assert.equal(volume.texture,wall.texture);assert.ok(defs.includes(wall.texture));
  const surface=renderToStaticMarkup(createElement(WallSurface,{finish,height:60,x:4,y:6}));
  const wallOpacity=Number(surface.match(new RegExp(`fill="url\\(#architecture-${material}\\)" opacity="([.\\d]+)"`))[1]);assert.equal(wall.textureOpacity,wallOpacity,'main walls must use their actual source texture opacity');
  const multiply=surface.match(/opacity="([.\d]+)" style="mix-blend-mode:multiply"/);assert.equal(wall.multiplyOpacity,multiply?Number(multiply[1]):0,'authored adobe and ochre must retain the encoded source pigment multiplication');
  const ornament=renderToStaticMarkup(createElement(ArchitectureVolume,{points:[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}],top:60,palette:WALL_COLOURS[finish],texture:material,project:(x,y)=>({x:(x-y)*26,y:(x+y)*14})}));
  const volumeOpacity=Number(ornament.match(new RegExp(`fill="url\\(#architecture-${material}\\)" opacity="([.\\d]+)"`))[1]);assert.equal(volume.textureOpacity,volumeOpacity,'solid ornaments must use their actual source overlay opacity');assert.equal(volume.multiplyOpacity,0,'the volume source has no additional ochre/adobe pigment layer');
 }assert.equal(architectureFinish('wood','wall'),undefined,'a prop or timber finish must not become an authored masonry finish');
});

test('actual material shader encodes before source compositing and decodes before native vertex and physical lighting',()=>{
 const materials=new WorldMaterials(options);
 for(const finish of Object.keys(WALL_COLOURS))for(const architectureRole of ['wall','volume']){
  const material=materials.get(finish,{architectureRole}),recipe=architectureFinish(finish,architectureRole),shader={fragmentShader:ShaderLib.standard.fragmentShader,vertexShader:ShaderLib.standard.vertexShader};material.onBeforeCompile(shader,{});
  assert.equal(material.color.getHexString(),WALL_COLOURS[finish].base.slice(1));assert.equal(shader.vertexShader,ShaderLib.standard.vertexShader,'physical vertex/normal transforms must remain intact');assert.ok(shader.fragmentShader.indexOf('sRGBTransferOETF( sampledDiffuseColor )')<shader.fragmentShader.indexOf('sRGBTransferEOTF( vec4( architectureEncoded, 1.0 ) )'));
  assert.ok(shader.fragmentShader.indexOf('sRGBTransferEOTF( vec4( architectureEncoded, 1.0 ) )')<shader.fragmentShader.indexOf('#include <color_fragment>'),'native per-vertex/night light must apply after paint decode');assert.ok(shader.fragmentShader.includes('#include <lights_fragment_begin>'),'native physical lighting must remain intact');assert.ok(shader.fragmentShader.includes('diffuseColor.a *= sampledDiffuseColor.a;'),'surface alpha must remain intact');assert.ok(shader.fragmentShader.includes(`sampledDiffuseColor ).rgb, ${recipe.textureOpacity.toFixed(2)}`));
  assert.equal(shader.fragmentShader.includes('architectureEncoded *= mix'),recipe.multiplyOpacity>0);if(recipe.multiplyOpacity)assert.ok(shader.fragmentShader.includes(`architecturePaint, ${recipe.multiplyOpacity.toFixed(2)}`));assert.equal(material.userData.metricBoxUV,true);assert.deepEqual(material.userData.architectureFinish,recipe);
 }materials.dispose();
});

test('architecture roles have separate cache entries while sharing the actual packaged texture and retained metre repeat/relief',()=>{
 const previousDocument=globalThis.document,previousLoad=TextureLoader.prototype.load,paths=[];globalThis.document={};TextureLoader.prototype.load=function(path){paths.push(path);return new Texture();};
 try{
  const materials=new WorldMaterials(options),original=new OrdinaryMaterials(options),wall=materials.get('ochre',{architectureRole:'wall'}),shaft=materials.get('ochre',{architectureRole:'volume'}),legacy=materials.get('ochre'),old=original.get('ochre');
  assert.ok(wall!==shaft&&shaft!==legacy);assert.ok(materials.get('ochre',{architectureRole:'wall'})===wall);assert.ok(wall.map===shaft.map,'role-specific paint must share the texture resource');assert.ok(wall.map!==legacy.map,'the authored source texture must remain separate from legacy plaster');assert.ok(paths.includes('/art/architecture-plaster-v2.png'));assert.ok(paths.includes('/art/buildings/plaster-v1.webp'));assert.deepEqual(wall.map.repeat.toArray(),old.map.repeat.toArray());assert.equal(wall.bumpScale,old.bumpScale);assert.ok(wall.bumpMap===wall.map);assert.notEqual(wall.customProgramCacheKey(),shaft.customProgramCacheKey());assert.notEqual(materials.get('adobe',{architectureRole:'wall'}).customProgramCacheKey(),wall.customProgramCacheKey(),'different multiply layers must not share the compiled paint program');materials.dispose();original.dispose();
 }finally{TextureLoader.prototype.load=previousLoad;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

function signatureGeometry(node){const result=[];node.traverse(child=>{if(child.isMesh)result.push({name:child.name,attributes:Object.fromEntries(['position','normal','uv','color'].map(key=>[key,Array.from(child.geometry.getAttribute(key).array)]))});});return result;}
function fixture(battle,build,Materials){const geometry=new WorldGeometry(),materials=new Materials(options),input={terrain:{width:battle.width,height:battle.height,tiles:battle.tiles,buildings:battle.buildings,upperSurfaces:battle.upperSurfaces},revealedRooms:battle.revealedRooms},before=JSON.stringify(input),node=build(battle.buildings[0],input,T,geometry,materials);assert.equal(JSON.stringify(input),before);return {node,dispose(){disposeWorldNode(node);geometry.dispose();materials.dispose();}};}
test('authored paint retains ordinary geometry, metre UVs and illumination through all fourteen real templates and four rotations',()=>{
 let checked=0;
 for(const {id}of ARCHITECTURE_REVIEW_TEMPLATES)for(const rotation of [0,90,180,270])for(const view of ['exterior','interior']){
  const battle=createArchitectureReviewBattle(id,rotation,view),original=fixture(battle,buildBuilding,OrdinaryMaterials),authored=fixture(battle,buildBuilding,WorldMaterials);assert.deepEqual(signatureGeometry(authored.node),signatureGeometry(original.node),`${id}/${rotation}/${view}: paint cannot change surface coordinates, openings, cutaways, texture spacing or vertex light`);assert.equal(authored.node.userData.height,original.node.userData.height);assert.deepEqual(authored.node.userData.openings,original.node.userData.openings);original.dispose();authored.dispose();checked++;
 }assert.equal(checked,112);
});

test('requesting authored paint leaves retained prop materials and legacy architecture unchanged',()=>{
 const materials=new WorldMaterials(options),kinds=['adobe','limewash','ochre','stone','brick','wood','darkwood','aged','clay','thatch','iron'];
 const signature=m=>({colour:m.color.getHexString(),program:m.customProgramCacheKey(),roughness:m.roughness,metalness:m.metalness,metric:m.userData.metricBoxUV,architecture:m.userData.architectureFinish});
 const retained=kinds.map(kind=>({material:materials.get(kind),before:signature(materials.get(kind))}));
 for(const finish of Object.keys(WALL_COLOURS))for(const architectureRole of ['wall','volume'])materials.get(finish,{architectureRole});
 for(const {material,before}of retained){assert.deepEqual(signature(material),before,'authored paint must not mutate an already retained prop or ordinary roof material');assert.equal(material.userData.architectureFinish,undefined);}materials.dispose();
 for(const rotation of [0,90,180,270]){const battle=createArchitectureReviewBattle('casa',rotation,'exterior','terrace');battle.buildings[0]={...battle.buildings[0],kind:undefined,architecture:'house',wallFinish:undefined};const ordinary=fixture(battle,buildBuilding,OrdinaryMaterials),actual=fixture(battle,buildBuilding,WorldMaterials);assert.deepEqual(signatureGeometry(actual.node),signatureGeometry(ordinary.node));actual.node.traverse(child=>{if(child.isMesh)assert.equal(child.material.userData.architectureFinish,undefined,'a legacy colour may not silently acquire authored paint mixing');});ordinary.dispose();actual.dispose();}
});

// The sprite allows an explicit authored paint to override legacy style colour.
test('explicit paint on a saved legacy terrace remains authored while unpainted legacy selection stays unchanged',()=>{
 for(const finish of ['limewash','ochre','adobe','stone','brick'])for(const rotation of [0,90,180,270]){
  const battle=createArchitectureReviewBattle('casa',rotation,'exterior','terrace');battle.buildings[0]={...battle.buildings[0],kind:undefined,architecture:'house',wallFinish:finish};const r=fixture(battle,buildBuilding,WorldMaterials),fabric=r.node.getObjectByName(`building-fabric:${battle.buildings[0].id}`),wall=fabric.children.find(mesh=>mesh.material.name===`world:${finish}`);assert.ok(wall,`${finish}/${rotation}: the saved explicit finish must remain on the wall`);assert.deepEqual(wall.material.userData.architectureFinish,architectureFinish(finish,'wall'));assert.equal(wall.material.color.getHexString(),WALL_COLOURS[finish].base.slice(1));r.dispose();
 }
});
