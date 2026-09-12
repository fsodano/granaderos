import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {makeOutfit} from '../game/outfits.js';
import {handLayout} from '../game/hand-layout.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const step=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const fresh=()=>step(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
const actor=s=>sectorInventoryModel(s,'retiro',rosterFor(s),110).personal;
const pocket=(unit,item)=>inventoryUsage(unit).slots.find(p=>p.entry?.item===item).id;
const placement=(unit,sourceId,destinationId)=>({sourceId,destinationId,expectedSource:equipmentFingerprint(unit,sourceId),expectedDestination:equipmentFingerprint(unit,destinationId)});
const action=(s,from,to)=>({type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'equipment',...placement(actor(s),from,to)});
const garments=unit=>[...(unit.outfit?[unit.outfit]:[]),...Object.values(unit.inventory??{}).filter(r=>r.kind==='outfit')].flatMap(r=>Array.from({length:r.count},()=>({...r,count:1}))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const hand=unit=>unit.inventory[handLayout(unit).right?.slice(10)];
function move(s,from,to){
 const before=structuredClone(s),next=step(s,action(s,from,to));
 for(const key of ['hour','secondOfHour','seed','resources','sectorStates'])assert.deepEqual(next[key],before[key],`${key} must not change during campaign placement`);
 assert.deepEqual(garments(actor(next)),garments(actor(before)));assert.deepEqual(s,before);return next;
}
function save(s,b=null){const restored=decodeSave(encodeSave(s,b));assert.deepEqual(restored.campaign,s);assert.deepEqual(restored.battle,b);return restored;}
function enter(s){s=step(s,{type:'visitSector'});return {s,b:enterSector(s.pendingBattle,s.sectorStates.retiro)};}
function sync(s,b){const pair=syncBattleTime(s,b);assert.equal(pair.error,null);return {s:pair.campaign,b:pair.battle};}
function leave(s,b){({s,b}=sync(s,b));return step(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});}

test('a paid recruit keeps finite issued clothing in the selected hand and pockets through save, deployment, return and reentry',()=>{
 let s=fresh();assert.equal(s.resources.ponchos,5);
 // The issued garment has prior wear and an identity; the spare is withdrawn
 // through the real finite depot action, not added by a tactical fixture.
 s.operativeState[110].outfit={...makeOutfit('poncho',47),instanceId:'personal-poncho'};
 s=step(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'issueOutfit'});assert.equal(s.resources.ponchos,4);
 const issued=garments(actor(s));assert.equal(issued.length,2);
 s=move(s,'hand:right','large-4');assert.equal(handLayout(actor(s)).right,null);
 s=move(s,'outfit','hand:right');assert.equal(actor(s).outfit,null);assert.equal(hand(actor(s)).instanceId,'personal-poncho');
 const spare=Object.entries(actor(s).inventory).find(([,r])=>r.kind==='outfit'&&!r.instanceId)[0];
 s=move(s,pocket(actor(s),`inventory:${spare}`),'outfit');assert.equal(actor(s).outfit.condition,100);
 s=move(s,'hand:right','outfit');assert.equal(actor(s).outfit.instanceId,'personal-poncho');assert.equal(hand(actor(s)).condition,100);
 s=save(s).campaign;const arranged=actor(s),entered=enter(s);s=entered.s;let b=entered.b,unit=b.units.find(u=>u.id==='110');
 assert.deepEqual(unit.outfit,arranged.outfit);assert.deepEqual(hand(unit),hand(arranged));assert.deepEqual(unit.pocketOrder,arranged.pocketOrder);assert.equal(s.resources.ponchos,4);save(s,b);
 const ap=unit.ap,elapsed=b.elapsedSeconds;
 b=actBattle(b,{type:'moveEquipment',unitId:'110',...placement(unit,'outfit','hand:right')});assert.equal(b.lastError,null,b.lastError);unit=b.units.find(u=>u.id==='110');
 assert.equal(unit.ap,ap);assert.equal(b.elapsedSeconds,elapsed+1);assert.equal(unit.outfit.condition,100);assert.equal(hand(unit).instanceId,'personal-poncho');assert.equal(hand(unit).condition,47);assert.deepEqual(garments(unit),issued);
 ({s,b}=sync(s,b));const resumed=save(s,b);s=leave(resumed.campaign,resumed.battle);assert.equal(s.resources.ponchos,4);assert.deepEqual(garments(actor(s)),issued);
 s=move(s,'outfit','hand:right');assert.equal(actor(s).outfit.instanceId,'personal-poncho');
 const finalLayout=actor(s).pocketOrder,reentry=enter(save(s).campaign),returned=reentry.b.units.find(u=>u.id==='110');
 assert.equal(returned.outfit.instanceId,'personal-poncho');assert.equal(returned.outfit.condition,47);assert.equal(hand(returned).condition,100);assert.deepEqual(returned.pocketOrder,finalLayout);assert.deepEqual(garments(returned),issued);assert.equal(reentry.s.resources.ponchos,4);save(reentry.s,reentry.b);
});

test('campaign clothing placement rejects invalid exchanges and delayed fingerprints without changing resources or saves',()=>{
 let s=fresh();s=step(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'issueOutfit'});
 const coat=pocket(actor(s),'inventory:outfit'),gesture=action(s,coat,'outfit');
 const reject=(state,a)=>{const before=structuredClone(state),n=dispatchCampaign(state,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},{...before,lastError:null});assert.deepEqual(state,before);save({...n,lastError:null},n.pendingBattle?enterSector(n.pendingBattle,n.sectorStates.retiro):null);};
 for(const [from,to]of [['outfit','small-8'],['outfit','hand:right'],['outfit','hand:left'],['hand:right','outfit']])reject(s,action(s,from,to));
 for(const patch of [{expectedSource:undefined},{expectedDestination:'stale'},{destinationId:'missing'},{count:2}])reject(s,{...gesture,...patch});
 for(const mutate of [r=>r.outfit.condition=41,r=>r.inventory.outfit.condition=28,r=>r.inventory.outfit.instanceId='changed',r=>r.asleep=true]){const changed=structuredClone(s);mutate(changed.operativeState[110]);reject(changed,gesture);}
 const pending=step(s,{type:'visitSector'});reject(pending,gesture);
});
