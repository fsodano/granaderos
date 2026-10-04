export function receiveCorrespondence(state,{id,sender,subject,text}){
 state.correspondence??=[];
 if(state.correspondence.some(message=>message.id===id))return;
 state.correspondence.unshift({id,sender,subject,text,hour:state.hour,received:true});
 state.correspondence=state.correspondence.slice(0,80);
}
export function validateCorrespondence(state){
 if(state.correspondence===undefined)return;
 const rows=state.correspondence;
 if(!Array.isArray(rows)||rows.length>80||new Set(rows.map(m=>m?.id)).size!==rows.length||rows.some(m=>!m||m.received!==true||!Number.isSafeInteger(m.hour)||m.hour<0||m.hour>state.hour||!['id','sender','subject','text'].every(key=>typeof m[key]==='string'&&m[key].length>0&&m[key].length<2000)))throw Error('La correspondencia recibida es inválida.');
}
