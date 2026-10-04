import {canonicalContent} from './content-identity.js';

export const ROADSIDE_DISCOVERY_CHEST='roadside:cell-24-27:clothing-tools';
export const ROADSIDE_CROWBAR_ID='cache:cell-24-27:crowbar';
export const ROADSIDE_SHIRT_ID='cache:cell-24-27:linen-shirt';
const fields=['version','id','cell','x','y','crowbarCondition','linenShirtCondition'];
const integer=v=>Number.isSafeInteger(v)&&v>=1&&v<=100;

// This small fictional cache is game tuning. Only an explicit pinned record
// enables it; an omitted collection in an older campaign stays disabled.
export function freshDefaultRoadsideDiscoveries(){
 return [{version:1,id:'roadside-clothing-tools',cell:'cell-24-27',x:10,y:7,crowbarCondition:60,linenShirtCondition:75}];
}
export function validateRoadsideDiscoveries(definitions){
 if(definitions===undefined)return [];
 if(!Array.isArray(definitions)||definitions.length>1||Object.keys(definitions).length!==definitions.length)
  return ['Hallazgos de camino: se necesita una lista de hasta un hallazgo.'];
 const errors=[];
 for(const d of definitions){
  const object=d!==null&&typeof d==='object'&&!Array.isArray(d)&&[Object.prototype,null].includes(Object.getPrototypeOf(d));
  if(!object||Object.keys(d).length!==fields.length||!fields.every(key=>Object.hasOwn(d,key))||
   d.version!==1||d.id!=='roadside-clothing-tools'||d.cell!=='cell-24-27'||d.x!==10||d.y!==7||
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
 return (definitions??[]).filter(d=>d.cell===cell).map(d=>({id:ROADSIDE_DISCOVERY_CHEST,type:'chest',x:d.x,y:d.y,blocksMovement:true}));
}
export function roadsideDiscoveryForMap(cell,map){
 const definitions=map.roadsideDiscoveryDefinitions;
 if(validateRoadsideDiscoveries(definitions).length)throw Error('Los hallazgos de camino no son válidos.');
 return (definitions??[]).find(d=>d.cell===cell&&(map.props??[]).some(p=>p.id===ROADSIDE_DISCOVERY_CHEST&&p.type==='chest'))??null;
}
