import {runBattleJob} from '../../game/battle-job.js';
self.onmessage=(event:MessageEvent)=>{
 const {id,job}=event.data;
 try{self.postMessage({id,battle:runBattleJob(job)});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
