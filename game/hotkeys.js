// Browser-safe tactical adaptation. No action is dispatched by this resolver.
export const TACTICAL_KEYS=[
 ['1–6 / Espacio','Seleccionar combatiente / siguiente'],['M / D','Carta de operaciones / terminar turno'],
 ['Mayús+clic','Agregar o quitar un aliado del grupo durante exploración'],
 ['Ctrl+clic / Ctrl+Enter sobre un enemigo','Con manos libres: intentar quitar el arma; consume los PA restantes'],
 ['Alt+clic en suelo libre','Mover solo al seleccionado sin girar; caminar, agachado o cuerpo a tierra'],
 ['G / F / A','Uso contextual / disparo deliberado a enemigo o casilla, o usar objeto / equipar arma blanca'],['Mayús+R / S / C / P','Correr / caminar / agacharse / cuerpo a tierra'],
 ['RePág / AvPág','Subir / bajar postura'],['Z','Activar o desactivar sigilo sin cambiar de postura'],['L','Mirar hacia una casilla; en la misma dirección, preparar el arma sin disparar'],['Botón derecho / clic izquierdo','Entrar en puntería; sobre personaje, aumentarla; sobre suelo, cancelar / disparar'],['↑ / ↓ sobre un objetivo con foco','Elegir cabeza, torso o piernas; cuerpo a tierra usa una sola zona'],
 ['R','Recargar o cebar el arma'],['W','Cambiar entre arma, arma blanca, vendas, herramientas, cada pertrecho y manos libres'],
 ['J','Hablar: seleccioná una persona contigua; Esc vuelve a movimiento'],
 ['B','Guardia con bayoneta ya fijada'],['T','Montar o desmontar'],
 ['V','Mostrar u ocultar campo de visión'],['I / Q','Cursor para recoger equipo / equipar vendas'],
 ['[ / ]','Reducir / aumentar puntería adicional'],['+ / −','Acercar / alejar'],['H / ?','Abrir o cerrar esta ayuda'],
 ['Esc','Volver al cursor de movimiento o cerrar ayuda'],
 ['Tab sobre el campo','Cambiar el cursor entre suelo y nivel superior'],
];
export function pointerItemIntent(event){return event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey?'steal':'use';}
export function pointerMovementIntent(event){
 return event.altKey&&!event.ctrlKey&&!event.metaKey?'preserveFacing':'forward';
}
export function tacticalShortcut(event,{editing=false,dialog=false,nativeControl=false}={}){
 if(editing||dialog||event.repeat||event.isComposing||event.ctrlKey||event.metaKey)return null;
 const key=event.key.toLowerCase();
 if(nativeControl&&[' ','enter','tab'].includes(key))return null;
 if(event.altKey)return key==='r'&&!event.shiftKey?'reload':null;
 if(event.shiftKey&&key==='r')return 'run';
 if(event.shiftKey&&!['?','+','{','}'].includes(key))return null;
 if(key==='tab')return 'cursor-level';
 if(/^[1-6]$/.test(key))return `select:${Number(key)-1}`;
 return ({' ':'next',m:'map',d:'turn',g:'move',f:'fire',a:'melee',r:'reload',s:'walk',c:'crouch',p:'prone',z:'stealth',l:'look',pageup:'stance-up',pagedown:'stance-down',w:'weapon',b:'brace',o:'overwatch',t:'mount',j:'talk',v:'sight',i:'loot',q:'heal','[':'aim-down',']':'aim-up','{':'aim-down','}':'aim-up','+':'zoom-in','=':'zoom-in','-':'zoom-out',h:'help','?':'help',escape:'cancel'})[key]??null;
}
