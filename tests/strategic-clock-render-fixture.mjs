import assert from 'node:assert/strict';

// Drive the actual continuous-clock callbacks through its rendered controls.
// Each callback can stop the clock; the fixture never skips an interrupt.
export function strategicClockControls(t,act,document){
 const callbacks=new Map();let serial=0;
 const interval=t.mock.method(globalThis,'setInterval',callback=>{const id=++serial;callbacks.set(id,callback);return id;});
 const clear=t.mock.method(globalThis,'clearInterval',id=>callbacks.delete(id));
 t.after(()=>{interval.mock.restore();clear.mock.restore();callbacks.clear();});
 return {async advanceHour(){
  const speed=document.querySelector('[aria-label="Velocidad del tiempo"]');assert.ok(speed,'continuous speed control');
  if(speed.value!=='3600'){Object.getOwnPropertyDescriptor(document.defaultView.HTMLSelectElement.prototype,'value').set.call(speed,'3600');await act(async()=>speed.dispatchEvent(new document.defaultView.Event('change',{bubbles:true})));}
  if(!callbacks.size){const start=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='▶ Iniciar');assert.ok(start,'resume the continuous clock');assert.equal(start.disabled,false);await act(async()=>start.dispatchEvent(new document.defaultView.MouseEvent('click',{bubbles:true})));}
  for(let quarter=0;quarter<4&&callbacks.size;quarter++){const callback=callbacks.values().next().value;await act(async()=>callback());}
  const pause=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Ⅱ Pausar');
  if(pause)await act(async()=>pause.dispatchEvent(new document.defaultView.MouseEvent('click',{bubbles:true})));
 }};
}
