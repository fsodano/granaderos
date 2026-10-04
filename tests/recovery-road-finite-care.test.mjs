import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {recoverRecapturedRoad} from './recovery-road-care.mjs';
import {decodeSave,encodeSave} from '../game/save.js';

test('recaptured-road care uses the real closed-shop cache, finite dressings and ordinary doctor hours',()=>{
 const start=initialCampaign();
 // This isolated care state has no carried dressings. Its only source is the
 // normal finite Retiro cache, which must be found through actual entry.
 for(const id of start.recruited)start.operativeState[id].medkits=0;
 start.operativeState[3].hp-=12;start.operativeState[3].bandaged=12;
 const before=structuredClone(start),cash=start.resources.treasury;
 const result=recoverRecapturedRoad(start),s=result.campaign;
 assert.deepEqual(start,before);assert.equal(s.operativeState[3].hp,s.operativeState[3].maxHp);assert.equal(s.operativeState[3].bleeding,0);
 assert.ok(s.hour>start.hour,'actual hourly doctor work heals the declared wound');assert.equal(s.resources.treasury,cash);
 const chest=s.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache');assert.equal(chest.open,true);assert.equal(chest.knownToPlayer,true);
 const found=result.events.filter(event=>event.event==='finiteCareCollection').reduce((sum,event)=>sum+event.quantity,0),carried=s.recruited.reduce((sum,id)=>sum+s.operativeState[id].medkits,0),remaining=chest.contents.filter(item=>item.item==='medkits').reduce((sum,item)=>sum+item.count,0);
 assert.ok(found>0);assert.ok(found>carried,'hourly treatment consumes actual collected dressings');assert.equal(remaining+found,12,'the normal cache loses exactly the collected stock');
 assert.ok(result.events.every(event=>!event.action?.type.startsWith('purchase')));assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});
