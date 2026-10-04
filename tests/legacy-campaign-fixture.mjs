// Explicit pre-redesign saved campaign for subsystem regression tests.
// New-player acceptance tests must use initialCampaign directly instead.
import {addAmmunition} from '../game/ammunition-types.js';
import {syncCarriedAmmunition} from '../game/physical-ammunition.js';
import {rosterFor} from '../game/campaign.js';
import {weaponAmmoType} from '../game/ammunition-types.js';
import {initialCampaign as freshCampaign} from '../game/campaign.js';
export function initialCampaign(seed){const s=freshCampaign(seed);for(const id of ['buenos_aires','ensenada'])Object.assign(s.sectors[id],{owner:'patriot',loyalty:65});s.recruited=[3,4,10];s.squad=[3,4,10];s.squads[0].members=[3,4,10];s.contracts=Object.fromEntries(s.recruited.map(id=>[id,{kind:'legacy',term:'month',started:0,expiresAt:null,paid:0}]));// Declared preexisting service equipment isolates subsystem behavior.
for(const id of s.recruited){const record=s.operativeState[id],op=rosterFor(s).find(o=>o.id===id),type=weaponAmmoType(op);record.startingCartridgesIssued=true;if(type){record.carriedLoaded=1;addAmmunition(record,type,9);syncCarriedAmmunition(record,op.weapon);}}return s;}
