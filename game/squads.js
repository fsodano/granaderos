export function migrateSquads(s){
 if(!s.squads)s.squads=[{id:'squad-1',name:'Primera escuadra',members:[...s.squad],location:s.location}];
 s.activeSquadId??=s.squads[0]?.id??'squad-1';s.sectorStates??={};
 return s;
}
export function activeSquad(s){return (s.squads??[]).find(q=>q.id===s.activeSquadId)??{id:'squad-1',name:'Primera escuadra',members:s.squad,location:s.location};}
export function operativeLocation(s,id){return s.squads?.find(q=>q.members.includes(id))?.location??s.operativeState[id]?.location??s.location;}
export function synchronizeSquad(s){const squad=s.squads.find(q=>q.id===s.activeSquadId);if(squad){squad.members=[...s.squad];squad.location=s.location;}return s;}
export function validateSectorSnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||JSON.stringify(snapshot).length>600000)throw Error('El estado del sector es inválido.');
 if(!Number.isInteger(snapshot.width)||!Number.isInteger(snapshot.height)||snapshot.width<8||snapshot.width>64||snapshot.height<8||snapshot.height>64||!Array.isArray(snapshot.units)||snapshot.units.length>100||!Array.isArray(snapshot.tiles)||snapshot.tiles.length!==snapshot.width*snapshot.height)throw Error('El plano del sector es inválido.');
 const positions=new Set();
 for(const t of snapshot.tiles){if(!t||!Number.isInteger(t.x)||!Number.isInteger(t.y)||t.x<0||t.x>=snapshot.width||t.y<0||t.y>=snapshot.height||!['grass','mud','road','water','wall','stone','forest'].includes(t.type)||typeof t.blocked!=='boolean'||!Number.isFinite(t.cover)||t.cover<0||t.cover>100||positions.has(`${t.x},${t.y}`))throw Error('El terreno guardado es inválido.');positions.add(`${t.x},${t.y}`);}
 for(const field of ['artillery','smoke','decor','log','npcs','groundItems','droppedWeapons'])if(snapshot[field]!==undefined&&(!Array.isArray(snapshot[field])||snapshot[field].length>1000))throw Error('Los objetos del sector son inválidos.');
 for(const u of snapshot.units)if(!u||typeof u.id!=='string'||typeof u.name!=='string'||u.name.length>100||!['player','enemy','civilian'].includes(u.side)||!Number.isFinite(u.hp)||u.hp<0||u.hp>200||!Number.isInteger(u.x)||!Number.isInteger(u.y)||u.x<0||u.x>=snapshot.width||u.y<0||u.y>=snapshot.height)throw Error('Los habitantes del sector son inválidos.');
 return snapshot;
}
export function validatePersonalInventory(inventory){
 if(!inventory||typeof inventory!=='object'||Array.isArray(inventory)||Object.keys(inventory).length>100)throw Error('El inventario del combatiente es inválido.');
 for(const [key,value]of Object.entries(inventory)){
  if(key.length>100||/[<>\x00-\x1f]/.test(key))throw Error('El inventario del combatiente es inválido.');
  if(typeof value==='number'){if(!Number.isInteger(value)||value<0||value>10000)throw Error('La cantidad de pertrechos es inválida.');continue;}
  if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isInteger(value.count)||value.count<0||value.count>10000||!Number.isFinite(value.weight)||value.weight<0||value.weight>1000)throw Error('Los pertrechos del combatiente son inválidos.');
  if(value.weapon!==undefined&&(!Number.isInteger(value.weapon)||value.weapon<1800||value.weapon>1813))throw Error('El arma recuperada es inválida.');
  if(value.loaded!==undefined&&(!Number.isInteger(value.loaded)||value.loaded<0||value.loaded>2))throw Error('La carga del arma recuperada es inválida.');
  if(value.condition!==undefined&&(!Number.isFinite(value.condition)||value.condition<0||value.condition>100))throw Error('El estado del arma recuperada es inválido.');
 }
 return inventory;
}
