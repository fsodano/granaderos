'use client';
import {useBattlePreview} from './useBattlePreview';
export function useGroupMovePreview(battle:any,request:any){
 const result=useBattlePreview(battle,request,'group-preview');
 return {...result,preview:result.failed?{ok:false,reason:'No se pudo calcular la vista previa. La ruta se comprobará al dar la orden.',members:[]}:result.preview};
}
