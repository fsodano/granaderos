import {createBattle} from '../game/tactical.js';
export const flatTiles=()=>Array.from({length:320},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',cover:0,blocked:false}));
export function crewField(type='field8',{wounded=false,exploration=false}={}){
 const tiles=flatTiles();if(!exploration)for(const t of tiles)if(Math.abs(t.x-12)<=1&&Math.abs(t.y-6)<=1&&(t.x!==12||t.y!==6)){t.blocked=true;t.blocksSight=false;}
 return createBattle([{id:20,x:1,y:2},{id:21,x:2,y:2},{id:22,x:1,y:3}].map(u=>({...u,...(wounded?{hp:20,maxHp:100,bandaged:80,energy:30,fatigue:90,medical:0}:{})})),{width:40,height:8,tiles,seed:45,exploration,enemies:exploration?[]:[{id:'e',x:12,y:6,weapon:1813,ammo:0,loaded:0,patrol:false}],artillery:[{id:'gun',type,side:'player',x:2,y:3,loaded:false,ammo:3}]});
}
