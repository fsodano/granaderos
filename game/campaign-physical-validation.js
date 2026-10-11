import {DEFAULT_WORLD} from '../campaigns/default.js';
import {ARTILLERY} from './artillery-definitions.js';
import {validateEnvironment} from './environment-interactions.js';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>object(value)&&Object.hasOwn(value,key);

const key=value=>typeof value==='string'&&value.length>0&&value.length<=100&&!/[<>\x00-\x1f]/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
const fields=(value,required,optional=[])=>object(value)&&required.every(k=>own(value,k))&&Object.keys(value).every(k=>required.includes(k)||optional.includes(k));
const environmentFields=['open','locked','broken','keyId','lockDifficulty','lockIntegrity','trap','contents'];
export function validateCampaignPhysical(value,world=DEFAULT_WORLD){
 if(value===undefined)return [];
 const errors=[],check=(valid,message)=>{if(!valid)errors.push(`Fuentes físicas: ${message}`);};
 if(!fields(value,['version','caches','arsenals','environment'])||value.version!==1||!['caches','arsenals','environment'].every(k=>object(value[k])))return ['Fuentes físicas: definición o versión inválida.'];
 const places=new Set([...(world.sectors??[]).map(s=>s.id),...(world.cells??[]).map(c=>c.location)]);
 // A scene can have its own map without being a strategic locality.
 for(const scene of Object.keys(value.environment))places.add(scene);
 const identities=new Set(),checkEnvironment=target=>{try{validateEnvironment(target);}catch(error){check(false,error.message);}};
 for(const kind of ['caches','arsenals','environment']){
  check(Object.keys(value[kind]).length<=2000,'demasiados lugares.');
  for(const place of Object.keys(value[kind]))check(key(place)&&places.has(place),`lugar inválido: ${place}.`);
 }
 for(const [place,cache]of Object.entries(value.caches)){
  if(!fields(cache,['chest','contents'])||!key(cache.chest)){check(false,`recipiente inválido: ${place}.`);continue;}
  checkEnvironment({id:cache.chest,type:'chest',open:false,locked:false,contents:cache.contents});
  for(const stack of Array.isArray(cache.contents)?cache.contents:[])if(stack?.instanceId!==undefined){check(!identities.has(stack.instanceId),'identidad de equipo repetida.');identities.add(stack.instanceId);}
 }
 const pieceIds=new Set();
 for(const [place,source]of Object.entries(value.arsenals)){
  if(!fields(source,['version','sector','chest','pieces'])||source.version!==1||source.sector!==place||!key(source.chest)||!Array.isArray(source.pieces)||source.pieces.length<1||source.pieces.length>2000){check(false,`arsenal inválido: ${place}.`);continue;}
  for(const piece of source.pieces){
   const valid=fields(piece,['id','type','side','loaded','ammo'])&&key(piece.id)&&piece.id.startsWith('arsenal:')&&!pieceIds.has(piece.id)&&own(ARTILLERY,piece.type)&&piece.side==='player'&&typeof piece.loaded==='boolean'&&Number.isSafeInteger(piece.ammo)&&piece.ammo>=0&&piece.ammo<=1000;
   check(valid,`pieza inválida: ${piece?.id??place}.`);pieceIds.add(piece?.id);
  }
 }
 for(const [place,environment]of Object.entries(value.environment)){
  if(!fields(environment,['doors','containers'])||!Array.isArray(environment.doors)||!Array.isArray(environment.containers)||environment.doors.length>2000||environment.containers.length>2000){check(false,`entorno inválido: ${place}.`);continue;}
  for(const door of environment.doors){check(fields(door,['id','type'],environmentFields)&&key(door.id)&&door.type==='door',`puerta inválida: ${place}.`);checkEnvironment(door);}
  for(const entry of environment.containers){
   if(!fields(entry,['selector','configuration'])||!fields(entry.selector,['type'],['id','buildingId','purpose'])||!['chest','container'].includes(entry.selector.type)||!Object.entries(entry.selector).every(([,v])=>key(v))||!(entry.selector.id||entry.selector.buildingId&&entry.selector.purpose)||!fields(entry.configuration,['type'],environmentFields)||entry.configuration.type!==entry.selector.type){check(false,`selector de recipiente inválido: ${place}.`);continue;}
   checkEnvironment(entry.configuration);
   for(const stack of Array.isArray(entry.configuration.contents)?entry.configuration.contents:[])if(stack?.instanceId!==undefined){check(!identities.has(stack.instanceId),'identidad de equipo repetida.');identities.add(stack.instanceId);}
  }
 }
 return errors;
}
