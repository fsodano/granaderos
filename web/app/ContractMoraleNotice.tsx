type RenewalStatus={blocked:boolean;morale:number|null;reason:string|null};
function personalMoraleText(morale:number){
 // Keep two decimal places without rounding a refusal upward to the boundary.
 const [whole,fraction]=String(morale).split('.');
 const visible=fraction&&!fraction.includes('e')?Number(`${whole}.${fraction.slice(0,2)}`):morale;
 return visible.toLocaleString('es-AR',{maximumFractionDigits:2});
}
export default function ContractMoraleNotice({status}:{status?:RenewalStatus|null}){
 if(!status?.blocked||!status.reason)return null;
 return <div className="service-refusal" role="status" aria-label="Rechazo de renovación por moral">
  {status.morale!==null&&<p>Moral personal: <strong>{personalMoraleText(status.morale)}</strong>.</p>}
  <p>{status.reason}</p>
 </div>;
}
