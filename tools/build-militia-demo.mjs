import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {initialCampaign} from '../tests/legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {createBattle,endTurn} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';

// Controlled demonstration, not a record of a new-player campaign. The explicit
// legacy squad fixture supplies three hired soldiers and a veteran garrison.
const output=path.resolve(process.argv[2]??'artifacts/militia-defense-demo.json');
let campaign=initialCampaign(45);
campaign.hour=12;campaign.sectors.retiro.militia=[0,0,3];
launchEnemyGroup(campaign,'coast','retiro',{immediate:true});
for(const action of [{type:'wait',hours:1},{type:'respondToEncounter',groupId:campaign.enemyGroups[0].id,choice:'tactical'}]){
 campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null);
}
const request=campaign.pendingBattle;
const battle=createBattle([
 ...request.squad.map((unit,i)=>({...unit,x:1,y:6+i})),
 ...request.garrison.map((unit,i)=>({...unit,x:1,y:1+i*2})),
],{...request,width:16,height:10,
 tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',cover:0,blocked:false})),
 enemies:request.enemies.map((unit,i)=>({...unit,x:7,y:1+i*2,overwatch:false})),
 props:[],npcs:[],seed:45});
const save=encodeSave(campaign,battle),loaded=decodeSave(save);
assert.deepEqual(loaded.battle,battle);
const after=endTurn(loaded.battle);
assert.equal(after.status,'victory');assert.equal(after.elapsedSeconds,6);
assert.deepEqual(after.units.filter(unit=>unit.militia).map(unit=>unit.loaded+unit.ammo),[4,4,4]);
for(const unit of battle.units.filter(unit=>unit.side==='player'&&!unit.militia)){
 const next=after.units.find(other=>other.id===unit.id);
 for(const key of ['x','y','hp','loaded','ammo'])assert.equal(next[key],unit[key]);
}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,save);
console.log(`Saved ${output}. Import into the QA campaign, then select Fin del turno. Expected: militia win in 6 seconds, each retaining 4 rounds.`);
