import {DEFAULT_MILITIA_PROGRESSION} from './militia-progression-rules.js';
// Patusco pp. 59–60: veteran militia earn their rank in combat.
// Points and default authored thresholds/gains are Granaderos tuning.
export const MILITIA_COMBAT_THRESHOLDS=Object.freeze([0,DEFAULT_MILITIA_PROGRESSION.regularThreshold,DEFAULT_MILITIA_PROGRESSION.veteranThreshold]);
// Up to 98 earlier wound receipts plus 199 opponents in a supported 200-unit
// encounter still leave room to earn the next rank on a later return.
const MAX_MILITIA_OPPONENTS=300;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validMilitiaExperience(unit){
 if(!object(unit))return false;
 const points=unit.militiaExperience,credit=unit.militiaCombatCredit;
 if(points===undefined&&credit===undefined)return true;
 if(unit.militia!==true||!Number.isInteger(unit.militiaRank)||unit.militiaRank<0||unit.militiaRank>2||!Number.isInteger(points)||points<0||points>MAX_MILITIA_OPPONENTS*3||!Array.isArray(credit)||credit.length>MAX_MILITIA_OPPONENTS)return false;
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
 if(!receipt){if(source.militiaCombatCredit.length>=MAX_MILITIA_OPPONENTS)return;receipt={id:target.militiaCreditId,points:0};source.militiaCombatCredit.push(receipt);}
 const added=Math.max(0,points-receipt.points);receipt.points+=added;source.militiaExperience+=added;
}
export function earnedMilitiaRank(issued,actual,rules=DEFAULT_MILITIA_PROGRESSION){
 if(!validMilitiaExperience(actual)||!validMilitiaExperience(issued)||(actual.militiaExperience??0)<(issued.militiaExperience??0))throw Error('La experiencia de la milicia no es válida.');
 const old=issued.militiaCombatCredit??[],credit=actual.militiaCombatCredit??[];
 if(old.some(entry=>(credit.find(v=>v.id===entry.id)?.points??0)<entry.points))throw Error('El parte pierde experiencia de la milicia.');
 const rank=issued.militiaRank;
 return actual.hp>0&&rank<2&&(actual.militiaExperience??0)>(issued.militiaExperience??0)&&(actual.militiaExperience??0)>=(rank===0?rules.regularThreshold:rules.veteranThreshold)?rank+1:rank;
}
export function promoteMilitia(record,rank,rules=DEFAULT_MILITIA_PROGRESSION){
 if(rank===record.militiaRank)return record;
 record.militiaRank=rank;
 record.marksmanship=Math.min(100,(record.marksmanship??50)+rules.marksmanshipGain);
 record.leadership=Math.min(100,(record.leadership??30)+rules.leadershipGain);
 record.experienceLevel=Math.min(10,(record.experienceLevel??4)+rules.levelGain);
 if(rank===2&&!record.name.startsWith('Veterano '))record.name=`Veterano ${record.name}`.slice(0,100);
 return record;
}
