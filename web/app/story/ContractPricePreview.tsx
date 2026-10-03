import {contractQuote,contractTermsFor} from '../../../game/contracts.js';
export default function ContractPricePreview({draft,monthlyPay}:{draft:any;monthlyPay:number}){
 const state={contentCampaign:{package:draft}},operative={service:'contract',monthlyPay};
 return <small>Precios iniciales: {Object.entries(contractTermsFor(state)).map(([term,period])=>`${period.name.toLocaleLowerCase('es')}: ${contractQuote(state,operative,term).price} pesos`).join('; ')}. La paga diaria se redondea hacia arriba; la experiencia puede aumentar el precio futuro.</small>;
}
