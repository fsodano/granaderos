export const SPEECH_LINE_LIMIT = 800;
export const SPEECH_EVENTS = Object.freeze([
  'hired',
  'contact',
  'cleared',
  'wounded',
  'exhausted',
  'death',
  'ending',
]);
export const OPTIONAL_SPEECH_EVENTS = Object.freeze(['treated', 'near', 'interrupt']);
export const AUTHORABLE_SPEECH_EVENTS = Object.freeze([
  ...SPEECH_EVENTS,
  ...OPTIONAL_SPEECH_EVENTS,
]);
