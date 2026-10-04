export function travelTime(hours:number){
 const minutes=Math.ceil(Math.max(0,hours)*60),whole=Math.floor(minutes/60),part=minutes%60;
 return whole?`${whole} h${part?` ${part} min`:''}`:`${part} min`;
}
