import {encodeSave} from '../../game/save.js';
self.onmessage=(event:MessageEvent)=>{
 const {id,campaign,battle}=event.data;
 try{self.postMessage({id,text:encodeSave(campaign,battle)});}
 catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
