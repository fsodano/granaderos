export function returnAmmunition(request,reports,snapshot){
 let looted=0;
 if(snapshot){
  for(const source of [...(request.garrison??[]),...(request.garrisonLootSources??[]),...(request.missionAllies??[])]){const current=snapshot.units.find(u=>(u.militia||u.missionAlly)&&String(u.id)===String(source.id));if(current&&(current.hp<=0||current.unconscious||current.routed))looted+=Math.max(0,(source.ammo??0)+(source.loaded??0)-(current.ammo??0)-(current.loaded??0));}
  for(const source of request.ammunitionSources??request.enemies??[]){const current=snapshot.units.find(u=>u.side==='enemy'&&String(u.id)===String(source.id));if(current&&(current.hp<=0||current.unconscious||current.routed))looted+=Math.max(0,(source.ammo??12)-(current.ammo??0));}
 }
 let returned=0;
 for(const report of reports){
  if(report.hp<=0)continue;
  const issued=request.squad.find(o=>o.id===Number(report.id));if(!issued)continue;
  const count=Math.max(0,Math.floor(report.loaded??0))+Math.max(0,Math.floor(report.ammo??0));if(!Number.isFinite(count)||count>100000)throw Error('La munición del parte es inválida.');
  if(snapshot&&report.loaded!==undefined&&report.ammo!==undefined){const actual=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===Number(report.id));if(actual&&(Number(actual.loaded??0)!==Number(report.loaded??0)||Number(actual.ammo??0)!==Number(report.ammo??0)))throw Error('El parte de munición no coincide con el sector.');}
  returned+=Math.min(count,(issued.loaded??0)+(issued.ammo??0)+looted);
 }
 return Math.min((request.issuedCartridges??0)+looted,returned);
}
