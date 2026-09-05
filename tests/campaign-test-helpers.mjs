import {dispatchCampaign} from '../game/campaign.js';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {transportPath} from '../game/logistics.js';
// Integration tests explicitly march through controlled sectors before a frontier attack.
export function marchToFront(state,action){
 if(action.type!=='attack')return state;
 const target=action.sector??'san_lorenzo';const destinations=target==='san_lorenzo'?['san_nicolas']:CAMPAIGN_SECTORS.find(d=>d.id===target)?.neighbors??[];
 if(state.location===target||destinations.includes(state.location))return state;
 const destination=destinations.find(id=>state.sectors[id].owner==='patriot'&&transportPath(state,state.location,id));
 if(!destination)return state;
 const next=dispatchCampaign(state,{type:'travel',sector:destination});
 if(next.lastError)throw Error(`Integration-test march failed: ${next.lastError}`);
 return next;
}
