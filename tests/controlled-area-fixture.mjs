// Explicit established-territory fixture for subsystem tests, never a fresh
// campaign acceptance path. This changes no money, personnel or battle result.
export function secureArea(state,...sectors){
 for(const id of sectors)Object.assign(state.sectors[id],{owner:'patriot',loyalty:65});
 return state;
}
