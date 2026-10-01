import fs from 'node:fs/promises';
const measurements=JSON.parse(await fs.readFile('assets/previews/sprite-consistency/measurements.json'));
const families=['granadero','royalist','worker','surgeon','gaucho','friar','woman-scout','woman-shawl'];
const directions=['n','ne','e','se','s','sw','w','nw'];
const table={};
for(const family of families){
 table[family+'-walk']=directions.map(direction=>{
  const idle=measurements.find(r=>r.sheet===family+'-idle'&&r.direction===direction);
  const frames=measurements.filter(r=>r.sheet===family+'-walk'&&r.direction===direction);
  const height=idle.height/Math.max(...frames.map(r=>r.height));
  const widths=frames.map(r=>r.midBodyPixels).sort((a,b)=>a-b),width=idle.midBodyPixels/((widths[1]+widths[2])/2);
  return [Number(Math.max(.85,Math.min(1.15,width)).toFixed(4)),Number(height.toFixed(4))];
 });
}
await fs.writeFile('game/sprite-display-calibration.js','// Direction-specific walking display scale relative to approved idle.\n// One transform per directional cycle preserves gait motion and ground anchors.\nexport const SPRITE_DISPLAY_CALIBRATION='+JSON.stringify(table,null,2)+';\n');
