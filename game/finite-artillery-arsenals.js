import {FINITE_SECTOR_CACHES} from './finite-sector-caches.js';
import {propBlocksAt} from './props.js';

// One-time gameplay inventories, not reconstructed historical arsenal counts.
// These pieces are discovered only during a visit to a conquered arsenal.
const source=(sector,types)=>Object.freeze({version:1,sector,chest:FINITE_SECTOR_CACHES[sector].chest,pieces:types.map((type,index)=>Object.freeze({id:`arsenal:${sector}:${index+1}`,type,side:'player',loaded:true,ammo:6}))});
export const FINITE_ARTILLERY_ARSENALS=Object.freeze({buenos_aires:source('buenos_aires',['bronze4']),cordoba:source('cordoba',['bronze4','bronze4']),ensenada:source('ensenada',['field8','swivel'])});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(ok,message='El registro del arsenal de artillería es inválido.')=>{if(!ok)throw Error(message);};
const fields=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const staticPiece=id=>Object.values(FINITE_ARTILLERY_ARSENALS).flatMap(source=>source.pieces).find(piece=>piece.id===id);
export function validateFiniteArsenalSource(value,sector){
 const source=FINITE_ARTILLERY_ARSENALS[sector];
 need(source&&fields(value,['version','sector','chest','pieces'])&&value.version===1&&value.sector===sector&&value.chest===source.chest&&Array.isArray(value.pieces)&&value.pieces.length===source.pieces.length);
 for(const [index,piece]of value.pieces.entries())need(fields(piece,['id','type','side','loaded','ammo'])&&Object.keys(source.pieces[index]).every(key=>piece[key]===source.pieces[index][key]));
 return source;
}
export function initializeFiniteArtilleryArsenals(state){
 if(state.artilleryArsenalVersion===undefined){need(state.artilleryArsenalRecoveries===undefined);state.artilleryArsenalVersion=1;state.artilleryArsenalRecoveries={};}
 need(state.artilleryArsenalVersion===1&&object(state.artilleryArsenalRecoveries));
}
export function prepareFiniteArsenalRequest(state,request){
 initializeFiniteArtilleryArsenals(state);delete request.finiteArtilleryArsenal;
 const source=FINITE_ARTILLERY_ARSENALS[request.sector];
 if(source&&request.exploration===true&&!request.sceneId&&state.sectors[request.sector]?.owner==='patriot'&&!state.artilleryArsenalRecoveries[request.sector]&&request.squad?.length)request.finiteArtilleryArsenal=structuredClone(source);
}
export function revealFiniteArsenal(battle){
 const metadata=battle.finiteArtilleryArsenal;if(!metadata)return [];
 const source=validateFiniteArsenalSource(metadata,battle.sectorId),chest=battle.props?.find(prop=>prop.id===source.chest&&prop.type==='chest');
 if(!chest?.open||!chest.knownToPlayer||chest.locked||chest.trap?.armed||chest.artilleryRecovered||battle.mode!=='exploration'||!battle.units.some(unit=>unit.side==='player'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.departure))return [];
 need(source.pieces.every(piece=>!(battle.artillery??[]).some(gun=>gun.id===piece.id)));
 const occupied=new Set([...(battle.artillery??[]),...battle.units.filter(unit=>unit.hp>0&&!unit.departure)].map(point=>`${point.x},${point.y}`));
 const cells=battle.tiles.filter(tile=>!tile.blocked&&tile.type!=='water'&&!propBlocksAt(battle,tile.x,tile.y)).sort((a,b)=>Math.abs(a.x-chest.x)+Math.abs(a.y-chest.y)-Math.abs(b.x-chest.x)-Math.abs(b.y-chest.y)||a.y-b.y||a.x-b.x);
 const pieces=source.pieces.map(piece=>{const point=cells.find(cell=>!occupied.has(`${cell.x},${cell.y}`));need(point,'No queda espacio para emplazar las piezas del arsenal.');occupied.add(`${point.x},${point.y}`);return {...structuredClone(piece),x:point.x,y:point.y};});
 battle.artillery.push(...pieces);chest.artilleryRecovered=source.pieces.map(piece=>piece.id);return pieces;
}
export function validateFiniteArsenalScene(battle){
 if(battle.finiteArtilleryArsenal!==undefined)validateFiniteArsenalSource(battle.finiteArtilleryArsenal,battle.sectorId);
 for(const chest of battle.props??[])if(chest.artilleryRecovered!==undefined){
  const source=FINITE_ARTILLERY_ARSENALS[battle.sectorId];need(source&&chest.id===source.chest&&chest.type==='chest'&&Array.isArray(chest.artilleryRecovered)&&chest.artilleryRecovered.length===source.pieces.length&&source.pieces.every((piece,index)=>chest.artilleryRecovered[index]===piece.id));
 }
 for(const gun of battle.artillery??[])if(gun.id?.startsWith('arsenal:')){const original=staticPiece(gun.id);need(original&&gun.type===original.type&&gun.ammo+Number(gun.loaded)<=7);}
}
export function finiteArsenalReportPieces(request,battle){
 const source=request.finiteArtilleryArsenal&&validateFiniteArsenalSource(request.finiteArtilleryArsenal,request.sector);
 const extras=(battle?.artillery??[]).filter(gun=>!(request.artillery??[]).some(original=>original.id===gun.id));
 if(!source){need(extras.length===0,'El parte añade piezas ajenas al despliegue.');return [];}
 need(request.exploration===true&&!request.sceneId&&battle?.sectorId===request.sector);
 need(battle.finiteArtilleryArsenal!==undefined);validateFiniteArsenalSource(battle.finiteArtilleryArsenal,request.sector);
 const chest=battle.props?.find(prop=>prop.id===source.chest&&prop.type==='chest');
 if(!extras.length){need(chest?.artilleryRecovered===undefined);return [];}
 need(extras.length===source.pieces.length&&chest?.knownToPlayer===true&&!chest.locked&&!chest.trap?.armed&&Array.isArray(chest.artilleryRecovered)&&source.pieces.every((piece,index)=>chest.artilleryRecovered[index]===piece.id),'El parte no conserva el descubrimiento físico del arsenal.');
 for(const original of source.pieces){const actual=extras.find(gun=>gun.id===original.id);need(actual&&actual.type===original.type&&actual.side==='player'&&actual.ammo+Number(actual.loaded)<=7,'El parte altera una pieza o añade disparos al arsenal.');}
 validateFiniteArsenalScene(battle);return extras;
}
export function recordFiniteArsenalRecovery(state,request,battle){
 const pieces=finiteArsenalReportPieces(request,battle);if(!pieces.length)return;
 initializeFiniteArtilleryArsenals(state);need(!state.artilleryArsenalRecoveries[request.sector],'El arsenal ya fue recuperado.');
 state.artilleryArsenalRecoveries[request.sector]={battleId:request.id,hour:state.hour,second:state.secondOfHour??0};
}
export function validateFiniteArtilleryArsenals(state){
 initializeFiniteArtilleryArsenals(state);
 const scenes=[...Object.values(state.sectorStates??{}),...Object.values(state.sceneStates??{})];
 const pieces=scenes.flatMap(scene=>scene.artillery??[]);
 pieces.push(...Object.values(state.artilleryDepots??{}).flat(),...(state.artilleryTransfers??[]).map(transfer=>transfer.gun),...Object.values(state.artilleryMerchants??{}).flatMap(merchant=>merchant.guns??[]),...(state.pendingBattle?.artillery??[]).filter(gun=>!gun.stationed));
 for(const [sector,receipt]of Object.entries(state.artilleryArsenalRecoveries)){
  const source=FINITE_ARTILLERY_ARSENALS[sector];
  need(source&&fields(receipt,['battleId','hour','second'])&&typeof receipt.battleId==='string'&&receipt.battleId.length>0&&receipt.battleId.length<100&&Number.isSafeInteger(receipt.hour)&&receipt.hour>=0&&receipt.hour<=state.hour&&Number.isSafeInteger(receipt.second)&&receipt.second>=0&&receipt.second<3600&&receipt.hour*3600+receipt.second<=state.hour*3600+(state.secondOfHour??0));
  need(source.pieces.every(original=>pieces.some(gun=>gun.id===original.id)),'El registro del arsenal no conserva sus piezas.');
  need(scenes.some(scene=>scene.sectorId===sector&&scene.props?.some(prop=>prop.id===source.chest&&prop.artilleryRecovered!==undefined)),'El registro del arsenal no conserva su descubrimiento.');
 }
 for(const gun of pieces)if(gun.id?.startsWith('arsenal:')){const original=staticPiece(gun.id),sector=Object.keys(FINITE_ARTILLERY_ARSENALS).find(sector=>FINITE_ARTILLERY_ARSENALS[sector].pieces.some(piece=>piece.id===gun.id));need(original&&state.artilleryArsenalRecoveries[sector]&&gun.type===original.type&&gun.ammo+Number(gun.loaded)<=7,'Una pieza del arsenal carece de origen o tiene munición añadida.');}
 for(const scene of scenes){validateFiniteArsenalScene(scene);for(const prop of scene.props??[])if(prop.artilleryRecovered!==undefined)need(state.artilleryArsenalRecoveries[scene.sectorId],'El descubrimiento del arsenal carece de registro.');}
 const request=state.pendingBattle;
 if(request?.finiteArtilleryArsenal!==undefined){validateFiniteArsenalSource(request.finiteArtilleryArsenal,request.sector);need(request.exploration===true&&!request.sceneId&&state.sectors[request.sector]?.owner==='patriot'&&!state.artilleryArsenalRecoveries[request.sector]&&request.squad?.length&&request.squad.every(unit=>state.recruited.includes(unit.id)&&state.operativeState[unit.id]?.alive&&state.operativeState[unit.id]?.location===request.sector),'La recuperación del arsenal requiere una escuadra local en un sector conquistado.');}
}
export function finiteArsenalHint(state,sector=state.location){
 const source=FINITE_ARTILLERY_ARSENALS[sector];
 return source&&state.sectors[sector]?.owner==='patriot'&&!state.artilleryArsenalRecoveries?.[sector]?`Explorá el arsenal del sector y abrí su cofre para recuperar ${source.pieces.length} ${source.pieces.length===1?'pieza propia':'piezas propias'} con munición finita.`:null;
}
