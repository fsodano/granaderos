import {campaignCharacterPortrait,NEUTRAL_CHARACTER_PORTRAIT} from '../../game/campaign-portraits.js';
import {campaignDefinitions} from '../../game/campaign-definition.js';
import {DEFAULT_CONTENT} from '../../campaigns/default.js';
import stockAssets from '../../campaigns/granaderos/assets.json' with {type:'json'};
import {isContentImageReference} from '../../game/campaign-assets.js';

export function portraitFor(id:number|string,context:any=null):string|null {
 if(id===NEUTRAL_CHARACTER_PORTRAIT.src)return id;
 if(isContentImageReference(id)){const path=String(id),legacy=path.startsWith('/art/')?stockAssets.assets.find(asset=>asset.path===`assets/${path.slice(5)}`):null;return legacy?`/campaigns/granaderos/${legacy.path}`:path;}
 const portrait=campaignCharacterPortrait(String(id),context);
 if(portrait)return portrait.src;
 const content=campaignDefinitions(context),value=Number(id),characters=content?.characters??DEFAULT_CONTENT.characters,character=characters.find((character:any)=>character.id===`person-${value}`);
 if((content?.scenario==='generic-v1'||content?.campaignStory)&&!character)return null;
 return character?.portrait??null;
}
