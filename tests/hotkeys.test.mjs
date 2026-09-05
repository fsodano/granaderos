import test from 'node:test';
import assert from 'node:assert/strict';
import {tacticalShortcut,TACTICAL_KEYS} from '../game/hotkeys.js';
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
 const actions={'1':'select:0','6':'select:5',' ':'next',PageUp:'stance-up',PageDown:'stance-down',w:'weapon',b:'brace',o:'overwatch',t:'mount',i:'loot',q:'heal',v:'sight',']':'aim-up','[':'aim-down','+':'zoom-in','-':'zoom-out',h:'help',Escape:'cancel'};
 for(const [keyName,action] of Object.entries(actions))assert.equal(tacticalShortcut(key(keyName)),action);
 assert.equal(tacticalShortcut(key('?',{shiftKey:true})),'help');assert.equal(tacticalShortcut(key('x')),null);assert.ok(TACTICAL_KEYS.length>=15);
});
test('focused controls retain native activation while letter shortcuts remain available',()=>{
 assert.equal(tacticalShortcut(key(' '),{nativeControl:true}),null);
 assert.equal(tacticalShortcut(key('Enter'),{nativeControl:true}),null);
 assert.equal(tacticalShortcut(key('z'),{nativeControl:true}),'sneak');
 assert.equal(tacticalShortcut(key('d'),{nativeControl:true}),'turn');
 assert.equal(tacticalShortcut(key('z'),{nativeControl:true,editing:true}),null);
});
