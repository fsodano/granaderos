import assert from 'node:assert/strict';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
let home;
export function homeDepotGun(content){
 if(!content&&home)return structuredClone(home);
 let s=fieldGun(content);const gun=s.sectorStates.san_nicolas.artillery[0];s=order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'retiro',mode:'carts'});const due=s.artilleryTransfers[0].dueAt;s=order(s,{type:'travel',sector:'retiro'});if(s.hour<due)s=order(s,{type:'wait',hours:due-s.hour});assert.equal(s.artilleryDepots.retiro[0].id,gun.id);s=saved({campaign:s}).campaign;if(!content)home=s;return structuredClone(s);
}
