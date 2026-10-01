// Message ownership prevents late results from fulfilling a newer order.
export function createBattleExecutor(worker){
 let sequence=0,closed=false;const pending=new Map();
 const rejectAll=error=>{for(const request of pending.values())request.reject(error);pending.clear();};
 worker.onmessage=({data})=>{const request=pending.get(data.id);if(!request)return;pending.delete(data.id);if(data.error)request.reject(Error(data.error));else request.resolve(data.battle);};
 const fail=()=>{if(closed)return;closed=true;rejectAll(Error('Battle worker failed'));worker.terminate();};
 worker.onerror=fail;
 // A message that cannot be decoded never reaches onmessage. Reject waiting
 // orders so the shared UI executor can use its normal synchronous fallback.
 worker.onmessageerror=fail;
 return {
  run(job){if(closed)return Promise.reject(Error('Battle worker closed'));const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});try{worker.postMessage({id,job});}catch(error){pending.delete(id);reject(error);}});},
  close(){if(closed)return;closed=true;rejectAll(Error('Battle worker closed'));worker.terminate();},
 };
}
