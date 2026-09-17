import * as THREE from "three";

export class AIController{
  constructor(mesh,track,gridIndex){
    this.mesh=mesh;this.track=track;this.gridIndex=gridIndex;this.progress=0;this.lap=1;this.distance=0;this.speed=0;this.seed=gridIndex*37+7;this.ready=false;
  }
  init(){
    this.reset();
    this.ready=true;
  }
  reset(){
    const t=(.008-this.gridIndex*.005+1)%1;
    this.progress=t;this.lap=1;this.distance=t;this.speed=0;
    const p=this.track.point(t),tan=this.track.tangent(t);
    this.mesh.position.copy(p);this.mesh.position.y+=.65;this.mesh.rotation.y=Math.atan2(tan.x,tan.z);
  }
  update(dt){
    if(!this.ready)return;
    this.speed=THREE.MathUtils.lerp(this.speed,45+((this.seed%9)-4)*.8,dt*1.8);
    this.progress+=Math.max(this.speed,0)/this.track.length*dt;
    if(this.progress>=1){this.progress-=1;this.lap++}
    this.distance=(this.lap-1)+this.progress;
    const p=this.track.point(this.progress),tan=this.track.tangent(this.progress);
    this.mesh.position.copy(p);this.mesh.position.y+=.65;this.mesh.rotation.y=Math.atan2(tan.x,tan.z);
    this.mesh.userData.distance=this.distance;this.mesh.userData.progress=this.progress;this.mesh.userData.lap=this.lap;
  }
}
