import {presentedEndTurn} from '../../game/tactical.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:presentedEndTurn(data.state)});}catch{self.postMessage({id:data.id,error:'No se pudo completar el turno. Intentá de nuevo.'});}};
