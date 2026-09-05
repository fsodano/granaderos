// Explicit pre-redesign saved campaign for subsystem regression tests.
// New-player acceptance tests must use initialCampaign directly instead.
import {initialCampaign as freshCampaign} from '../game/campaign.js';
export function initialCampaign(seed){const s=freshCampaign(seed);s.recruited=[3,4,10];s.squad=[3,4,10];s.squads[0].members=[3,4,10];s.contracts=Object.fromEntries(s.recruited.map(id=>[id,{kind:'legacy',term:'month',started:0,expiresAt:null,paid:0}]));return s;}
