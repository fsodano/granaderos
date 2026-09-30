import {nearbyLootOptions} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {createBattle,actBattle,carriedWeight} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage,transferItemQuantity} from '../game/tactical-inventory.js';
import {BODY_SLOTS,wornOutfit,makeOutfit} from '../game/outfits.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
const {default:CampaignPockets}=await import('../web/app/CampaignPockets.tsx');
const step=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const personal=s=>sectorInventoryModel(s,'retiro',rosterFor(s),110).personal;
const move=(u,from,to)=>({sourceId:from,destinationId:to,expectedSource:equipmentFingerprint(u,from),expectedDestination:equipmentFingerprint(u,to)});
const garments=u=>[...BODY_SLOTS.map(slot=>wornOutfit(u,slot)),...Object.values(u.inventory??{}),u.equipmentCursor?.stack].filter(v=>v?.kind==='outfit').map(({item,...v})=>v).sort((a,b)=>a.outfit.localeCompare(b.outfit));

test('normal recruit body equipment survives campaign placement, battle cursor, save, return and reentry',()=>{
 let campaign=step(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
 const issued=personal(campaign),original=garments(issued),weight=carriedWeight(issued);
 assert.deepEqual(BODY_SLOTS.map(slot=>issued[slot]?.outfit),['hat','poncho','trousers']);
 const html=render(h(CampaignPockets,{unit:issued,disabled:false,onOrder:()=>{}}));
 for(const name of ['Cabeza: Sombrero','Torso: Poncho','Piernas: Pantalón'])assert.ok(html.includes(name));
 campaign=step(campaign,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'dragEquipment',...move(issued,'headwear','large-4')});
 assert.equal(personal(campaign).headwear,null);assert.deepEqual(garments(personal(campaign)),original);assert.equal(carriedWeight(personal(campaign)),weight);
 campaign=decodeSave(encodeSave(campaign)).campaign;
 campaign=step(campaign,{type:'visitSector'});
 let pair=prepareCampaignBattle(campaign,{placement:false});assert.equal(pair.error,null);
 let unit=pair.battle.units.find(u=>u.id==='110');
 assert.equal(unit.headwear,null);assert.equal(unit.legwear.outfit,'trousers');
 const pocket=inventoryUsage(unit).slots.find(slot=>slot.entry?.label==='Sombrero de fieltro').id;
 const moved=actBattle(pair.battle,{type:'dragEquipment',unitId:'110',...move(unit,pocket,'headwear')});
 assert.equal(moved.lastError,null);unit=moved.units.find(u=>u.id==='110');assert.equal(unit.headwear.outfit,'hat');assert.deepEqual(garments(unit),original);
 pair=syncBattleTime(pair.campaign,moved);assert.equal(pair.error,null);
 pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 campaign=step(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.deepEqual(garments(personal(campaign)),original);
 campaign=step(campaign,{type:'visitSector'});pair=prepareCampaignBattle(campaign,{placement:false});assert.equal(pair.error,null);
 assert.deepEqual(garments(pair.battle.units.find(u=>u.id==='110')),original);
});

test('incompatible body placements and malformed saved garments are rejected without losing items',()=>{
 let campaign=step(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'}),unit=personal(campaign);
 for(const [from,to] of [['headwear','outfit'],['legwear','headwear'],['outfit','small-1']]){
  const before=structuredClone(campaign),rejected=dispatchCampaign(campaign,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'dragEquipment',...move(unit,from,to)});
  assert.ok(rejected.lastError);assert.deepEqual(rejected.operativeState,before.operativeState);assert.deepEqual(campaign,before);
 }
 const invalid=structuredClone(campaign);invalid.operativeState[110].headwear=makeOutfit('poncho');
 assert.throws(()=>decodeSave(encodeSave(invalid)),/vestimenta/);
 const duplicate=structuredClone(campaign);duplicate.operativeState[110].headwear.instanceId='same-garment';duplicate.operativeState[110].legwear.instanceId='same-garment';
 assert.throws(()=>decodeSave(encodeSave(duplicate)),/identidad|duplicad/i);
 const legacy=structuredClone(campaign);delete legacy.operativeState[110].headwear;delete legacy.operativeState[110].legwear;
 const restored=decodeSave(encodeSave(legacy));assert.equal(wornOutfit(personal(restored.campaign),'headwear'),null);
});

for(const [slot,kind] of [['headwear','hat'],['legwear','trousers']])test(`${slot} survives transfer, drop and corpse recovery exactly once`,()=>{
 const garment={...makeOutfit(kind,47),instanceId:`worn-${kind}`};
 const field=(own,corpse)=>createBattle([{id:'p',x:2,y:2,weapon:1805,...own}],{width:20,height:8,seed:127,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[...(corpse?[{id:'body',x:3,y:2,hp:0,...corpse}]:[]),{id:'reserve',x:18,y:6,patrol:false,overwatch:false}]});
 const packed=u=>Object.values(u.inventory).filter(v=>v.instanceId===garment.instanceId);
 const original=field({[slot]:garment}),transferred=transferItemQuantity(original.units[0],{id:'q',weapon:0,inventory:{}},slot);
 assert.equal(transferred.source[slot],null);assert.deepEqual(packed(transferred.target),[garment]);
 let dropped=actBattle(original,{type:'drop',unitId:'p',item:slot});assert.equal(dropped.lastError,null);assert.equal(dropped.units[0][slot],null);
 const drop=nearbyLootOptions(dropped,dropped.units[0]).find(row=>row.instanceId===garment.instanceId);assert.ok(drop);
 const recovered=actBattle(dropped,{...drop.action,unitId:'p'});assert.equal(recovered.lastError,null);assert.deepEqual(packed(recovered.units[0]),[garment]);
 assert.ok(!nearbyLootOptions(recovered,recovered.units[0]).some(row=>row.instanceId===garment.instanceId));
 assert.doesNotThrow(()=>validateBattleSnapshot(recovered));
 const bodies=field({}, {[slot]:garment}),row=nearbyLootOptions(bodies,bodies.units[0]).find(row=>row.item===slot);assert.ok(row);
 const looted=actBattle(bodies,{...row.action,unitId:'p'});assert.equal(looted.lastError,null);assert.equal(looted.units.find(u=>u.id==='body')[slot],null);assert.deepEqual(packed(looted.units[0]),[garment]);
 assert.doesNotThrow(()=>validateBattleSnapshot(looted));assert.deepEqual(original.units[0][slot],garment);
});
