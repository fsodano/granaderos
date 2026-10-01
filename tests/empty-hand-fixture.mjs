import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {order,visit,tactical,saved} from './local-contract-fixture.mjs';
export function disarmedArrival({secondary=true}={}){
 const d=defaultContentPackage();for(const id of [110,111])d.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 const patient=d.characters.find(c=>c.id==='person-111');patient.startingCondition={hp:14,energy:100,fatigue:0,bleeding:0,bandaged:0};patient.blade='blade-1809';const blade=d.weapons.find(w=>w.id==='blade-1809');blade.name='Sable conservado';blade.art='/art/weapon-1810.png';
 let s=initialCampaign(45,d);for(const id of [110,111])s=order(s,{type:'recruitCivic',id,term:'week'});let p=visit(s),doctor=p.battle.units.find(u=>u.id==='110'),wounded=p.battle.units.find(u=>u.id==='111');
 // Declared adjacent positions isolate actual recovery and paid first aid.
 wounded.x=doctor.x+1;wounded.y=doctor.y;assert.equal(wounded.unconscious,true);
 p=tactical(p,{unitId:'110',type:'loot',targetId:'111',item:'weapon'});if(!secondary)p=tactical(p,{unitId:'110',type:'loot',targetId:'111',item:'blade'});
 p=tactical(p,{unitId:'110',type:'weapon',slot:'medical'});p=tactical(p,{unitId:'110',type:'heal',targetId:'111'});assert.equal(p.battle.units.find(u=>u.id==='111').unconscious,false);p=tactical(p,{unitId:'110',type:'weapon',slot:'primary'});return saved(p);
}
