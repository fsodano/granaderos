import {withStoredGear} from './commerce-gear-fixture.mjs';
// Established northern front and scripted capture fixture. Paid rescue hiring
// and the subsequent tactical approach are real; this is not a fresh campaign.
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {enterSector} from '../game/world.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function captured({custodySupplies=2}={}){
 // The declared established relief fund pays six weekly hires; two reserve guns are already owned.
 let s=initialCampaign();s.resources.treasury=8000;const funds=s.resources.treasury;s=withStoredGear(withStoredGear(s,'swivel'),'bronze4');assert.equal(s.resources.treasury,funds);s=order(s,{type:'configureArtillery',types:[]});for(const id of [112,123,115,110,114,113])s=order(s,{type:'recruitCivic',id,term:'week'});s.operativeState[112].location=s.location;s.operativeState[112].medkits=4;s=order(s,{type:'squad',ids:[3,4,10]});s.operativeState[112].location='buenos_aires';s.location='humahuaca';s.squads[0].location=s.location;s.sectors.humahuaca.owner='patriot';
 launchEnemyGroup(s,'north','humahuaca',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});
 let b=enterSector(s.pendingBattle);const u=b.units.find(u=>Number(u.id)===3);u.hp=11;u.bleeding=2;u.bandaged=20;u.unconscious=true;u.stance='prone';u.movementMode='prone';
 for(const u of b.units.filter(u=>u.side==='player')){u.surrendered=true;u.ap=0;u.medkits=custodySupplies;refreshMilitaryCondition(u);}b.status='defeat';
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'defeat',sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 for(const id of ['cordoba','tucuman','salta','jujuy'])s.sectors[id].owner='patriot';s.location='jujuy';s.squad=[112,123,115,110,114,113];s.squads[0].members=[...s.squad];s.squads[0].location=s.location;
 // The already-owned reserve gun remains outside the captured patrol. Issue it
 // to the relief force through the normal deployment selection.
 s=order(s,{type:'configureArtillery',types:['swivel','bronze4']});return order(s,{type:'attack',sector:'humahuaca'});
}
function start(options){const next=prepareCampaignBattle(captured(options));assert.equal(next.error,null,next.error);return next;}
function sync(campaign,battle){const next=syncBattleTime(campaign,battle);assert.equal(next.error,null,next.error);return next;}

export {start,sync,order};
