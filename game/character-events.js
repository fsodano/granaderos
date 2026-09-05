import {speechFor} from './characters.js';
import {visibleEnemies} from './tactical.js';

// Presentation events follow authoritative state transitions; no extra game state
// or random rolls are introduced by a character's spoken response.
export function characterEventLines(before,after){
 if(!before||!after||after.lastError)return [];
 const events=[];
 for(const unit of after.units.filter(u=>u.side==='player')){
  const old=before.units.find(u=>u.id===unit.id);if(!old)continue;
  const event=old.hp>0&&unit.hp<=0?'death':!old.unconscious&&unit.unconscious?'exhausted':unit.hp<old.hp?'wounded':null;
  if(event)events.push({unit,event});
 }
 const speaker=after.units.find(u=>u.side==='player'&&u.hp>0&&!u.unconscious&&!u.routed);
 if(speaker){if(!before.sectorCleared&&after.sectorCleared)events.push({unit:speaker,event:'cleared'});
 else if(!visibleEnemies(before).length&&visibleEnemies(after).length)events.push({unit:speaker,event:'contact'});}
 return events.slice(0,3).map(({unit,event})=>`${unit.nickname||unit.name}: «${speechFor(unit,event)}»`);
}
export function withCharacterSpeech(before,after){
 const lines=characterEventLines(before,after);
 return lines.length?{...after,log:[...after.log,...lines].slice(-80)}:after;
}
