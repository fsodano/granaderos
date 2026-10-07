import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPixelatedPass} from 'three/addons/postprocessing/RenderPixelatedPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {characterChoices,prepareProductionCharacter} from './character-library.js';

const $=selector=>document.querySelector(selector);
const canvas=$('#scene'),viewport=$('#viewport');
const state={character:'reference',ready:false,weapon:'none',motion:'walk',skin:'blanco',paused:false,speed:1,travel:false,attacking:false,clip:null,night:false,pixelated:false};
const labels={none:'Sin arma',rifle:'Fusil',sabre:'Sable',pistol:'Pistola',knife:'Cuchillo',idle:'Quieto',walk:'Caminando',run:'Corriendo'};
const palettes={blanco:'#d8a783',moreno:'#9b6441',negro:'#513023'};
const skinLabels={blanco:'Blanco',moreno:'Moreno',negro:'Negro'};
const readyClips={none:'Idle',rifle:'RifleAim',sabre:'SabreReady',pistol:'PistolAim',knife:'KnifeReady'};
const meleeVariants={sabre:['SabreSlash','SabreBackhand'],knife:['KnifeSlash','KnifeBackhand']};
const meleeTurns={sabre:0,knife:0};
const attackOptions={none:[['Punch','Puñetazo']],sabre:[['SabreSlash','Corte descendente'],['SabreForehand','Derecha a izquierda · nudillos abajo'],['SabreBackhand','Izquierda a derecha · nudillos arriba'],['SabreCombination','Dos cortes enlazados'],['SabreThrust','Estocada'],['SabreHiltStrike','Golpe con la empuñadura']],knife:[['KnifeSlash','Corte diagonal'],['KnifeBackhand','Corte de revés'],['KnifeThrust','Puñalada']],rifle:[['RifleFire','Disparo'],['BayonetThrust','Estocada de bayoneta'],['RifleButtStrike','Culatazo']],pistol:[['PistolFire','Disparo'],['PistolStrike','Golpe con la pistola']]};
let chosenAttack=null;
function availableAttacks(){return attackOptions[state.weapon].filter(([name])=>!state.ready||clips.some(clip=>clip.name===name));}
function updateAttackChoices(){
 const select=$('#action-choice');select.replaceChildren();
 const options=availableAttacks();
 if(options.length>1){const option=document.createElement('option');option.value='cycle';option.textContent='Alternar movimientos';select.append(option);}
 for(const [value,label] of options){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 chosenAttack=select.value;
}

const attackClips={rifle:'RifleFire',sabre:'SabreSlash',pistol:'PistolFire',knife:'KnifeSlash'};
// The former 1.25x is now the displayed 1x.
const BASE_PLAYBACK_RATE=1.25;
const frameGaps=[];
let renderer,composer,pixelPass;
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
}catch(error){
 $('#loading').innerHTML='<strong>No se pudo iniciar la vista 3D.</strong><span>Este navegador necesita WebGL 2.</span>';
 $('#status').textContent=error.message;
 throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.AgXToneMapping;
renderer.toneMappingExposure=1;
const scene=new THREE.Scene();
const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(environment,.04).texture;
scene.environmentIntensity=.18;
environment.dispose();pmrem.dispose();
scene.background=new THREE.Color('#55523e');
scene.fog=new THREE.Fog('#55523e',18,45);
const camera=new THREE.OrthographicCamera(-3,3,3,-3,.05,70);
const controls=new OrbitControls(camera,canvas);
controls.enableRotate=false;
controls.mouseButtons.LEFT=THREE.MOUSE.PAN;
controls.touches.ONE=THREE.TOUCH.PAN;
controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minZoom=.7;
controls.maxZoom=3.2;
controls.minPolarAngle=.18;
controls.maxPolarAngle=Math.PI/2-.08;
function setCamera(){
 camera.position.set(6,5.82,6);
 $('.camera-label').textContent='Isométrica';
 controls.target.set(0,.92,0);
 camera.zoom=1.65;
 camera.updateProjectionMatrix();
 controls.update();resize();
}
composer=new EffectComposer(renderer);
pixelPass=new RenderPixelatedPass(1.5,scene,camera,{normalEdgeStrength:.22,depthEdgeStrength:.25});
composer.addPass(pixelPass);
composer.addPass(new OutputPass());
setCamera();
function zoom(amount){camera.zoom=THREE.MathUtils.clamp(camera.zoom*amount,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();controls.update();}

const hemi=new THREE.HemisphereLight('#e2e7ed','#554631',.78);scene.add(hemi);
const sunlight=new THREE.DirectionalLight('#fff1d9',2.7);
sunlight.position.set(-4,9,5);sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048);
Object.assign(sunlight.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});
sunlight.shadow.normalBias=.012;sunlight.shadow.bias=-.0001;
scene.add(sunlight);
const fill=new THREE.DirectionalLight('#c3d8ec',.38);fill.position.set(4,3,-4);scene.add(fill);
const gunLight=new THREE.PointLight('#ffb25b',0,3,2);scene.add(gunLight);

function terrainTexture(){
 const image=document.createElement('canvas');image.width=image.height=1024;
 const ctx=image.getContext('2d');let seed=31;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const pixels=ctx.createImageData(1024,1024);
 for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
  const cloud=Math.sin(x*.024)*Math.cos(y*.018)*5+Math.sin((x+y)*.007)*4;
  const grain=(random()-.5)*24,index=(y*1024+x)*4;
  pixels.data[index]=101+cloud+grain;
  pixels.data[index+1]=89+cloud+grain;
  pixels.data[index+2]=64+cloud+grain*.7;
  pixels.data[index+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 for(let i=0;i<18000;i++){
  const x=random()*1024,y=random()*1024,r=.3+random()*1.6;
  ctx.fillStyle=random()>.55?'#a293713d':'#443d2b35';
  ctx.beginPath();ctx.ellipse(x,y,r,r*.55,random()*Math.PI,0,Math.PI*2);ctx.fill();
 }
 for(let patch=0;patch<80;patch++){
  const x=random()*1024,y=random()*1024;
  for(let blade=0;blade<30;blade++){
   const px=x+(random()-.5)*30,py=y+(random()-.5)*30;
   ctx.strokeStyle=random()>.5?'#58603f58':'#73704455';ctx.lineWidth=.6+random();
   ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+random()*4-2,py-2-random()*5);ctx.stroke();
  }
 }
 const texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(16,16);
 texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({map:terrainTexture(),roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(12,24,'#ded0a8','#ded0a8');grid.position.y=.002;
grid.material.transparent=true;grid.material.opacity=.07;grid.material.depthWrite=false;scene.add(grid);

const target=new THREE.Group();target.position.set(0,0,2.68);scene.add(target);
const wood=new THREE.MeshStandardMaterial({color:'#594a33',roughness:.88});
for(const x of [-.23,.23]){const post=new THREE.Mesh(new THREE.BoxGeometry(.06,1.8,.08),wood);post.position.set(x,.9,0);post.castShadow=true;target.add(post);}
const board=new THREE.Mesh(new THREE.BoxGeometry(.76,.72,.05),new THREE.MeshStandardMaterial({color:'#867450',roughness:.93}));board.position.y=1.35;board.castShadow=true;target.add(board);
for(const [radius,color] of [[.27,'#c6b98b'],[.19,'#5d5744'],[.08,'#c6b98b']]){
 const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.74,radius,48),new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
 ring.position.set(0,1.35,-.031);target.add(ring);
}
target.visible=false;

const flash=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:'#ffda85',transparent:true,depthWrite:false}));
flash.visible=false;scene.add(flash);
const flashCore=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),new THREE.MeshBasicMaterial({color:'#fff4d9'}));flash.add(flashCore);
const effects=[];
let model,mixer,currentAction,clips=[],manifest={},attackEvent=false,flashLife=0,bayonet;
let loadVersion=0;const loadedAssets=new Map();
function loadAsset(url){
 if(!loadedAssets.has(url))loadedAssets.set(url,new GLTFLoader().loadAsync(url).catch(error=>{loadedAssets.delete(url);throw error;}));
 return loadedAssets.get(url);
}
const ownedMaterials=new Set();
let travelPhase=0,previous=performance.now();
const skinMaterials=new Set(),weapons={},muzzles={};
const forward=new THREE.Vector3(),point=new THREE.Vector3(),gripPoint=new THREE.Vector3();
const smokeGeometry=new THREE.IcosahedronGeometry(1,1);
const bulletGeometry=new THREE.SphereGeometry(.008,6,4);

function pressed(button,active){button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
function updateControls(){
 document.querySelectorAll('[data-weapon]').forEach(button=>{pressed(button,button.dataset.weapon===state.weapon);button.disabled=!state.ready;});
 document.querySelectorAll('[data-motion]').forEach(button=>{pressed(button,button.dataset.motion===state.motion);button.disabled=!state.ready;});
 document.querySelectorAll('[data-skin]').forEach(button=>{pressed(button,button.dataset.skin===state.skin);button.disabled=!state.ready;});
 const gun=state.weapon==='rifle'||state.weapon==='pistol';
 $('#attack').disabled=!state.ready||state.paused||state.attacking;
 $('#attack-label').textContent=chosenAttack==='cycle'?'Atacar':(attackOptions[state.weapon].find(([name])=>name===chosenAttack)?.[1]??'Atacar');
 $('#attack-icon').textContent=state.weapon==='sabre'?'↘':'→';
 $('#attack-description').textContent='Elegí un movimiento para probarlo. El ataque detiene la marcha. Los disparos no incluyen recarga.';
 $('#pause').disabled=!state.ready;
 $('#pause').innerHTML=state.paused?'▶ <span>Continuar</span>':'Ⅱ <span>Pausar</span>';
 $('#pause').setAttribute('aria-label',state.paused?'Continuar animación':'Pausar animación');
 $('#scene-state').textContent=state.attacking?`${attackOptions[state.weapon].find(([name])=>name===state.clip)?.[1]??'Ataque'} · ${labels[state.weapon]}`:`${labels[state.motion]} · ${labels[state.weapon]}`;
 if(state.paused)$('#scene-state').textContent+=' · Pausado';
 $('#motion-state').textContent=state.travel&&state.motion!=='idle'?'Recorriendo el terreno':'En el sitio';
 $('#action-choice').disabled=!state.ready;
 $('#status').textContent=state.ready?`${characterChoices.find(([id])=>id===state.character)?.[1]} · ${labels[state.weapon]} · Piel: ${skinLabels[state.skin]} · ${state.paused?'Pausado':'Listo para probar'} · Modelo ${manifest.sha256?.slice(0,8)??'sin versión'}`:'Cargando el modelo…';
}
function clearEffects(){
 for(const effect of effects){scene.remove(effect.mesh);effect.mesh.material.dispose();}
 effects.length=0;flashLife=0;flash.visible=false;gunLight.intensity=0;
}
function playClip(name,{once=false,fade=.16}={}){
 const clip=THREE.AnimationClip.findByName(clips,name);
 if(!clip)throw new Error(`Falta la animación ${name}`);
 const next=mixer.clipAction(clip);
 next.reset();next.enabled=true;next.paused=false;next.setEffectiveWeight(1);next.setEffectiveTimeScale(1);
 next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
 if(currentAction&&currentAction!==next&&fade>0){currentAction.fadeOut(fade);next.fadeIn(fade);}else if(currentAction===next){next.stopFading();}
 next.play();currentAction=next;state.clip=name;return next;
}
function returnToSelectedPose(fade=.16){
 if(!state.ready)return;
 state.attacking=false;attackEvent=false;
 const locomotion=state.motion==='walk'?'Walk':state.motion==='run'?'Run':null;
 const chosen=locomotion?(state.weapon==='none'?locomotion:state.weapon[0].toUpperCase()+state.weapon.slice(1)+locomotion):readyClips[state.weapon];
 playClip(chosen,{fade});updateBayonet();updateControls();
}
function applySkin(tone){state.skin=tone;for(const material of skinMaterials)material.color.set(palettes[tone]);updateControls();}
function updateBayonet(){if(bayonet)bayonet.visible=state.weapon==='rifle'&&(chosenAttack==='BayonetThrust'||state.clip==='BayonetThrust'&&state.attacking);}
function selectWeapon(weapon){
 if(!state.ready)return;
 state.weapon=weapon;state.attacking=false;updateAttackChoices();
 clearEffects();mixer.stopAllAction();currentAction=null;
 for(const [name,object]of Object.entries(weapons))object.visible=name===weapon;
 target.visible=weapon==='rifle'||weapon==='pistol';
 model.position.set(0,0,0);model.rotation.y=0;travelPhase=0;
 returnToSelectedPose(0);
}
function selectMotion(motion){
 if(!state.ready)return;
 state.motion=motion;state.attacking=false;clearEffects();
 model.position.set(0,0,0);model.rotation.y=0;travelPhase=0;
 if(state.paused){
  mixer.stopAllAction();currentAction=null;
  returnToSelectedPose(0);mixer.update(0);
 }else returnToSelectedPose();
}
function attack(){
 if(!state.ready||state.paused||state.attacking)return;
 state.motion='idle';state.attacking=true;attackEvent=false;
 clearEffects();model.position.set(0,0,0);model.rotation.y=0;travelPhase=0;
 const options=availableAttacks();
 const turn=meleeTurns[state.weapon]??0;meleeTurns[state.weapon]=turn+1;
 const clip=chosenAttack&&chosenAttack!=='cycle'?chosenAttack:options[turn%options.length][0];
 playClip(clip,{once:true,fade:.08});updateBayonet();updateControls();
}
function weaponEvent(){
 if(!state.clip?.endsWith('Fire')){
  return;
 }
 const muzzle=muzzles[state.weapon];
 if(!muzzle)return;
 muzzle.getWorldPosition(point);weapons[state.weapon].getWorldPosition(gripPoint);
 forward.copy(point).sub(gripPoint).normalize();
 flash.position.copy(point);flash.scale.set(.045,.045,.09);flashLife=.09;flash.visible=true;
 gunLight.position.copy(point);gunLight.intensity=7;
 for(let index=0;index<11;index++){
  const material=new THREE.MeshBasicMaterial({color:'#c6c5ad',transparent:true,opacity:.3,depthWrite:false});
  const mesh=new THREE.Mesh(smokeGeometry,material);mesh.position.copy(point).addScaledVector(forward,index*.018);mesh.scale.setScalar(.025+index*.002);scene.add(mesh);
  effects.push({mesh,kind:'smoke',age:0,life:1.6+index*.06,velocity:forward.clone().multiplyScalar(.28+index*.025).add(new THREE.Vector3(Math.sin(index*2)*.08,.17+index*.018,0))});
 }

}
function updateEffects(delta){
 flashLife=Math.max(0,flashLife-delta);flash.visible=flashLife>0;gunLight.intensity=flashLife>0?7:0;
 for(let index=effects.length-1;index>=0;index--){
  const effect=effects[index];effect.age+=delta;
  if(effect.age>=effect.life){scene.remove(effect.mesh);effect.mesh.material.dispose();effects.splice(index,1);continue;}
  effect.mesh.position.addScaledVector(effect.velocity,delta);
  if(effect.kind==='smoke'){effect.mesh.scale.setScalar(.03+effect.age*.095);effect.mesh.material.opacity=.3*(1-effect.age/effect.life);effect.mesh.rotation.y+=delta*.3;}
 }
}
function actionEventTime(clip){
 const event=manifest.clips?.find(item=>item.name===clip.name)?.events??manifest.events?.[clip.name]??manifest.actionEvents?.[clip.name];
 return typeof event==='number'?event:event?.time??event?.shot??event?.hit??event?.contact??clip.duration*.4;
}

async function load(characterId='reference'){
 const version=++loadVersion,previousAttack=chosenAttack;state.ready=false;state.attacking=false;state.character=characterId;
 clearEffects();mixer?.stopAllAction();if(model){mixer?.uncacheRoot(model);scene.remove(model);}
 for(const material of ownedMaterials)material.dispose();ownedMaterials.clear();skinMaterials.clear();
 for(const key of Object.keys(weapons))delete weapons[key];for(const key of Object.keys(muzzles))delete muzzles[key];
 model=null;mixer=null;currentAction=null;bayonet=null;clips=[];travelPhase=0;
 const name=characterChoices.find(([id])=>id===characterId)?.[1]??characterId;
 $('#character-title').textContent=name;$('#scene').setAttribute('aria-label',`${name} en vista isométrica. Arrastrá para mover la vista. Usá la rueda para acercarte.`);
 $('#loading').classList.remove('hidden');$('#loading').innerHTML='<span class="loading-ring"></span><strong>Cargando el personaje…</strong><span>Modelo y movimientos</span>';updateControls();
 try{
  let asset,info;
  if(characterId==='reference'){
   const response=await fetch('/assets/asset-manifest.json',{cache:'no-store'});if(!response.ok)throw Error('No se pudo leer la referencia.');
   info=await response.json();const source=await loadAsset(`/assets/granadero.glb?v=${encodeURIComponent(info.sha256)}`);
   const {clone}=await import('three/addons/utils/SkeletonUtils.js');asset={scene:clone(source.scene),animations:source.animations};
  }else{
   const response=await fetch('/models/characters/manifest.json',{cache:'no-store'});if(!response.ok)throw Error('No se pudo leer la biblioteca de personajes.');
   const library=await response.json(),appearance=library.appearances[characterId];if(!appearance)throw Error(`Falta el personaje ${characterId}.`);
   const body=appearance.lods.find(lod=>lod.lod===0),bank=library.animationLibraries[appearance.animationLibrary];
   const url=spec=>`${spec.url}?v=${encodeURIComponent(spec.sha256)}`;
   const [bodyFile,animation,equipment]=await Promise.all([loadAsset(url(body)),loadAsset(url(bank)),loadAsset(url(library.equipment))]);
   asset=prepareProductionCharacter(bodyFile,animation,equipment,library,appearance);info=asset.manifest;
  }
  if(version!==loadVersion)return;
  model=asset.scene;manifest=info;bayonet=asset.bayonet;
  if(asset.weapons)Object.assign(weapons,asset.weapons);if(asset.muzzles)Object.assign(muzzles,asset.muzzles);
  model.traverse(object=>{
   if(object.isMesh){object.castShadow=true;object.receiveShadow=true;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    const cloned=materials.map(material=>{const value=material.clone();ownedMaterials.add(value);if(/^skin(?:[._]|$)/i.test(value.name))skinMaterials.add(value);return value;});
    object.material=Array.isArray(object.material)?cloned:cloned[0];
   }
   for(const weapon of ['rifle','sabre','pistol','knife']){
    if(object.name===`weapon_${weapon}`)weapons[weapon]=object;
    if(object.name===`muzzle_${weapon}`)muzzles[weapon]=object;
   }
  });
  const required=['Idle','Walk','Run','RifleAim','RifleFire','SabreReady','SabreSlash','PistolAim','PistolFire','KnifeReady','KnifeSlash','SabreBackhand','KnifeBackhand','RifleWalk','RifleRun','PistolWalk','PistolRun','SabreWalk','SabreRun','KnifeWalk','KnifeRun','SabreForehand','SabreThrust','KnifeThrust','BayonetThrust','SabreHiltStrike','PistolStrike','RifleButtStrike','Punch'];
  for(const name of required)if(!asset.animations.some(clip=>clip.name===name))throw Error(`El modelo no contiene ${name}.`);
  for(const weapon of ['rifle','sabre','pistol','knife'])if(!weapons[weapon])throw Error(`Falta el modelo de ${weapon}.`);
  for(const weapon of ['rifle','pistol'])if(!muzzles[weapon])throw Error(`Falta la boca de ${weapon}.`);
  if(!skinMaterials.size)throw Error('Falta el material de piel.');
  scene.add(model);clips=asset.animations;mixer=new THREE.AnimationMixer(model);
  mixer.addEventListener('finished',event=>{if(event.action===currentAction&&state.attacking)returnToSelectedPose();});
  state.ready=true;applySkin(state.skin);selectWeapon(state.weapon);
  if([...$('#action-choice').options].some(option=>option.value===previousAttack)){chosenAttack=previousAttack;$('#action-choice').value=previousAttack;}
  updateBayonet();updateControls();mixer.update(0);
  $('#loading').classList.add('hidden');window.dispatchEvent(new Event('granadero-ready'));
 }catch(error){
  if(version!==loadVersion)return;
  $('#loading').innerHTML='<strong>No se pudo cargar el personaje.</strong><span>Elegí otro personaje o volvé a abrir la página.</span>';
  $('#status').textContent=error.message;console.error(error);
 }
}
for(const [value,label] of characterChoices){const option=document.createElement('option');option.value=value;option.textContent=label;$('#character-choice').append(option);}
$('#character-choice').addEventListener('change',event=>load(event.target.value));

updateControls();
document.querySelectorAll('[data-weapon]').forEach(button=>button.addEventListener('click',()=>selectWeapon(button.dataset.weapon)));
document.querySelectorAll('[data-motion]').forEach(button=>button.addEventListener('click',()=>selectMotion(button.dataset.motion)));
document.querySelectorAll('[data-skin]').forEach(button=>button.addEventListener('click',()=>applySkin(button.dataset.skin)));
$('#reset-camera').addEventListener('click',()=>setCamera());
$('#zoom-in').addEventListener('click',()=>zoom(1.25));
$('#zoom-out').addEventListener('click',()=>zoom(.8));
$('#pixelated').addEventListener('change',event=>{state.pixelated=event.target.checked;});
updateAttackChoices();
$('#action-choice').addEventListener('change',event=>{chosenAttack=event.target.value;updateBayonet();updateControls();});
$('#attack').addEventListener('click',attack);
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;updateControls();});
$('#speed').addEventListener('input',event=>{state.speed=Number(event.target.value);$('#speed-value').textContent=`${state.speed}×`;});
$('#travel').addEventListener('change',event=>{state.travel=event.target.checked;travelPhase=0;if(model){model.position.set(0,0,0);model.rotation.y=0;}if(state.travel)setCamera();updateControls();});
$('#grid').addEventListener('change',event=>grid.visible=event.target.checked);
$('#night').addEventListener('change',event=>{
 state.night=event.target.checked;
 hemi.intensity=state.night?.55:.78;sunlight.intensity=state.night?1:2.7;sunlight.color.set(state.night?'#a3b9dd':'#fff1d9');fill.intensity=state.night?.3:.38;
 scene.background.set(state.night?'#172723':'#55523e');scene.fog.color.copy(scene.background);
 scene.environmentIntensity=state.night?.10:.18;
});
canvas.addEventListener('keydown',event=>{
 if(event.code==='Space'){event.preventDefault();if(state.ready){state.paused=!state.paused;updateControls();}}
 if(event.key.toLowerCase()==='f')attack();
 if(event.key.toLowerCase()==='r')setCamera();
});
function resize(){
 const {width,height}=viewport.getBoundingClientRect();if(!width||!height)return;
 const aspect=width/height,halfHeight=3.2;
 camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
 camera.updateProjectionMatrix();renderer.setSize(width,height,false);
 if(composer){
  composer.setSize(width,height);
  pixelPass.setPixelSize(Math.max(1,1.5*renderer.getPixelRatio()));
 }
}
new ResizeObserver(resize).observe(viewport);resize();
document.addEventListener('visibilitychange',()=>previous=performance.now());
function tick(now){
 requestAnimationFrame(tick);
 const raw=Math.max(0,(now-previous)/1000);previous=now;
 if(document.hidden)return;
 if(state.ready&&raw<1){frameGaps.push(raw*1000);if(frameGaps.length>600)frameGaps.shift();}
 const delta=state.paused?0:Math.min(.1,raw)*BASE_PLAYBACK_RATE*state.speed;
 updateEffects(delta);
 if(mixer){
  const action=currentAction,wasAttacking=state.attacking;
  const before=action?.time??0;
  mixer.update(delta);
  if(wasAttacking&&!attackEvent&&action){
   const at=actionEventTime(action.getClip()),after=action.time;
   if(before<=at&&after>=at){attackEvent=true;weaponEvent();}
  }
  if(state.travel&&!state.attacking&&state.motion!=='idle'){
   const speed=manifest.locomotionSpeed?.[state.motion==='walk'?'Walk':'Run']??(state.motion==='walk'?1.1:2.4);
   const radius=3.0;travelPhase+=delta*speed/radius;
   model.position.set(radius*Math.sin(travelPhase),0,radius*(Math.cos(travelPhase)-1));
   model.rotation.y=Math.atan2(Math.cos(travelPhase),-Math.sin(travelPhase));
  }
 }
 controls.update();if(state.pixelated)composer.render();else renderer.render(scene,camera);
}
requestAnimationFrame(tick);load();

// Read-only observations for repeatable local browser verification.
window.granaderoPlayground={
 inspect(){
  const skins=[...skinMaterials].map(material=>({name:material.name,color:`#${material.color.getHexString()}`}));
  const elapsedFrames=[...frameGaps].sort((a,b)=>a-b);
  const rig={};
  if(model)model.traverse(object=>{if(object.isBone&&/arm|hand|leg|spine|head/i.test(object.name))rig[object.name]=object.quaternion.toArray();});
  return {state:{...state},clipTime:currentAction?.time??0,clips:clips.map(clip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.length})),bayonet:bayonet?.visible??state.character==='reference',weapons:Object.fromEntries(Object.entries(weapons).map(([key,value])=>[key,value.visible])),skins,rig,position:model?.position.toArray()??null,camera:{orthographic:camera.isOrthographicCamera,rotationEnabled:controls.enableRotate,position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom},effects:effects.length,flash:flash.visible,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:frameGaps.length,p95FrameMs:elapsedFrames[Math.floor(elapsedFrames.length*.95)]??null};
 }
};
