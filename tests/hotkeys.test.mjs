import test from 'node:test';
import assert from 'node:assert/strict';
import {tacticalShortcut,TACTICAL_KEYS,pointerMovementIntent} from '../game/hotkeys.js';
const key=(key,extra={})=>({key,...extra});
test('adapted actions distinguish reload from running and preserve browser chords',()=>{
 assert.equal(tacticalShortcut(key('r')),'run');assert.equal(tacticalShortcut(key('r',{altKey:true})),'reload');
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true,shiftKey:true}])assert.equal(tacticalShortcut(key('r',extra)),null);
 assert.equal(tacticalShortcut(key('m',{altKey:true})),null);
});
test('editing, open dialogs, repeats and IME composition cannot issue tactical actions',()=>{
 for(const state of [{editing:true},{dialog:true}])assert.equal(tacticalShortcut(key('d'),state),null);
 for(const extra of [{repeat:true},{isComposing:true}])assert.equal(tacticalShortcut(key('d',extra)),null);
});
test('selection, posture, equipment and utility shortcuts resolve independently',()=>{
 const actions={'1':'select:0','6':'select:5',' ':'next',PageUp:'stance-up',PageDown:'stance-down',w:'weapon',b:'brace',o:'overwatch',t:'mount',i:'loot',q:'heal',z:'stealth',l:'look',v:'sight',']':'aim-up','[':'aim-down','+':'zoom-in','-':'zoom-out',h:'help',Escape:'cancel'};
 for(const [keyName,action] of Object.entries(actions))assert.equal(tacticalShortcut(key(keyName)),action);
 assert.equal(tacticalShortcut(key('?',{shiftKey:true})),'help');assert.equal(tacticalShortcut(key('x')),null);assert.ok(TACTICAL_KEYS.length>=15);
 assert.match(TACTICAL_KEYS.find(([keys])=>keys==='W')[1],/cada pertrecho/);
 assert.equal(tacticalShortcut(key('f')),'fire');assert.equal(tacticalShortcut(key('g')),'move');
 assert.match(TACTICAL_KEYS.find(([keys])=>keys==='G / F / A')[1],/disparo deliberado/);
 assert.match(TACTICAL_KEYS.find(([keys])=>keys==='B')[1],/ya fijada/);
 assert.ok(!TACTICAL_KEYS.some(([,label])=>label.includes('Calar')));
});
test('focused controls retain native activation while letter shortcuts remain available',()=>{
 assert.equal(tacticalShortcut(key(' '),{nativeControl:true}),null);
 assert.equal(tacticalShortcut(key('Enter'),{nativeControl:true}),null);
 assert.equal(tacticalShortcut(key('z'),{nativeControl:true}),'stealth');
 assert.equal(tacticalShortcut(key('d'),{nativeControl:true}),'turn');
 assert.equal(tacticalShortcut(key('z'),{nativeControl:true,editing:true}),null);
});

test('Alt ground movement is transient and leaves browser chords and Shift group selection distinct',()=>{
 assert.equal(pointerMovementIntent({altKey:true}),'preserveFacing');
 assert.equal(pointerMovementIntent({altKey:true,shiftKey:true}),'preserveFacing');
 assert.equal(pointerMovementIntent({shiftKey:true}),'forward');
 for(const extra of [{ctrlKey:true},{metaKey:true}])assert.equal(pointerMovementIntent({altKey:true,...extra}),'forward');
 assert.equal(pointerMovementIntent({altKey:false}),'forward');
 assert.equal(tacticalShortcut(key('r',{altKey:true})),'reload');
 assert.match(TACTICAL_KEYS.find(([keys])=>keys==='Alt+clic en suelo libre')[1],/solo al seleccionado sin girar/);
});
