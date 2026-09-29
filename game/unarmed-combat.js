// JA2 separates unarmed injury from loss of breath (Patusco pp. 27–29, 64–66).
// These values adapt that choice to Granaderos' 100-point breath/AP scale.
export const FISTS=Object.freeze({id:0,name:'Puños',ap:12,damage:6,reach:1.5});
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function unarmedChance(attacker,target,{aware=true}={}){
 if(target.unconscious)return 95;
 const attack=(attacker.dexterity??50)*.45+(attacker.agility??50)*.25+(attacker.strength??50)*.3;
 const defense=(target.agility??50)*.6+(target.dexterity??50)*.4;
 return Math.round(clamp(60+(attack-defense)*.6+((attacker.experienceLevel??4)-(target.experienceLevel??4))*3+(aware?0:20)-(100-(attacker.energy??100))*.2+(100-(target.energy??100))*.1,5,95));
}
export function unarmedImpact(attacker){
 const strength=clamp(attacker.strength??50,0,100),energy=clamp(attacker.energy??100,0,100);
 return {damage:Math.max(1,Math.round((2+strength*.06)*(.5+energy/200))),breathLoss:Math.round((12+strength*.28)*(.5+energy/200))};
}

