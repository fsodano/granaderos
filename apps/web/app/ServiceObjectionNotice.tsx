export default function ServiceObjectionNotice({reason}:{reason?:string|null}){
 if(!reason)return null;
 return <div className="service-refusal" role="status" aria-label="Objeción de servicio">
  <p>{reason}</p>
 </div>;
}
