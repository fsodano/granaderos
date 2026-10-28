// This is an event-time public record, not a projection of the legacy log.
// Callers must admit the observation before writing names or outcomes. Never
// reconstruct earlier entries from log strings or from later visibility.
export const COMBAT_JOURNAL_LIMIT=80;
const validEntry=(entry,turn)=>entry&&typeof entry==='object'&&!Array.isArray(entry)&&
 Object.keys(entry).every(key=>['turn','text'].includes(key))&&Number.isInteger(entry.turn)&&entry.turn>=1&&entry.turn<=turn&&
 typeof entry.text==='string'&&entry.text.length>0&&entry.text.length<=1000;

export function validCombatJournal(journal,turn){
 return journal===undefined||Boolean(journal&&typeof journal==='object'&&!Array.isArray(journal)&&
  Object.keys(journal).every(key=>['version','entries'].includes(key))&&journal.version===1&&
  Array.isArray(journal.entries)&&journal.entries.length<=COMBAT_JOURNAL_LIMIT&&journal.entries.every(entry=>validEntry(entry,turn)));
}

/** Copy certified stored entries without rewriting historical presentation. */
export function storedCombatJournal(state){
 const journal=state?.publicJournal;
 return journal&&validCombatJournal(journal,state.turn)?journal.entries.map(({turn,text})=>({turn,text})):[];
}

/** Read the same certified entries for the visible journal and WebMCP. */
export function publicCombatJournal(state){
 // Older partial wound steps recorded a loss even when no full tick elapsed.
 // Hide only that false report; stored entries remain intact for later writes.
 return storedCombatJournal(state).filter(entry=>!/^.+ pierde 0 de salud por hemorragia\.$/.test(entry.text));
}

/** Mutates presentation metadata only; the admission belongs to the caller. */
export function recordPublicCombatMessage(state,text){
 const entries=storedCombatJournal(state);
 const entry={turn:state.turn,text};
 if(!validEntry(entry,state.turn))return;
 state.publicJournal={version:1,entries:[...entries,entry].slice(-COMBAT_JOURNAL_LIMIT)};
}
