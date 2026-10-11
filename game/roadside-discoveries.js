import {DEFAULT_CATALOGUE} from '../campaigns/default.js';
import {canonicalContent} from './content-identity.js';

export const ROADSIDE_DISCOVERY_CHEST='roadside:cell-24-27:clothing-tools';
export const ROADSIDE_CROWBAR_ID='cache:cell-24-27:crowbar';
export const ROADSIDE_SHIRT_ID='cache:cell-24-27:linen-shirt';
const fields=['version','id','cell','x','y','crowbarCondition','linenShirtCondition'];
const integer=v=>Number.isSafeInteger(v)&&v>=1&&v<=100;

// This small fictional cache is game tuning. Only an explicit pinned record
// enables it; an omitted collection in an older campaign stays disabled.
export function freshDefaultRoadsideDiscoveries(){return structuredClone(DEFAULT_CATALOGUE.roadsideDiscoveries);}
export function roadsideDiscoveryIds(definition){
 if(definition.id==='roadside-clothing-tools'&&definition.cell==='cell-24-27')return {chest:ROADSIDE_DISCOVERY_CHEST,crowbar:ROADSIDE_CROWBAR_ID,shirt:ROADSIDE_SHIRT_ID};
 return {chest:`roadside:${definition.cell}:${definition.id}`,crowbar:`cache:${definition.cell}:${definition.id}:crowbar`,shirt:`cache:${definition.cell}:${definition.id}:linen-shirt`};
}
export function validateRoadsideDiscoveries(definitions,context=null){
 if(definitions===undefined)return [];
 if(!Array.isArray(definitions)||definitions.length>1||Object.keys(definitions).length!==definitions.length)
  return ['Hallazgos de camino: se necesita una lista de hasta un hallazgo.'];
 const errors=[];
 for(const d of definitions){
  const object=d!==null&&typeof d==='object'&&!Array.isArray(d)&&[Object.prototype,null].includes(Object.getPrototypeOf(d));
  if(!object||Object.keys(d).length!==fields.length||!fields.every(key=>Object.hasOwn(d,key))||
   d.version!==1||typeof d.id!=='string'||!/^[a-z][a-z0-9-]{0,59}$/.test(d.id)||['constructor','prototype'].includes(d.id)||
   typeof d.cell!=='string'||!/^cell-(\d|[12]\d|3[0-5])-(\d|[12]\d|3[0-2])$/.test(d.cell)||
   context?.world&&(!Array.isArray(context.world.cells)||!context.world.cells.some(cell=>cell.id===d.cell&&cell.land))||
   !Number.isSafeInteger(d.x)||!Number.isSafeInteger(d.y)||d.x<0||d.y<0||d.x>=20||d.y>=16||
   !integer(d.crowbarCondition)||!integer(d.linenShirtCondition))errors.push('Hallazgo de camino: definición o versión inválida.');
 }
 return errors;
}
export function roadsideDiscoveriesFor(campaign){
 const definitions=campaign.contentCampaign?campaign.contentCampaign.package.roadsideDiscoveries:campaign.roadsideDiscoveryDefinitions;
 return definitions===undefined?[]:definitions;
}
export function validateRoadsideDiscoveryContext(campaign,scene){
 const definitions=roadsideDiscoveriesFor(campaign);
 if(!scene||validateRoadsideDiscoveries(definitions).length||validateRoadsideDiscoveries(scene.roadsideDiscoveryDefinitions).length||
  canonicalContent(scene.roadsideDiscoveryDefinitions??[])!==canonicalContent(definitions))
  throw Error('Los hallazgos de camino del despliegue no coinciden con la campaña.');
}
export function roadsideDiscoveryProps(cell,definitions){
 if(validateRoadsideDiscoveries(definitions).length)throw Error('Los hallazgos de camino no son válidos.');
 return (definitions??[]).filter(d=>d.cell===cell).map(d=>({id:roadsideDiscoveryIds(d).chest,type:'chest',x:d.x,y:d.y,blocksMovement:true}));
}
export function roadsideDiscoveryForMap(cell,map){
 const definitions=map.roadsideDiscoveryDefinitions;
 if(validateRoadsideDiscoveries(definitions).length)throw Error('Los hallazgos de camino no son válidos.');
 // The admitted prop identifies the selected physical cell, including a
 // named locality whose map is keyed by its locality ID.
 return (definitions??[]).find(d=>(map.props??[]).some(p=>p.id===roadsideDiscoveryIds(d).chest&&p.type==='chest'))??null;
}
