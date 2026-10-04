import assert from 'node:assert/strict';
// Advance actual presentation callbacks in chronological order. Tests still
// wait for the visible frames and final commit, without wall-clock delays.
export function battleTimers(act){
 const oldTimeout=globalThis.setTimeout,oldClear=globalThis.clearTimeout,pending=new Map();let clock=0,serial=0;
 globalThis.setTimeout=(fn,delay=0,...args)=>{const id=++serial;pending.set(id,{at:clock+Math.max(0,Number(delay)||0),fn:()=>fn(...args)});return id;};
 globalThis.clearTimeout=id=>pending.delete(id);
 async function until(done,observe=()=>{}){
  for(let i=0;!done();i++){
   observe();
   assert.ok(i<2000,'presentation must finish in a bounded number of callbacks');
   const next=[...pending.entries()].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
   assert.ok(next,'a presentation callback must remain until the final state is committed');
   pending.delete(next[0]);clock=next[1].at;await act(async()=>next[1].fn());
  }
 }
 return {until,wait:ms=>new Promise(resolve=>oldTimeout(resolve,ms)),settle:document=>until(()=>!document.querySelector('[data-enemy-frame]')),restore(){globalThis.setTimeout=oldTimeout;globalThis.clearTimeout=oldClear;pending.clear();}};
}
