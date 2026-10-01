// Keep at most one active calculation and one replacement. Pointer events must
// not create an unbounded worker queue or publish a route for an old snapshot.
export function createLatestPreview(run,receive){
 let revision=0,pending=null,active=false,closed=false;
 async function drain(){
  active=true;
  try{while(pending&&!closed){
   const current=pending;pending=null;
   let result,error;
   try{result=await run(current.job);}catch(cause){error=cause;}
   if(!closed&&revision===current.revision)receive(current.job,result,error);
  }}finally{active=false;}
 }
 return {
  request(job){if(closed)return;revision++;pending=job?{job,revision}:null;if(pending&&!active)void drain();},
  close(){closed=true;revision++;pending=null;},
 };
}
