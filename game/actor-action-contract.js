/** Presentation capabilities. These names never issue orders or change rules. */
export const ACTOR_ACTION_CONTRACT_VERSION = 1;
export const ACTOR_EQUIPMENT = Object.freeze(['unarmed','long-gun','short-gun','blade']);
export const ACTOR_POSTURES = Object.freeze(['standing','crouched','prone','mounted']);
const prefix = {standing:'stand',crouched:'crouch',prone:'prone',mounted:'mounted'};
const entries = [];
const clips = new Map();
function add(action, posture, equipment, gesture=action, options={}) {
  const clip = options.clip ?? `${prefix[posture]}.${gesture}.${equipment}`;
  const entry = Object.freeze({action,posture,equipment,clip,...options});
  entries.push(entry);
  if(!clips.has(clip))clips.set(clip,Object.freeze({name:clip,gesture,posture,equipment,loop:false,...options}));
}
for(const posture of ACTOR_POSTURES)for(const equipment of ACTOR_EQUIPMENT){
  add('idle',posture,equipment,'idle',{loop:true});
  add(posture==='prone'?'crawl':'walk',posture,equipment,posture==='prone'?'crawl':'walk',{loop:true});
  if(posture==='standing'||posture==='mounted')add('run',posture,equipment,'run',{loop:true});
  if(equipment==='long-gun'||equipment==='short-gun')for(const action of ['aim','fire','reload','reprime','repair','unload'])
    add(action,posture,equipment,action,{loop:action==='aim'});
  if(posture!=='prone'){
    add('strike',posture,equipment,equipment==='unarmed'?'punch':equipment==='blade'?'slash':'butt');
    if(equipment==='long-gun'){
      add('bayonet',posture,equipment,'bayonet');
      add('brace',posture,equipment,'brace',{loop:true});
    }
  }
}
// Sharing is explicit and limited to the same visible hand gesture.
const interactionGestures = {
  heal:'heal',loot:'pickup',pickup:'pickup',containerLoot:'pickup',
  equip:'equip',weapon:'equip',equipLoot:'equip',
  drop:'offer',transfer:'offer',giveItem:'offer',
  steal:'grab',door:'door',environment:'tool',breach:'breach',
  free:'free',ration:'ration',prisonerEscort:'signal',
  fitBayonet:'fitting',removeBayonet:'fitting',attachment:'fitting',
  throwTorch:'throw',boleadoras:'bolas',
};
for(const posture of ACTOR_POSTURES)for(const [action,gesture] of Object.entries(interactionGestures))
  add(action,posture,'any',gesture,{clip:`${prefix[posture]}.gesture.${gesture}`});
// Grenades and knives have paid standing preparation and cannot be thrown mounted.
add('throwGrenade','standing','any','throw',{clip:'stand.gesture.throw'});
add('throwKnife','standing','any','throwKnife',{clip:'stand.gesture.throwKnife'});
for(const [from,to] of [['standing','crouched'],['crouched','standing'],['standing','prone'],['prone','standing'],['crouched','prone'],['prone','crouched']])
  add(`stance:${from}:${to}`,from,'any','transition',{clip:`transition.${prefix[from]}.${prefix[to]}`,fromPosture:from,toPosture:to});
for(const action of ['climbUp','climbDown','mount'])
  add(action,'standing','any',action,{clip:`life.${action}`});
add('dismount','mounted','any','dismount',{clip:'life.dismount'});
for(const posture of ACTOR_POSTURES)for(const action of ['die','collapse','dead','unconscious','recover','hit','knockdown'])
  add(action,posture,'any',action,{clip:`life.${prefix[posture]}.${action}`,loop:action==='dead'||action==='unconscious'});
for(const action of ['artilleryFire','artilleryReload','artilleryMove','artilleryPivot'])
  add(action,'standing','any',action,{clip:`crew.${action}`,loop:action==='artilleryMove'});

export const ACTOR_ACTION_CAPABILITIES = Object.freeze(entries);
export const ACTOR_CLIP_SPECS = Object.freeze([...clips.values()]);
const keyed = new Map(entries.map(entry=>[`${entry.action}|${entry.posture}|${entry.equipment}`,entry]));

export function actorActionKey({action,posture='standing',mounted=false,equipment='unarmed'}){
  return `${action}|${mounted?'mounted':posture}|${equipment}`;
}

/** Resolve only supported requests; impossible combinations are not idle. */
export function resolveActorAction(request){
  const posture=request.mounted?'mounted':request.posture??'standing';
  const equipment=request.equipment??'unarmed';
  return keyed.get(`${request.action}|${posture}|${equipment}`)??keyed.get(`${request.action}|${posture}|any`)??null;
}

/** Check exported data rather than trusting an asserted capabilities list. */
export function validateActorActionCapabilities(manifest,{required=ACTOR_CLIP_SPECS}={}){
  const errors=[],available=new Map();
  for(const clip of manifest?.clips??[]){
    if(available.has(clip.name))errors.push(`Duplicate clip: ${clip.name}`);
    available.set(clip.name,clip);
  }
  for(const spec of required){
    const clip=available.get(spec.name);
    if(!clip){errors.push(`Missing clip: ${spec.name}`);continue;}
    const duration=clip.durationSeconds??clip.duration;
    if(!(Number.isFinite(duration)&&duration>0))errors.push(`Invalid duration: ${spec.name}`);
    if(Boolean(clip.loop)!==Boolean(spec.loop))errors.push(`Wrong loop mode: ${spec.name}`);
    for(const [event,time] of Object.entries(clip.markers??clip.events??{}))
      if(!Number.isFinite(time)||time<0||time>duration)errors.push(`Invalid ${event} marker: ${spec.name}`);
    const marker=spec.gesture==='fire'||spec.gesture==='artilleryFire'?'shot':
      ['slash','punch','butt','bayonet','breach'].includes(spec.gesture)?'contact':
      ['throw','throwKnife','bolas'].includes(spec.gesture)?'release':null;
    if(marker&&!Number.isFinite((clip.markers??clip.events)?.[marker]))errors.push(`Missing ${marker} marker: ${spec.name}`);
    if(['walk','run','crawl'].includes(spec.gesture)&&!(clip.locomotionSpeed>0))errors.push(`Missing stride speed: ${spec.name}`);
  }
  return errors;
}
