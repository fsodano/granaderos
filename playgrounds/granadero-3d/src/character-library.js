import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

export const characterChoices=[
 ['reference','Granadero · prototipo anterior'],['granadero','Granadero · juego'],
 ['royalist','Realista'],['worker','Trabajador'],['surgeon','Cirujano'],['gaucho','Gaucho'],
 ['friar','Fraile'],['woman-scout','Exploradora'],['woman-shawl','Mujer con rebozo']
];
const representativeItems={rifle:'1800',pistol:'1805',sabre:'1809',knife:'1813'};
const transform=(object,spec)=>{
 object.position.fromArray(spec.position??[0,0,0]);
 object.rotation.fromArray([...(spec.rotation??[0,0,0]),'XYZ']);
 object.scale.setScalar(spec.scale??1);
};
/** Use the same native skeleton, sockets and item transforms as the game. */
export function prepareProductionCharacter(body,animation,equipment,library,appearance){
 const scene=cloneSkeleton(body.scene),bank=library.animationLibraries[appearance.animationLibrary];
 const animations=[],metadata=[],seen=new Set();
 for(const spec of bank.clips){
  const name=spec.reviewedPose?.name;if(!name||seen.has(name))continue;
  const source=animation.animations.find(clip=>clip.name===spec.name);
  if(!source)throw Error(`Falta la animación ${spec.name}.`);
  const clip=source.clone();clip.name=name;animations.push(clip);seen.add(name);
  metadata.push({...spec,name,events:spec.markers??spec.events});
 }
 const weapons={},muzzles={};let bayonet;
 for(const [key,id] of Object.entries(representativeItems)){
  const spec=library.equipment.items[id],source=equipment.scene.getObjectByName(spec?.node);
  if(!source)throw Error(`Falta el equipo ${id}.`);
  const socketSpec=appearance.sockets[spec.socket],socket=scene.getObjectByName(socketSpec?.node);
  if(!socket)throw Error(`Falta el agarre ${spec.socket}.`);
  const object=source.clone(true);object.name=`weapon_${key}`;transform(object,spec);socket.add(object);weapons[key]=object;
  if(spec.muzzle){const muzzle=object.getObjectByName(spec.muzzle);if(!muzzle)throw Error(`Falta la boca ${spec.muzzle}.`);muzzles[key]=muzzle;}
  if(key==='rifle'){
   const fit=library.equipment.fittings?.india_socket,source=equipment.scene.getObjectByName(fit?.node);
   if(!source)throw Error('Falta la bayoneta del fusil.');
   bayonet=source.clone(true);bayonet.name='lab_rifle_bayonet';transform(bayonet,fit);object.add(bayonet);bayonet.visible=false;
  }
 }
 const strides=Object.fromEntries(metadata.filter(spec=>['Walk','Run'].includes(spec.name)).map(spec=>[spec.name,spec.locomotionSpeed]));
 return {scene,animations,weapons,muzzles,bayonet,manifest:{sha256:appearance.lods.find(lod=>lod.lod===0).sha256,clips:metadata,locomotionSpeed:strides}};
}
