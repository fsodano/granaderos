import assert from 'node:assert/strict';

// Inputs are the caller's current admitted candidates, in its existing rank
// order. Planning selects distinct roles; it neither hires nor changes bodies.
export function mountainCommandRolePlan({commanders,physicians,count}){
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<=4);
 for(const rows of [commanders,physicians])assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,'Each current candidate identity must be distinct.');
 for(const commander of commanders){
  const doctors=physicians.filter(op=>op.id!==commander.id).slice(0,count);
  if(doctors.length===count)return {commander,doctors};
 }
 return null;
}
