import type {CampaignEditorProject} from './campaign-studio-files';
export type StudioHistory={past:CampaignEditorProject[];current:CampaignEditorProject|null;future:CampaignEditorProject[]};
export const emptyStudioHistory=():StudioHistory=>({past:[],current:null,future:[]});
/** Project panels write immutable documents; snapshots retain their resource bytes. */
export function changeStudioProject(history:StudioHistory,project:CampaignEditorProject):StudioHistory{
 if(history.current===project)return history;
 return {past:history.current?[...history.past,history.current].slice(-50):[],current:project,future:[]};
}
export function undoStudioProject(history:StudioHistory):StudioHistory{
 if(!history.current||!history.past.length)return history;
 return {past:history.past.slice(0,-1),current:history.past.at(-1)!,future:[history.current,...history.future].slice(0,50)};
}
export function redoStudioProject(history:StudioHistory):StudioHistory{
 if(!history.current||!history.future.length)return history;
 return {past:[...history.past,history.current].slice(-50),current:history.future[0],future:history.future.slice(1)};
}
