import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,useState} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {contentIdentity} from '../game/content-identity.js';
register('./tactical-render-loader.mjs',import.meta.url);
function content(){const d=scaffoldDocuments('studio-content');return {...d.content,scenario:d.manifest.scenario,world:d.world,maps:d.maps,presentation:d.presentation,assets:d.assets};}

test('embedded story editor publishes changes to its owner without browser draft, navigation, loading or private undo',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://granaderos.test/studio',pretendToBeVisual:true}),globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const fetchBefore=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;throw Error('embedded editor must not fetch');};
 const storage=dom.window.Storage.prototype,setItem=storage.setItem;let writes=0;storage.setItem=function(){writes++;throw Error('embedded editor must not store');};
 const {default:ContentEditor}=await import('../web/app/story/ContentEditor.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');let current=content(),updates=0;
 function Harness(){const [draft,setDraft]=useState(current);current=draft;return h(ContentEditor,{embedded:true,content:draft,initialTab:'quests',onContentChange:next=>{updates++;setDraft(next);}});}
 const root=createRoot(dom.window.document.getElementById('root'));t.after(async()=>{await act(async()=>root.unmount());storage.setItem=setItem;globalThis.fetch=fetchBefore;dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 await act(async()=>root.render(h(Harness)));const button=text=>[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 assert.equal(button('Deshacer'),undefined);assert.equal(dom.window.document.querySelector('select[aria-label="Campaña base"]'),null);
 assert.equal(dom.window.document.querySelector('.content-editor').tagName,'SECTION');assert.equal(dom.window.document.querySelector('.content-editor main'),null);
 await act(async()=>button('Crear encargo').click());assert.equal(updates,1);assert.equal(current.quests.length,1);assert.ok(current.world);assert.ok(current.maps.camp);assert.ok(current.presentation.characterPortraits.length);
 await act(async()=>button('Eventos y suministros').click());await act(async()=>button('Crear evento').click());assert.equal(current.campaignEvents.length,1);assert.equal(updates,2);assert.equal(writes,0);assert.equal(fetches,0);assert.equal(dom.window.location.href,'https://granaderos.test/studio');
 const shortcut=new dom.window.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true});await act(async()=>dom.window.document.querySelector('.content-editor').dispatchEvent(shortcut));assert.equal(shortcut.defaultPrevented,false);assert.equal(updates,2,'embedded history remains owned by the master project');
});
test('character preview presents the shared 3D actor with authored skin, weapons, stance and motion while keeping the source intact',async()=>{
 const {characterPreviewScene,default:CharacterPreview}=await import('../web/app/studio/CharacterPreview.tsx'),d=content(),c=d.characters[0];c.skinTone='dark';c.spriteAppearance='woman-scout';const hash=contentIdentity(d).hash;
 const run=characterPreviewScene(d,c,{direction:2,motion:'run',equipment:'blade'});assert.equal(run.actors[0].skin,'dark');assert.equal(run.actors[0].appearance,'woman-scout');assert.equal(run.actors[0].action,'run');assert.ok(run.actors[0].items.some(i=>i.id==='1813'&&i.socket==='handRight'));
 const crouch=characterPreviewScene(d,c,{direction:6,posture:'crouched',equipment:'none'});assert.equal(crouch.actors[0].posture,'crouched');assert.ok(crouch.actors[0].items.every(i=>!['handRight','handLeft'].includes(i.socket)));assert.notEqual(run.actors[0].yaw,crouch.actors[0].yaw);assert.equal(contentIdentity(d).hash,hash);
 const {Scene}=await import('../web/node_modules/three/build/three.module.js'),{createSectorWorld}=await import('../web/lib/three/sector-world.ts'),{TILE_METRES}=await import('../web/lib/three/projection.ts');
 const world=createSectorWorld(new Scene(),{tileMetres:TILE_METRES,assetUrl:path=>path});
 try{for(const rendered of [run,crouch]){for(const key of ['units','npcs','players','enemies'])assert.equal(key in rendered.world.terrain,false);assert.doesNotThrow(()=>world.update(rendered.world));assert.ok(world.inspect().meshes>0);}}finally{world.dispose();}
 const html=renderToStaticMarkup(h(CharacterPreview,{content:d,character:c,resolveAsset:ref=>ref===c.portrait?'data:image/png;base64,test':ref}));assert.match(html,/data-sector-renderer="three"/);assert.match(html,/data:image\/png;base64,test/);assert.match(html,/Dirección de la vista/);assert.match(html,/Movimiento de la vista/);
});
test('quest editor protects event references and force appearance controls use explicit neutral generic defaults',async()=>{
 const {default:QuestEditor}=await import('../web/app/story/QuestEditor.tsx'),{default:ForceEquipment}=await import('../web/app/story/ForceEquipment.tsx'),d=content();d.quests=[{id:'report',title:'Informe',description:'Un informe.'}];d.campaignEvents=[{id:'start',atHour:1,text:'Se necesita un informe.',conditions:[],effects:[{type:'quest',quest:'report',status:'active'}]}];
 const html=renderToStaticMarkup(h(QuestEditor,{draft:d,onChange:()=>{}}));assert.match(html,/disabled="">Eliminar encargo/);assert.match(html,/Usado por eventos: start/);
 delete d.oppositionEquipment;delete d.oppositionBlades;d.oppositionAppearance=Object.fromEntries(['officer','line','veteran'].map(role=>[role,{spriteAppearance:'worker',skinTone:'dark'}]));
 const force=renderToStaticMarkup(h(ForceEquipment,{draft:d,onChange:()=>{}}));assert.match(force,/empieza sin arma principal/);assert.match(force,/empieza sin arma blanca/);assert.match(force,/Apariencia de la tropa/);assert.match(force,/value="dark" selected=""/);
});
test('a generic numeric identity remains editable and does not show inherited historical abilities',async()=>{
 const {default:ContentEditor}=await import('../web/app/story/ContentEditor.tsx'),d=content();d.characters[0].id='person-3';delete d.characters[0].abilities;
 const html=renderToStaticMarkup(h(ContentEditor,{embedded:true,content:d})),dom=new JSDOM(html),field=dom.window.document.querySelector('fieldset[aria-label="Habilidades de combate"]');
 assert.equal(field.querySelectorAll('input:checked').length,0);assert.match(html,/Duplicar personaje/);assert.match(html,/Formación y progreso/);dom.window.close();
});
test('weapon and artillery catalogue previews resolve private project images without changing authored asset references',async()=>{
 const {default:ContentEditor}=await import('../web/app/story/ContentEditor.tsx'),{default:ArtilleryProfiles}=await import('../web/app/story/ArtilleryProfiles.tsx'),{ARTILLERY}=await import('../game/artillery-definitions.js'),d=content(),hash=contentIdentity(d).hash;
 const privateImage='data:image/png;base64,cHJldmlldw==',resolveAsset=()=>privateImage;
 const html=renderToStaticMarkup(h(ContentEditor,{embedded:true,initialTab:'weapons',content:d,resolveAsset})),dom=new JSDOM(html);
 for(const image of dom.window.document.querySelectorAll('.weapon-thumbnail,.weapon-preview'))assert.equal(image.getAttribute('src'),privateImage);
 assert.ok(dom.window.document.querySelector('.weapon-thumbnail'));dom.window.close();
 const profiles=Object.fromEntries(Object.entries(ARTILLERY).map(([id,profile])=>[id,{...profile,art:`/campaigns/studio-content/assets/${id}.png`}])),artillery=new JSDOM(renderToStaticMarkup(h(ArtilleryProfiles,{draft:{...d,artilleryProfiles:profiles},onChange:()=>{},resolveAsset})));
 assert.equal(artillery.window.document.querySelectorAll('img').length,4);for(const image of artillery.window.document.querySelectorAll('img'))assert.equal(image.getAttribute('src'),privateImage);
 artillery.window.close();assert.equal(contentIdentity(d).hash,hash);
});
