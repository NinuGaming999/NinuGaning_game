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
    // The car's spatial grid slot needs to wrap negative offsets around to
    // "just behind the start line" (t just under 1). But distance/placement
    // bookkeeping must NOT treat that wrapped value as real progress - doing
    // so credited 4 of the 5 AI cars with ~98-99% of a lap before the race
    // even began (this.distance was set from the wrapped t, not the real
    // signed offset), which is why the player was consistently placed last
    // no matter how they drove. Keep `progress` unwrapped (it can start
    // slightly negative) and let it climb through 0 naturally; track.point()/
    // tangent() already wrap negative t correctly for the actual 3D position.
    const raw=.008-this.gridIndex*.005;
    this.progress=raw;this.lap=1;this.distance=raw;this.speed=0;
    const p=this.track.point(raw),tan=this.track.tangent(raw);
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
