import {contractQuote,contractTermsFor} from '../../../game/contracts.js';
export default function ContractPricePreview({draft,monthlyPay,serviceGuarantee=0}:{draft:any;monthlyPay:number;serviceGuarantee?:number}){
 const state={contentCampaign:{package:draft}},operative={service:'contract',monthlyPay,serviceGuarantee};
 return <small>Precios iniciales: {Object.entries(contractTermsFor(state)).map(([term,period])=>{const quote=contractQuote(state,operative,term);return `${period.name.toLocaleLowerCase('es')}: ${quote.guarantee?`paga ${quote.price} + garantía ${quote.guarantee} = ${quote.total}`:quote.price} pesos`;}).join('; ')}. La paga diaria se redondea hacia arriba; la experiencia puede aumentar el precio futuro. {serviceGuarantee>0&&<> La garantía se financia una vez por incorporación y se devuelve según la salud al finalizar. No cubre la paga por fallecimiento.</>}</small>;
}
