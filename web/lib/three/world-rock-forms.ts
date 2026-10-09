import {IcosahedronGeometry} from 'three';

// The original twelve corners keep their connectivity. Four upper corners
// form a broad broken cap; unequal shoulders interrupt the symmetric outline.
// Coordinates use the original axis extent; all six bounds remain exact.
const forms:readonly (readonly (readonly number[])[])[]=[
  [[-.68,1,-.14],[.45,1,.18],[-.57,-1,-.10],[.39,-1,.09],[0,1,1],[0,1,-1],[.09,-.65,.72],[-.12,-.58,-.78],[1,.27,.58],[1,-.16,-.60],[-1,-.08,.60],[-1,.18,-.55]],
  [[-.48,1,.14],[.70,1,-.05],[-.44,-1,.16],[.55,-1,-.10],[0,1,1],[0,.84,-1],[-.18,-.56,.78],[.05,-.70,-.65],[1,-.18,.60],[1,.28,-.54],[-1,.24,.54],[-1,-.10,-.58]],
  [[-.39,1,-.16],[.66,1,.11],[-.63,-1,-.09],[.44,-1,.18],[0,1,1],[0,.92,-1],[.15,-.72,.65],[-.11,-.54,-.82],[1,.10,.60],[1,-.22,-.59],[-1,-.18,.57],[-1,.30,-.60]],
];
export const ROCK_FORM_COUNT=forms.length;
export function rockForm(variant:number){
  const form=forms[variant];if(!form)throw Error(`Unknown rock form ${variant}`);
  const geometry=new IcosahedronGeometry(1,0),position=geometry.getAttribute('position');
  const extent=Math.max(...position.array);
  for(let n=0;n<position.count;n++){
    const x=position.getX(n),y=position.getY(n),z=position.getZ(n);
    const corner=z===0?(y>0?(x<0?0:1):(x<0?2:3)):x===0?(y>0?(z>0?4:5):(z>0?6:7)):(x>0?(z>0?8:9):(z>0?10:11));
    const point=form[corner];position.setXYZ(n,point[0]*extent,point[1]*extent,point[2]*extent);
  }
  geometry.computeVertexNormals();return geometry;
}
