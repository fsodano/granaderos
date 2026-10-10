/** Select the nearest shared cell boundary in the editor's isometric view. */
export function isometricWallEdge(client,box,camera,origin,bounds){
 if(client.x<box.left||client.y<box.top||client.x>box.left+box.width||client.y>box.top+box.height)return null;
 const scale=Math.min(box.width/camera.width,box.height/camera.height),offsetX=(box.width-camera.width*scale)/2,offsetY=(box.height-camera.height*scale)/2;
 const sx=(client.x-box.left-offsetX)/scale+camera.x-origin.x,sy=(client.y-box.top-offsetY)/scale+camera.y-origin.y;
 const x=(sx/26+sy/14)/2,y=(sy/14-sx/26)/2,vx=Math.round(x+.5),vy=Math.round(y+.5);
 const edge=Math.abs(y-(vy-.5))<=Math.abs(x-(vx-.5))?{x:Math.round(x),y:vy,axis:'x'}:{x:vx,y:Math.round(y),axis:'y'};
 return edge.axis==='x'?edge.x>=0&&edge.x<bounds.width&&edge.y>=0&&edge.y<=bounds.height?edge:null:edge.x>=0&&edge.x<=bounds.width&&edge.y>=0&&edge.y<bounds.height?edge:null;
}
