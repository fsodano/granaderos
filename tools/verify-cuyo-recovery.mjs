import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';

const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--input'||args[2]!=='--output')throw Error('Usage: node tools/verify-cuyo-recovery.mjs --input yatasto.save.json --output directory');
const input=resolve(args[1]),directory=resolve(args[3]);mkdirSync(directory,{recursive:true});
let c=decodeSave(readFileSync(input,'utf8')).campaign;const events=[],start=structuredClone(c);
assert.equal(c.hour,215);assert.equal(c.phase,3);assert.equal(c.missions.yatasto.completed,true);assert.equal(c.pendingBattle,null);
const order=action=>{const n=dispatchCampaign(c,action);assert.equal(n.lastError,null,JSON.stringify(action)+': '+n.lastError);c=n;events.push({action,hour:c.hour,second:c.secondOfHour});};
const renew=buffer=>{for(const id of c.recruited){const r=c.operativeState[id],t=c.contracts[id];if(r.alive&&t?.expiresAt!=null&&t.expiresAt-c.hour<=buffer)order({type:'renewContract',id,term:'day',expectedExpiresAt:t.expiresAt});}};
const gather=(id,sector,limit)=>{let count=0;for(const r of sectorInventoryModel(c,sector,rosterFor(c),id).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits')){const n=Math.min(r.count,limit-count);if(!n)break;order({type:'sectorInventory',sector,operativeId:id,direction:'take',sourceKey:r.key,expected:r.expected,count:n});count+=n;}return count;};
order({type:'selectSquad',id:'squad-4'});order({type:'squad',ids:[105,109,115,142]});
assert.equal(gather(115,'salta',1),1);order({type:'assignCare',operativeId:115,assignment:'doctor'});order({type:'assignCare',operativeId:105,assignment:'patient'});order({type:'wait',hours:1});assert.equal(c.operativeState[105].hp,17);
assert.equal(gather(115,'salta',100),6);
renew(25);
for(const operativeId of [105,109,115,142])order({type:'assignCare',operativeId,assignment:'active'});
order({type:'travel',sector:'cordoba',queue:true});
order({type:'createSquad',sector:'san_nicolas',name:'Reserva médica',ids:[116]});order({type:'assignCare',operativeId:116,assignment:'active'});order({type:'travel',sector:'cordoba',queue:true});
order({type:'selectSquad',id:'squad-3'});order({type:'travel',sector:'cordoba'});
assert.equal(c.hour,228);assert.equal(c.location,'cordoba');assert.equal(c.operativeState[116].location,'cordoba');
for(const quantity of [20])order({type:'purchaseMedicalSupplies',operativeId:122,quantity});
const beforePurchase=c.resources.treasury;order({type:'purchaseMedicalSupplies',operativeId:116,quantity:2});assert.equal(beforePurchase-c.resources.treasury,60);order({type:'assignCare',operativeId:122,assignment:'rest'});
for(let n=0;c.squads.find(s=>s.id==='squad-4').location!=='cordoba'&&n<50;n++){renew(2);order({type:'wait',hours:1});}
assert.equal(c.squads.find(s=>s.id==='squad-4').location,'cordoba');
for(const operativeId of [105,109,142])order({type:'assignCare',operativeId,assignment:'patient'});
for(const id of [115,116]){const count=c.operativeState[id].medkits;order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'drop',item:'medkits',count});}
assert.equal(gather(122,'cordoba',100),8);order({type:'assignCare',operativeId:116,assignment:'rest'});order({type:'assignCare',operativeId:115,assignment:'rest'});order({type:'assignCare',operativeId:122,assignment:'doctor'});
for(let n=0;[105,109,142].some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp)&&n<100;n++){
 renew(2);assert.equal(c.pendingEncounter,null);
 order({type:'wait',hours:1});
}
for(const id of [105,109,142])assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
for(const operativeId of [105,109,142,122,115])order({type:'assignCare',operativeId,assignment:'rest'});
const until=c.hour+6;for(let n=0;c.hour<until&&n<20;n++){renew(2);order({type:'wait',hours:1});}
assert.equal(c.hour,274);assert.equal(c.resources.treasury,1557);assert.equal(c.pendingEncounter,null);
for(const [id,r] of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
for(const id of [105,109,115,116,122,142]){assert.equal(c.operativeState[id].location,'cordoba');assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.recruited.includes(id));}
assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
const finalSave=join(directory,'cuyo-recovered.save.json');writeFileSync(finalSave,encodeSave(c));
assert.deepEqual(decodeSave(readFileSync(finalSave,'utf8')).campaign,c);
const summary={scope:'Paid recovery and real concurrent return to Córdoba after Yatasto. No Cuyo battle or full ending is claimed.',input,finalSave,events,hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,recoveredDressings:7,boughtDressings:22,medicalCost:660,personnel:rosterFor(c).filter(o=>c.recruited.includes(o.id)&&c.operativeState[o.id].alive).map(o=>({id:o.id,hp:c.operativeState[o.id].hp,energy:c.operativeState[o.id].energy,medkits:c.operativeState[o.id].medkits,location:c.operativeState[o.id].location}))};
writeFileSync(join(directory,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({event:'verified',directory,finalSave,hour:c.hour,treasury:c.resources.treasury}));
