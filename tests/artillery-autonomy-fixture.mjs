import {createBattle,ARTILLERY} from '../game/tactical.js';
// Declared flat tactical boundaries. Campaign purchase/capture is covered by the
// unchanged stationed-artillery tests; these cases do not assign an outcome.
export function artilleryField({type='field8',side='enemy',loaded=true,ammo=2,hidden=false,exploration=false,crew={}}={}){
 const operators=[{id:'crew-1',x:2,y:2},{id:'crew-2',x:3,y:2},{id:'crew-3',x:2,y:3}].slice(0,ARTILLERY[type].crew).map(u=>({...u,facing:2,weapon:1813,ammo:0,patrol:false,morale:100,...crew}));
 const target={id:'target',x:hidden?32:11,y:3,facing:6,weapon:1813,ammo:0,hp:300,maxHp:300,morale:100,patrol:false};
 const tiles=Array.from({length:480},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0}));
 // A transparent movement barrier keeps the observer alive at a fixed range.
 for(const t of tiles)if(t.x===8){t.type='window';t.blocked=true;t.blocksSight=false;}
 return createBattle(side==='enemy'?[target]:[...operators.map(u=>({...u,militia:true})),{id:'officer',x:1,y:10,weapon:1813,ammo:0}],{width:40,height:12,seed:45,exploration,tiles,enemies:side==='enemy'?operators:[target],artillery:[{id:'gun',type,side,x:3,y:3,loaded,ammo}]});
}
