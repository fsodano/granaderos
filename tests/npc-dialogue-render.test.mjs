import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
const {default:Conversation,JA2Speech}=await import('../web/app/JA2Conversation.tsx');
const base={npc:{id:'local-retiro',name:'Sargento del cuartel',greeting:'La instrucción continúa.'},conversation:null,quest:{status:'unoffered'},reason:null,canApproach:false,onApproach(){},onTalk(){},onClose(){}};
test('a special non-recruitable character gets a portrait, text and relevant choices',()=>{const html=render(h(Conversation,base));assert.match(html,/role="dialog"/);assert.match(html,/avatar-man-soldier.webp/);assert.match(html,/La instrucción continúa/);assert.match(html,/Consultar encargo/);assert.match(html,/>Repetir respuesta</);assert.doesNotMatch(html,/Proponer incorporación/);assert.match(html,/>Listo</);});
test('current replies and completed quest options replace the initial panel content',()=>{const html=render(h(Conversation,{...base,conversation:{npcId:'local-retiro',text:'Recibimos los textiles.',options:['friendly','direct']},quest:{status:'completed'},reason:'Acercate.',canApproach:true}));assert.match(html,/Recibimos los textiles/);assert.doesNotMatch(html,/Consultar encargo|Entregar pertrechos/);assert.match(html,/disabled=""/);assert.match(html,/Acercarse para conversar/);});
test('ordinary replies are small speech boxes with no portrait or conversation choices',()=>{const html=render(h(JA2Speech,{name:'Vecino',text:'Disculpá, estoy trabajando.',position:{left:50,top:50},onClose(){}}));assert.match(html,/role="status"/);assert.match(html,/Disculpá, estoy trabajando/);assert.doesNotMatch(html,/role="dialog"|<img|Saludar|Preguntar|Proponer/);assert.equal((html.match(/<button/g)??[]).length,1);assert.match(html,/Cerrar respuesta/);});


test('replay remains in the special panel after delivery and remains subject to conversation availability',()=>{
 const conversation={npcId:'local-retiro',text:'Recibimos los textiles.',options:['repeat','friendly','direct']};
 const html=render(h(Conversation,{...base,conversation,quest:{status:'completed'}}));assert.match(html,/>Repetir respuesta</);assert.doesNotMatch(html,/Entregar pertrechos|Consultar encargo/);
 const blocked=render(h(Conversation,{...base,conversation,quest:{status:'completed'},reason:'Acercate.'}));assert.match(blocked,/<button disabled="">Repetir respuesta<\/button>/);
});

test('carried errands show actual received items and label acknowledgement separately from giving',()=>{const html=render(h(Conversation,{...base,npc:{...base.npc,questGifts:[{outfit:'poncho'}]},quest:{status:'offered',carried:{outfit:'poncho',count:2}}}));assert.match(html,/Ponchos recibidos: 1\/2/);assert.match(html,/>Confirmar entrega</);assert.doesNotMatch(html,/Entregar pertrechos/);});
