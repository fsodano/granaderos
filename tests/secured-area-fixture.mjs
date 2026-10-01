// Subsystem scenarios that start after the southern towns have been secured.
// This is explicit test setup, never the new-player campaign constructor.
export function secureArea(state,ids=['buenos_aires','ensenada']){
 for(const id of ids)Object.assign(state.sectors[id],{owner:'patriot',loyalty:65});
 return state;
}
