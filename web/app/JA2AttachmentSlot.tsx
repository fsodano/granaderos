'use client';
import {formatAP} from '../../game/action-points.js';

import {sitePath} from '../lib/site-path.js';
import {equipmentAttachmentHost} from '../../game/equipment-cursor.js';
import {equipmentFingerprint} from '../../game/tactical-inventory.js';
import {equipmentAttachmentPreview} from '../../game/tactical.js';
import {fittingLabel} from '../../game/weapon-fittings.js';
import {useEquipmentInteraction} from '../lib/equipment-drag';
import './ja2-attachment-slot.css';
type Props={battle:any;unit:any;hostId:string;disabled:boolean;onOrder:(action:any)=>any};
export default function JA2AttachmentSlot({battle,unit,hostId,disabled,onOrder}:Props){
 const {store}=useEquipmentInteraction();
 let host;try{host=equipmentAttachmentHost(unit,hostId);}catch{return null;}
 if(!host.supported)return <p className="ja2-attachment-none">Este modelo no admite la bayoneta disponible.</p>;
 const action={type:'attachment',unitId:String(unit.id),hostId,operation:unit.equipmentCursor?'attach':'detach',expectedHost:equipmentFingerprint(unit,hostId),expectedCursor:equipmentFingerprint(unit,'cursor')};
 const preview=equipmentAttachmentPreview(battle,unit,action),fitting=host.fitting;
 const verb=action.operation==='detach'?'Retirar al cursor':preview.swapped?'Cambiar bayoneta':'Colocar bayoneta';
 const cost=battle.mode==='exploration'?'sin PA':`${formatAP(preview.pa)} PA`;
 const name=fitting?fittingLabel(fitting.fittingPattern):'Sin bayoneta';
 const hint=!unit.equipmentCursor&&!fitting?'Tomá una bayoneta y colocala en esta ranura.':preview.reason??`${verb} · ${cost}`;
 return <section className="ja2-attachment-detail" aria-label="Accesorios del arma" data-equipment-scope={store.scope}>
  <button type="button" className={`ja2-attachment-slot${fitting?' occupied':''}`} data-attachment-host={hostId} aria-label={`${name}. ${verb} · ${cost}`} title={hint} disabled={disabled||!preview.valid} onClick={event=>{event.stopPropagation();store.dispatch(action,onOrder);}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}>
   <small>Bayoneta</small>{fitting?<><img src={sitePath('/art/weapon-1811.png')} alt=""/><span>{name}</span><small>Estado {fitting.condition}%</small></>:<span>Vacía</span>}
  </button>
  <p>{hint}</p>
  {typeof fitting?.metadata?.name==='string'&&fitting.metadata.name&&<small>{fitting.metadata.name}</small>}
 </section>;
}
