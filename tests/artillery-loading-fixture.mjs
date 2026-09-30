import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,artilleryReloadPreview} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {issuedBattery} from './stationed-artillery-fixture.mjs';
import {saved,sync} from './local-contract-fixture.mjs';

// Paid deployment, issued enemies, actual turns and partial crew work.
export function partiallyLoadedBattery(){
 let s=issuedBattery();const r=s.pendingBattle,issued=enterSector(r),width=40,height=12;
 const enemies=issued.units.filter(u=>u.side==='enemy').map((u,i)=>({...u,x:36,y:1+i,patrolOrigin:{x:36,y:1+i},overwatch:false,patrol:false}));
 let b=createBattle(r.squad.map((u,i)=>({...u,x:1+i,y:2})),{...r,hour:s.hour,width,height,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:i%width===20?'wall':'grass',blocked:i%width===20,blocksSight:i%width===20,cover:0})),enemies,npcs:r.npcs.map((n,i)=>({...n,x:10+i%4,y:8+Math.floor(i/4)})),artillery:r.artillery.map(g=>({...g,x:2,y:3}))});const id=b.units[0].id,gun=b.artillery[0].id;
 // Declared compact combat boundary, using the actual purchased manifest and
 // hired squad. AP and ammunition are spent through ordinary cannon orders.
 for(const type of ['artillery','artilleryReload']){b=actBattle(b,{type,unitId:id,artilleryId:gun,x:10,y:3});assert.equal(b.lastError,null);}
 b=endTurn(b);b=actBattle(b,{type:'artillery',unitId:id,artilleryId:gun,x:10,y:3});assert.equal(b.lastError,null);assert.equal(b.mode,'combat');
 for(let i=0;i<100&&b.units[0].ap>=artilleryReloadPreview(b,b.units[0],b.artillery[0]).rate;i++){b=actBattle(b,{type:'look',unitId:id,x:b.units[0].facing===2?0:10,y:2});assert.equal(b.lastError,null);}
 b=actBattle(b,{type:'artilleryReload',unitId:id,artilleryId:gun});assert.equal(b.lastError,null);
 assert.equal(b.artillery[0].loaded,false);assert.equal(b.artillery[0].ammo,5);assert.ok(b.artillery[0].reloadProgress>0);const progress=b.artillery[0].reloadProgress;
 return saved(sync({campaign:s,battle:b}));
}
