import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,StrictMode,useState} from '../web/node_modules/react/index.js';

register('./tactical-render-loader.mjs',import.meta.url);

async function mount(t,{initial,kind='fields',path='content',nestedProvider=false,withHistory=false}){
  const unexpected=[],console=new VirtualConsole();
  console.on('jsdomError',error=>unexpected.push(error));
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{
    url:'https://granaderos.test/studio',pretendToBeVisual:true,virtualConsole:console,
  });
  const globals={
    window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,
    Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,
    MutationObserver:dom.window.MutationObserver,
    getComputedStyle:dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT:true,
  };
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const {default:FieldEditor,DocumentEditor}=await import('../web/app/studio/FieldEditor.tsx');
  const {DocumentDraftProvider,DocumentDraftStatus,useDocumentDraftStore}=await import('../web/app/studio/DocumentDrafts.tsx');
  const {changeStudioProject,undoStudioProject,redoStudioProject}=await import('../web/lib/campaign-studio-history.ts');
  const {createRoot}=await import('../web/node_modules/react-dom/client.js');
  const root=createRoot(dom.window.document.getElementById('root'));
  let applied,changeValue,changeVisibility,changeDocumentPath,changeOwnerHistory,ownerHistory,reject=false,drafts={},scope;
  const changes=[];
  function ObserveDrafts(){
    const store=useDocumentDraftStore();drafts=store.drafts;scope=store.scope;
    return h(DocumentDraftStatus,{onOpen:()=>changeVisibility(true)});
  }
  function Harness(){
    const [localValue,setValue]=useState(()=>structuredClone(initial));
    // Use the master's actual project history, with an intentionally editable
    // minimal draft; the numeric control owns only its calendar month field.
    const [history,setHistory]=useState(()=>({past:[],current:{
      format:'granaderos-editor-project',version:1,manifest:{id:'numeric-owner'},
      content:{},world:{},presentation:{calendar:{month:initial}},maps:{},
      mapIndex:{maps:[]},assets:{assets:[]},resources:{},
    },future:[]}));
    const [visible,setVisible]=useState(true);
    const [documentPath,setDocumentPath]=useState(path);
    const value=withHistory?history.current.presentation.calendar.month:localValue;
    const accept=next=>withHistory?setHistory(current=>changeStudioProject(current,{
      ...current.current,presentation:{...current.current.presentation,
        calendar:{...current.current.presentation.calendar,month:next}},
    })):setValue(next);
    applied=value;changeValue=accept;changeVisibility=setVisible;
    changeDocumentPath=setDocumentPath;
    ownerHistory=history;changeOwnerHistory=setHistory;
    const editor=visible?h(kind==='document'?DocumentEditor:FieldEditor,{
      value,label:'Documento',path:documentPath,onChange:next=>{
        changes.push(structuredClone(next));
        if(!reject)accept(next);
      },
    }):null;
    return h(DocumentDraftProvider,{scope:'project-a'},
      h(ObserveDrafts),nestedProvider?h(DocumentDraftProvider,{scope:'embedded-panel'},editor):editor,
    );
  }
  t.after(async()=>{
    await act(async()=>root.unmount());dom.window.close();
    for(const [key,descriptor]of previous){
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
    assert.deepEqual(unexpected,[],'mounted editor must not emit unexpected DOM errors');
  });
  await act(async()=>root.render(h(StrictMode,null,h(Harness))));
  const document=dom.window.document;
  const button=(text,scope=document)=>{
    const result=[...scope.querySelectorAll('button')].find(element=>element.textContent.trim()===text);
    assert.ok(result,`button ${text}`);return result;
  };
  const label=(text,scope=document)=>{
    const result=[...scope.querySelectorAll('label')].find(element=>element.firstChild?.textContent.trim()===text);
    assert.ok(result,`label ${text}`);return result.querySelector('input,select,textarea');
  };
  return {
    dom,document,button,label,changes,
    get value(){return applied;},get drafts(){return drafts;},get scope(){return scope;},get history(){return ownerHistory;},
    rejectChanges(value=true){reject=value;},
    async external(value){await act(async()=>changeValue(value));},
    async openDocument(nextPath,value){await act(async()=>{changeDocumentPath(nextPath);changeValue(value);});},
    async show(value){await act(async()=>changeVisibility(value));},
    async undo(){await act(async()=>changeOwnerHistory(undoStudioProject));},
    async redo(){await act(async()=>changeOwnerHistory(redoStudioProject));},
    async focus(element){await act(async()=>element.focus());},
    async click(element){await act(async()=>element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
    async input(element,value){
      const prototype=element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:
        element.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);
      await act(async()=>element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true})));
    },
    async blur(element){await act(async()=>{
      if(document.activeElement===element)element.blur();
      else element.dispatchEvent(new dom.window.FocusEvent('focusout',{bubbles:true}));
    });},
  };
}

test('numeric fields retain the applied number while cleared or partial negative/comma input is typed',async t=>{
  const m=await mount(t,{initial:7,path:'world.projection.minLongitude'}),input=m.label('Documento');
  assert.equal(input.inputMode,'decimal');
  await m.input(input,'7');await m.blur(input);assert.deepEqual(m.changes,[],'unchanged typing and blur cannot emit an edit');
  await m.input(input,'');assert.equal(input.value,'');assert.equal(m.value,7);assert.deepEqual(m.changes,[]);
  await m.input(input,'-');assert.equal(input.value,'-');assert.equal(m.value,7);
  await m.input(input,'-2');assert.equal(m.value,-2);
  await m.input(input,'-2,');assert.equal(input.value,'-2,');assert.equal(m.value,-2);
  await m.input(input,'-2,5');assert.equal(input.value,'-2,5');assert.equal(m.value,-2.5);
  const changes=m.changes.length;
  await m.blur(input);assert.equal(input.value,'-2.5');assert.equal(m.value,-2.5);
  await m.input(input,'-2.50');await m.blur(input);assert.equal(m.changes.length,changes,'equivalent numeric text must not add history');
  assert.ok(m.changes.length>0);assert.ok(m.changes.every(value=>typeof value==='number'));
  assert.equal(m.document.querySelector('[role="alert"]'),null);
  assert.equal(m.document.querySelector('.studio-null-field'),null);
});

test('master project redo survives focus and unchanged numeric blur after undo',async t=>{
  const m=await mount(t,{initial:6,path:'presentation.calendar.month',withHistory:true}),input=m.label('Documento');
  await m.focus(input);await m.input(input,'6');await m.blur(input);
  assert.deepEqual(m.changes,[]);assert.equal(m.history.past.length,0);
  await m.input(input,'7');assert.equal(m.value,7);assert.equal(m.history.past.length,1);
  await m.undo();assert.equal(m.value,6);assert.equal(input.value,'6');assert.equal(m.history.future.length,1);
  await m.focus(input);assert.equal(m.document.activeElement,input);
  await m.blur(input);assert.equal(m.value,6);assert.equal(m.history.future.length,1);
  assert.equal(m.history.past.length,0);assert.deepEqual(m.changes,[7]);
  await m.redo();assert.equal(m.value,7);assert.equal(input.value,'7');
  assert.equal(m.history.past.length,1);assert.equal(m.history.future.length,0);
  await m.blur(input);assert.deepEqual(m.changes,[7]);assert.equal(m.history.past.length,1);
});

test('invalid numeric blur restores the last applied value and exposes its accessible notice',async t=>{
  const m=await mount(t,{initial:4,path:'content.rules.startingTreasury'}),input=m.label('Documento');
  await m.input(input,'12');assert.equal(m.value,12);
  const changes=m.changes.length;
  for(const invalid of ['', 'not-a-number', '1,2,3']){
    await m.input(input,invalid);assert.equal(m.value,12);
    await m.blur(input);assert.equal(input.value,'12');assert.equal(m.value,12);
    assert.equal(input.getAttribute('aria-invalid'),'true');
    const notice=m.document.getElementById(input.getAttribute('aria-describedby'));
    assert.equal(notice.getAttribute('role'),'alert');
    assert.match(notice.textContent,/Se conservó el último valor aplicado/);
  }
  assert.equal(m.changes.length,changes,'invalid text cannot emit a replacement value');
  await m.input(input,'13');assert.equal(m.value,13);assert.equal(input.getAttribute('aria-invalid'),'false');
});

test('collection search uses translated accent-insensitive labels and adding clears an empty filter without losing unknown data',async t=>{
  const initial={id:'draft',name:'Nombre inicial',revision:'r1',title:'Título',
    introduction:{text:'Escena inicial'},weather:{season:'templado'},
    extension:{nested:{kept:true},customList:[1,2,3]}};
  const m=await mount(t,{initial,path:'presentation'}),search=m.label('Buscar elementos');
  await m.input(search,'introduccion');
  const rows=()=>[...m.document.querySelector('[aria-label="Documento"]').querySelectorAll(':scope > .studio-field-body > .studio-field-row')];
  assert.equal(rows().length,1);assert.match(rows()[0].textContent,/Introducción/);
  await m.input(search,'nombre');await m.input(m.label('Nombre'),'Nombre revisado');
  assert.equal(m.value.name,'Nombre revisado');assert.deepEqual(m.value.extension,initial.extension);
  await m.input(search,'nothing-matches');assert.equal(rows().length,0);
  assert.match(m.document.querySelector('[role="status"]').textContent,/No hay resultados/);
  await m.input(m.label('Campo nuevo'),'customNote');await m.click(m.button('Agregar campo'));
  assert.equal(search.value,'');assert.equal(m.value.customNote,'');
  assert.equal(rows().length,Object.keys(initial).length+1);
  assert.deepEqual(m.value.extension,initial.extension);assert.deepEqual(m.value.introduction,initial.introduction);
  assert.equal(m.value.name,'Nombre revisado');assert.equal(m.document.querySelector('[role="status"]'),null);
});

test('array collection search finds accented names and adding retains the original authored records',async t=>{
  const initial=Array.from({length:6},(_,i)=>({id:`actor-${i}`,name:i===3?'José Álvarez':`Actor ${i}`,extension:{ordinal:i}}));
  const m=await mount(t,{initial,path:'content.characters'}),search=m.label('Buscar elementos');
  await m.input(search,'jose alvarez');
  const rows=()=>[...m.document.querySelector('[aria-label="Documento"]').querySelectorAll(':scope > .studio-field-body > .studio-field-row')];
  assert.equal(rows().length,1);assert.match(rows()[0].textContent,/José Álvarez/);
  await m.input(search,'absent-record');assert.equal(rows().length,0);
  await m.input(m.label('Tipo'),'object');await m.click(m.button('Agregar elemento'));
  assert.equal(search.value,'');assert.equal(rows().length,7);
  assert.deepEqual(m.value.slice(0,6),initial);assert.deepEqual(m.value[6],{});
});

test('unapplied JSON survives document unmount/reopen through the persistent owner provider',async t=>{
  const m=await mount(t,{initial:{name:'Applied',extension:{keep:true}},kind:'document',path:'presentation',nestedProvider:true});
  await m.click(m.button('JSON'));
  const staged='{\n  "name": "Unfinished",\n';
  await m.input(m.label('Documento JSON'),staged);
  assert.equal(m.scope,'project-a');assert.deepEqual(Object.keys(m.drafts),['project-a:presentation']);
  assert.equal(m.drafts['project-a:presentation'].text,staged);
  assert.match(m.document.querySelector('.studio-staged-notice').textContent,/1 documento tiene texto sin aplicar/);
  const unload=new m.dom.window.Event('beforeunload',{cancelable:true});m.dom.window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented,true,'pending text must install the owner leave guard');
  await m.show(false);assert.equal(m.document.querySelector('textarea'),null);
  await m.show(true);assert.equal(m.label('Documento JSON').value,staged);
  assert.equal(m.document.querySelector('.editor-status').textContent,'Texto sin aplicar');
  assert.deepEqual(m.value,{name:'Applied',extension:{keep:true}});assert.deepEqual(m.changes,[]);
  await m.click(m.button('Aplicar documento'));
  assert.match(m.document.querySelector('[role="alert"]').textContent,/No se pudo aplicar el documento/);
  assert.equal(m.label('Documento JSON').value,staged);
});

test('a rejected owner change retains staged JSON and the prior applied document after reopening',async t=>{
  const initial={name:'Applied',extension:{keep:true}},m=await mount(t,{initial,kind:'document',path:'content'});
  await m.click(m.button('JSON'));const next={name:'Rejected',extension:{keep:true}},staged=JSON.stringify(next);
  await m.input(m.label('Documento JSON'),staged);m.rejectChanges();await m.click(m.button('Aplicar documento'));
  assert.deepEqual(m.changes,[next]);assert.deepEqual(m.value,initial);
  assert.equal(m.label('Documento JSON').value,staged);assert.equal(m.drafts['project-a:content'].text,staged);
  assert.equal(m.document.querySelector('.editor-status').textContent,'Texto sin aplicar');
  await m.show(false);await m.show(true);
  assert.equal(m.label('Documento JSON').value,staged);assert.deepEqual(m.value,initial);
});

test('rejected apply cannot acknowledge another document with independently staged text when its path changes',async t=>{
  const documentA={name:'A applied'},documentB={name:'B applied'};
  const m=await mount(t,{initial:documentA,kind:'document',path:'maps.a'});
  await m.click(m.button('JSON'));
  await m.openDocument('maps.b',documentB);
  const stagedB=JSON.stringify({name:'B unfinished',extension:{keep:'B text'}});
  await m.input(m.label('Documento JSON'),stagedB);
  await m.openDocument('maps.a',documentA);
  // This rejected A replacement matches B's applied bytes. A pending apply
  // without its document key used to delete B's unrelated staged record.
  const stagedA=JSON.stringify(documentB);
  await m.input(m.label('Documento JSON'),stagedA);m.rejectChanges();
  await m.click(m.button('Aplicar documento'));
  assert.deepEqual(m.changes,[documentB]);assert.deepEqual(m.value,documentA);
  await m.openDocument('maps.b',documentB);
  assert.deepEqual(m.value,documentB);assert.equal(m.label('Documento JSON').value,stagedB);
  assert.equal(m.drafts['project-a:maps.b'].text,stagedB);
  assert.equal(m.drafts['project-a:maps.a'].text,stagedA);
  assert.equal(Object.keys(m.drafts).length,2);
  assert.equal(m.document.querySelector('.editor-status').textContent,'Texto sin aplicar');
  await m.openDocument('maps.a',documentA);
  assert.equal(m.label('Documento JSON').value,stagedA);
  assert.equal(m.drafts['project-a:maps.b'].text,stagedB);assert.deepEqual(m.changes,[documentB]);
});

test('external document changes require explicit replacement and accepted JSON clears the staged owner record',async t=>{
  const initial={name:'Original',extension:{kept:'original'}},m=await mount(t,{initial,kind:'document',path:'presentation'});
  await m.click(m.button('JSON'));const next={name:'Staged',extension:{kept:'draft'}},staged=JSON.stringify(next);
  await m.input(m.label('Documento JSON'),staged);
  const external={name:'External',extension:{kept:'external'}};await m.external(external);
  assert.match(m.document.querySelector('.studio-document-conflict').textContent,/Los datos aplicados cambiaron/);
  assert.equal(m.button('Aplicar documento').disabled,true);assert.equal(m.label('Documento JSON').value,staged);
  await m.click(m.button('Aplicar documento'));assert.deepEqual(m.changes,[]);assert.deepEqual(m.value,external);
  await m.click(m.document.querySelector('.studio-document-conflict input[type="checkbox"]'));
  assert.equal(m.button('Aplicar documento').disabled,false);
  const newer={name:'External again',extension:{kept:'newer'}};await m.external(newer);
  assert.equal(m.document.querySelector('.studio-document-conflict input[type="checkbox"]').checked,false);
  assert.equal(m.button('Aplicar documento').disabled,true,'replacement approval cannot survive another applied update');
  assert.deepEqual(m.value,newer);assert.equal(m.label('Documento JSON').value,staged);
  await m.click(m.document.querySelector('.studio-document-conflict input[type="checkbox"]'));
  await m.click(m.button('Aplicar documento'));assert.deepEqual(m.value,next);assert.deepEqual(m.changes,[next]);
  assert.deepEqual(m.drafts,{});assert.equal(m.document.querySelector('.studio-staged-notice'),null);
  assert.equal(m.document.querySelector('.studio-document-conflict'),null);
  assert.equal(m.document.querySelector('.editor-status').textContent,'Datos aplicados');
  assert.equal(m.button('Aplicar documento').disabled,true);
  const unload=new m.dom.window.Event('beforeunload',{cancelable:true});m.dom.window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented,false,'accepted text must release the owner leave guard');
  await m.show(false);await m.show(true);assert.equal(m.document.querySelector('textarea'),null);
  await m.click(m.button('JSON'));assert.deepEqual(JSON.parse(m.label('Documento JSON').value),next);
});
