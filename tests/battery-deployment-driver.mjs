import assert from 'node:assert/strict';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';

// Use only the legal arrival model. Keep the gun crew together while placing
// the infantry on both flanks; no opposing coordinates enter this decision.
export function deployBatteryFlanks(start){
 let b=start;const model=sectorDeploymentModel(b);assert.ok(model);
 const crew=model.units.filter(u=>['1000','139'].includes(u.id)),infantry=model.units.filter(u=>!['1000','139'].includes(u.id));
 for(const [i,u]of [...crew,...infantry].entries()){
  const cells=model.entryCells[u.edge].slice().sort((a,b)=>['N','S'].includes(u.edge)?a.x-b.x:a.y-b.y);
  const fraction=i<crew.length?.5:(i-crew.length+.5)/infantry.length;
  const p=cells[Math.min(cells.length-1,Math.floor(cells.length*fraction))];
  b=sectorDeploymentAction(b,{type:'placeDeployment',unitIds:[u.id],x:p.x,y:p.y});assert.equal(b.lastError,null,b.lastError);
 }
 b=sectorDeploymentAction(b,{type:'confirmDeployment'});assert.equal(b.lastError,null,b.lastError);return b;
}
