// Keep at most one serialization in flight and one latest unsaved snapshot.
// A late worker reply must never overwrite a newer campaign or imported save.
export function createCampaignAutosave({worker,encode,write,onSaved=()=>{},onError=()=>{}}){
 let latest=null,inFlight=null,sequence=0,saved=0,closed=false;
 const persist=(snapshot,text)=>{
  if(closed||snapshot.id!==latest?.id||snapshot.id===saved)return;
  try{write(text);saved=snapshot.id;onSaved();}catch(error){onError(error);}
 };
 const fallback=snapshot=>{try{persist(snapshot,encode(snapshot.campaign,snapshot.battle));}catch(error){onError(error);}};
 const pump=()=>{
  if(closed||inFlight||!latest||latest.id===saved)return;
  const snapshot=latest;
  if(!worker){fallback(snapshot);return;}
  inFlight=snapshot;
  try{worker.postMessage(snapshot);}catch{fail();}
 };
 const fail=()=>{
  if(closed)return;
  worker?.terminate();worker=null;inFlight=null;
  if(latest&&latest.id!==saved)fallback(latest);
 };
 if(worker){
  worker.onmessage=({data})=>{
   if(closed||data.id!==inFlight?.id)return;
   const snapshot=inFlight;inFlight=null;
   if(data.error){if(snapshot.id===latest?.id)onError(Error(data.error));else pump();return;}
   persist(snapshot,data.text);if(snapshot.id!==latest?.id)pump();
  };
  worker.onerror=fail;worker.onmessageerror=fail;
 }
 return {
  submit(campaign,battle){if(closed||!campaign)return;latest={id:++sequence,campaign,battle};pump();},
  // Navigation can end a worker before its reply. Save the latest complete pair.
  flush(){if(!closed&&latest&&latest.id!==saved)fallback(latest);},
  close(){if(closed)return;closed=true;worker?.terminate();worker=null;inFlight=null;},
 };
}
