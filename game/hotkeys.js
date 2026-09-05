// Browser-safe tactical adaptation. No action is dispatched by this resolver.
export const TACTICAL_KEYS=[
 ['1–6 / Espacio','Seleccionar combatiente / siguiente'],['M / D','Carta de operaciones / terminar turno'],
 ['G / F / A','Cursor de movimiento / disparo / ataque cuerpo a cuerpo'],['R / S / C / P','Correr / caminar / agacharse / cuerpo a tierra'],
 ['RePág / AvPág','Subir / bajar postura'],['Z','Alternar caminar y sigilo agachado'],
 ['Alt+R','Recargar o cebar el arma'],['W','Cambiar entre arma principal y arma blanca'],
 ['B / O','Calar bayoneta / reservar fuego de cobertura'],['T','Montar o desmontar'],
 ['V','Mostrar u ocultar campo de visión'],['I / Q','Cursor para recoger equipo / curar compañero'],
 ['[ / ]','Reducir / aumentar puntería adicional'],['+ / −','Acercar / alejar'],['H / ?','Abrir o cerrar esta ayuda'],
 ['Esc','Volver al cursor de movimiento o cerrar ayuda'],
];
export function tacticalShortcut(event,{editing=false,dialog=false,nativeControl=false}={}){
 if(editing||dialog||event.repeat||event.isComposing||event.ctrlKey||event.metaKey)return null;
 const key=event.key.toLowerCase();
 if(nativeControl&&[' ','enter'].includes(key))return null;
 if(event.altKey)return key==='r'&&!event.shiftKey?'reload':null;
 if(event.shiftKey&&!['?','+','{','}'].includes(key))return null;
 if(/^[1-6]$/.test(key))return `select:${Number(key)-1}`;
 return ({' ':'next',m:'map',d:'turn',g:'move',f:'fire',a:'melee',r:'run',s:'walk',c:'crouch',p:'prone',z:'sneak',pageup:'stance-up',pagedown:'stance-down',w:'weapon',b:'brace',o:'overwatch',t:'mount',v:'sight',i:'loot',q:'heal','[':'aim-down',']':'aim-up','{':'aim-down','}':'aim-up','+':'zoom-in','=':'zoom-in','-':'zoom-out',h:'help','?':'help',escape:'cancel'})[key]??null;
}
