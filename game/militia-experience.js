// Patusco pp. 59–60: veteran militia earn their rank in combat.
// Points, thresholds and attribute gains below are Granaderos tuning.
export const MILITIA_COMBAT_THRESHOLDS=[0,2,5];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validMilitiaExperience(unit){
 if(!object(unit))return false;
 const points=unit.militiaExperience,credit=unit.militiaCombatCredit;
 if(points===undefined&&credit===undefined)return true;
 if(unit.militia!==true||!Number.isInteger(unit.militiaRank)||unit.militiaRank<0||unit.militiaRank>2||!Number.isInteger(points)||points<0||points>300||!Array.isArray(credit)||credit.length>100)return false;
 const ids=new Set();let total=0;
 for(const entry of credit){if(!object(entry)||Object.keys(entry).length!==2||typeof entry.id!=='string'||!entry.id.length||entry.id.length>2400||ids.has(entry.id)||![1,3].includes(entry.points))return false;ids.add(entry.id);total+=entry.points;}
 return total===points;
}
export function recordMilitiaHit(state,source,target,eligible,damage){
 if(!source?.militia||![0,1].includes(source.militiaRank)||source.hp<=0||source.side===target.side||!eligible||damage<=0)return;
 // Opponent identity survives an unfinished-sector revisit. A new occupation
 // receives a new battle identity even when its local enemy IDs are reused.
 target.militiaCreditId??=`${state.battleId??state.sectorId}:${state.startSeconds??0}:${target.id}`;
 source.militiaCombatCredit??=[];source.militiaExperience??=0;
 let receipt=source.militiaCombatCredit.find(entry=>entry.id===target.militiaCreditId);
 const points=target.hp<=0?3:1;
 if(!receipt){if(source.militiaCombatCredit.length>=100)return;receipt={id:target.militiaCreditId,points:0};source.militiaCombatCredit.push(receipt);}
 const added=Math.max(0,points-receipt.points);receipt.points+=added;source.militiaExperience+=added;
}
export function earnedMilitiaRank(issued,actual){
 if(!validMilitiaExperience(actual)||!validMilitiaExperience(issued)||(actual.militiaExperience??0)<(issued.militiaExperience??0))throw Error('La experiencia de la milicia no es válida.');
 const old=issued.militiaCombatCredit??[],credit=actual.militiaCombatCredit??[];
 if(old.some(entry=>(credit.find(v=>v.id===entry.id)?.points??0)<entry.points))throw Error('El parte pierde experiencia de la milicia.');
 const rank=issued.militiaRank;
 return actual.hp>0&&rank<2&&(actual.militiaExperience??0)>(issued.militiaExperience??0)&&(actual.militiaExperience??0)>=MILITIA_COMBAT_THRESHOLDS[rank+1]?rank+1:rank;
}
export function promoteMilitia(record,rank){
 if(rank===record.militiaRank)return record;
 record.militiaRank=rank;
 record.marksmanship=Math.min(100,(record.marksmanship??50)+8);
 record.leadership=Math.min(100,(record.leadership??30)+5);
 record.experienceLevel=Math.min(10,(record.experienceLevel??4)+1);
 if(rank===2&&!record.name.startsWith('Veterano '))record.name=`Veterano ${record.name}`.slice(0,100);
 return record;
}
