import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const $=selector=>document.querySelector(selector);
const canvas=$('#scene'),viewport=$('#viewport');
const state={ready:false,weapon:'none',motion:'walk',skin:'blanco',paused:false,speed:1,travel:false,attacking:false,clip:null,night:false};
const labels={none:'Sin arma',rifle:'Fusil',sabre:'Sable',pistol:'Pistola',idle:'Quieto',walk:'Caminando',run:'Corriendo'};
const palettes={blanco:'#d8a783',moreno:'#9b6441',negro:'#513023'};
const skinLabels={blanco:'Blanco',moreno:'Moreno',negro:'Negro'};
const readyClips={none:'Idle',rifle:'RifleAim',sabre:'SabreReady',pistol:'PistolAim'};
const attackClips={rifle:'RifleFire',sabre:'SabreSlash',pistol:'PistolFire'};
const frameGaps=[];
let renderer;
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
scene.environmentIntensity=.24;
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
 controls.target.set(0,.92,0);
 camera.zoom=1;
 camera.updateProjectionMatrix();
 controls.update();resize();
}
setCamera();
function zoom(amount){camera.zoom=THREE.MathUtils.clamp(camera.zoom*amount,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();controls.update();}

const hemi=new THREE.HemisphereLight('#e2e7ed','#554631',1.15);scene.add(hemi);
const sunlight=new THREE.DirectionalLight('#fff1d9',2.7);
sunlight.position.set(-4,9,5);sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048);
Object.assign(sunlight.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});
sunlight.shadow.normalBias=.025;sunlight.shadow.bias=-.0001;
scene.add(sunlight);
const fill=new THREE.DirectionalLight('#c3d8ec',.55);fill.position.set(4,3,-4);scene.add(fill);
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
let model,mixer,currentAction,clips=[],manifest={},attackEvent=false,flashLife=0;
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
 $('#attack').disabled=!state.ready||state.weapon==='none'||state.paused;
 $('#attack-label').textContent=state.weapon==='none'?'Elegí un arma':gun?'Disparar':'Golpear con el sable';
 $('#attack-icon').textContent=state.weapon==='sabre'?'↘':'→';
 $('#attack-description').textContent=state.weapon==='none'?'El granadero camina y corre con las manos libres.':state.weapon==='rifle'?'Apunta con el fusil, dispara y vuelve a la posición de espera.':state.weapon==='pistol'?'Apunta con una mano. Observá el retroceso al disparar.':'Un corte de sable, seguido por el regreso a la guardia.';
 $('#pause').disabled=!state.ready;
 $('#pause').innerHTML=state.paused?'▶ <span>Continuar</span>':'Ⅱ <span>Pausar</span>';
 $('#pause').setAttribute('aria-label',state.paused?'Continuar animación':'Pausar animación');
 $('#scene-state').textContent=state.attacking?(state.weapon==='sabre'?'Corte de sable':'Disparando'):`${labels[state.motion]} · ${labels[state.weapon]}`;
 if(state.paused)$('#scene-state').textContent+=' · Pausado';
 $('#motion-state').textContent=state.travel&&state.motion!=='idle'?'Recorriendo el terreno':'En el sitio';
 $('#status').textContent=state.ready?`${labels[state.weapon]} · Piel: ${skinLabels[state.skin]} · ${state.paused?'Pausado':'Listo para probar'}`:'Cargando el modelo…';
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
 const chosen=locomotion??readyClips[state.weapon];
 playClip(chosen,{fade});updateControls();
}
function applySkin(tone){state.skin=tone;for(const material of skinMaterials)material.color.set(palettes[tone]);updateControls();}
function selectWeapon(weapon){
 if(!state.ready)return;
 state.weapon=weapon;state.motion='idle';state.attacking=false;
 clearEffects();mixer.stopAllAction();currentAction=null;
 for(const [name,object]of Object.entries(weapons))object.visible=name===weapon;
 target.visible=weapon==='rifle'||weapon==='pistol';
 model.position.set(0,0,0);model.rotation.y=0;travelPhase=0;
 returnToSelectedPose(0);
}
function selectMotion(motion){
 if(!state.ready)return;
 if(motion!=='idle'&&state.weapon!=='none')selectWeapon('none');
 state.motion=motion;state.attacking=false;clearEffects();
 model.position.set(0,0,0);model.rotation.y=0;travelPhase=0;
 if(state.paused){
  mixer.stopAllAction();currentAction=null;
  returnToSelectedPose(0);mixer.update(0);
 }else returnToSelectedPose();
}
function attack(){
 if(!state.ready||state.weapon==='none'||state.paused)return;
 state.motion='idle';state.attacking=true;attackEvent=false;
 clearEffects();model.position.set(0,0,0);model.rotation.y=0;travelPhase=0;
 playClip(attackClips[state.weapon],{once:true,fade:.08});updateControls();
}
function weaponEvent(){
 if(state.weapon==='sabre'){
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
 const bullet=new THREE.Mesh(bulletGeometry,new THREE.MeshBasicMaterial({color:'#e6c074'}));bullet.position.copy(point);scene.add(bullet);
 effects.push({mesh:bullet,kind:'bullet',age:0,life:.12,velocity:forward.clone().multiplyScalar(21)});
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
 return typeof event==='number'?event:event?.time??event?.shot??event?.hit??clip.duration*.4;
}

async function load(){
 try{
  const response=await fetch('/assets/asset-manifest.json');if(response.ok)manifest=await response.json();
  const gltf=await new GLTFLoader().loadAsync('/assets/granadero.glb');model=gltf.scene;
  model.traverse(object=>{
   if(object.isMesh){object.castShadow=true;object.receiveShadow=true;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    const cloned=materials.map(material=>{
     const value=material.clone();
     if(/^skin(?:[._]|$)/i.test(value.name))skinMaterials.add(value);
     return value;
    });object.material=Array.isArray(object.material)?cloned:cloned[0];
   }
   for(const weapon of ['rifle','sabre','pistol']){
    if(object.name===`weapon_${weapon}`)weapons[weapon]=object;
    if(object.name===`muzzle_${weapon}`)muzzles[weapon]=object;
   }
  });
  const required=['Idle','Walk','Run','RifleAim','RifleFire','SabreReady','SabreSlash','PistolAim','PistolFire'];
  for(const name of required)if(!gltf.animations.some(clip=>clip.name===name))throw new Error(`El modelo no contiene ${name}.`);
  for(const weapon of ['rifle','sabre','pistol'])if(!weapons[weapon])throw new Error(`Falta el modelo de ${weapon}.`);
  for(const weapon of ['rifle','pistol'])if(!muzzles[weapon])throw new Error(`Falta la boca de ${weapon}.`);
  if(!skinMaterials.size)throw new Error('Falta el material de piel.');
  scene.add(model);for(const object of Object.values(weapons))object.visible=false;
  clips=gltf.animations;mixer=new THREE.AnimationMixer(model);
  mixer.addEventListener('finished',event=>{if(event.action===currentAction&&state.attacking)returnToSelectedPose();});
  state.ready=true;applySkin(state.skin);returnToSelectedPose(0);
  $('#loading').classList.add('hidden');
  window.dispatchEvent(new Event('granadero-ready'));
 }catch(error){
  $('#loading').innerHTML='<strong>No se pudo cargar el granadero.</strong><span>Revisá el modelo y volvé a abrir la página.</span>';
  $('#status').textContent=error.message;
  console.error(error);
 }
}
updateControls();
document.querySelectorAll('[data-weapon]').forEach(button=>button.addEventListener('click',()=>selectWeapon(button.dataset.weapon)));
document.querySelectorAll('[data-motion]').forEach(button=>button.addEventListener('click',()=>selectMotion(button.dataset.motion)));
document.querySelectorAll('[data-skin]').forEach(button=>button.addEventListener('click',()=>applySkin(button.dataset.skin)));
$('#reset-camera').addEventListener('click',()=>setCamera());
$('#zoom-in').addEventListener('click',()=>zoom(1.25));
$('#zoom-out').addEventListener('click',()=>zoom(.8));
$('#attack').addEventListener('click',attack);
$('#pause').addEventListener('click',()=>{state.paused=!state.paused;updateControls();});
$('#speed').addEventListener('input',event=>{state.speed=Number(event.target.value);$('#speed-value').textContent=`${state.speed}×`;});
$('#travel').addEventListener('change',event=>{state.travel=event.target.checked;travelPhase=0;if(model){model.position.set(0,0,0);model.rotation.y=0;}if(state.travel)setCamera();updateControls();});
$('#grid').addEventListener('change',event=>grid.visible=event.target.checked);
$('#night').addEventListener('change',event=>{
 state.night=event.target.checked;
 hemi.intensity=state.night?.55:1.15;sunlight.intensity=state.night?1:2.7;sunlight.color.set(state.night?'#a3b9dd':'#fff1d9');fill.intensity=state.night?.3:.55;
 scene.background.set(state.night?'#172723':'#55523e');scene.fog.color.copy(scene.background);
 scene.environmentIntensity=state.night?.10:.24;
});
canvas.addEventListener('keydown',event=>{
 if(event.code==='Space'){event.preventDefault();if(state.ready){state.paused=!state.paused;updateControls();}}
 if(event.key.toLowerCase()==='f')attack();
 if(event.key.toLowerCase()==='r')setCamera();
});
function resize(){
 const {width,height}=viewport.getBoundingClientRect();if(!width||!height)return;
 const aspect=width/height,halfHeight=5;
 camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
 camera.updateProjectionMatrix();renderer.setSize(width,height,false);
}
new ResizeObserver(resize).observe(viewport);resize();
document.addEventListener('visibilitychange',()=>previous=performance.now());
function tick(now){
 requestAnimationFrame(tick);
 const raw=Math.max(0,(now-previous)/1000);previous=now;
 if(document.hidden)return;
 if(state.ready&&raw<1){frameGaps.push(raw*1000);if(frameGaps.length>600)frameGaps.shift();}
 const delta=state.paused?0:Math.min(.1,raw)*state.speed;
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
   const radius=1.15;travelPhase+=delta*speed/radius;
   model.position.set(radius*Math.sin(travelPhase),0,radius*(Math.cos(travelPhase)-1));
   model.rotation.y=Math.atan2(Math.cos(travelPhase),-Math.sin(travelPhase));
  }
 }
 controls.update();renderer.render(scene,camera);
}
requestAnimationFrame(tick);load();

// Read-only observations for repeatable local browser verification.
window.granaderoPlayground={
 inspect(){
  const skins=[...skinMaterials].map(material=>({name:material.name,color:`#${material.color.getHexString()}`}));
  const elapsedFrames=[...frameGaps].sort((a,b)=>a-b);
  const rig={};
  if(model)model.traverse(object=>{if(object.isBone&&/arm|hand|leg|spine|head/i.test(object.name))rig[object.name]=object.quaternion.toArray();});
  return {state:{...state},clipTime:currentAction?.time??0,clips:clips.map(clip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.length})),weapons:Object.fromEntries(Object.entries(weapons).map(([key,value])=>[key,value.visible])),skins,rig,position:model?.position.toArray()??null,camera:{orthographic:camera.isOrthographicCamera,rotationEnabled:controls.enableRotate,position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom},effects:effects.length,flash:flash.visible,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:frameGaps.length,p95FrameMs:elapsedFrames[Math.floor(elapsedFrames.length*.95)]??null};
 }
};
