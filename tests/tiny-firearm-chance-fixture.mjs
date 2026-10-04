import {createBattle} from '../game/tactical.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';
import {defaultContentPackage} from '../game/content-package.js';

// Explicit authored subsystem field. Six real head intersections leave ten
// physical force and less than one percent conditional reach to the target.
export function tinyFirearmChanceField({paired=false}={}){
 const definition=template=>compileWeaponDefinition({...defaultContentPackage().weapons.find(w=>w.template===template),id:`tiny-passage-${template}`,name:'Arma de prueba',damage:100,range:20});
 const weapon=paired?1806:1801;
 const state=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon,contentWeapon:definition(weapon),loaded:1,marksmanship:100,...(paired?{offHand:{weapon:1805,count:1,loaded:1,condition:100,contentWeapon:definition(1805)},leftHandItem:'offhand'}:{})}],{width:22,height:8,tiles:Array.from({length:176},(_,i)=>({x:i%22,y:Math.floor(i/22),type:'grass',blocked:false,blocksSight:false,cover:0})),enemies:[{id:'e',name:'Objetivo',x:15,y:3,patrol:false,overwatch:false}]});
 for(let i=0;i<6;i++)state.units.push({...structuredClone(state.units[0]),id:`friend-${i}`,name:`Aliado ${i+1}`,x:3+i*2});
 return {state,player:state.units[0],target:state.units[1]};
}
