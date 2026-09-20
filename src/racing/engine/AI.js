import * as THREE from "three";

export class AIController{
  constructor(mesh,track,gridIndex){
    this.mesh=mesh;this.track=track;this.gridIndex=gridIndex;this.progress=0;this.lap=1;this.distance=0;this.speed=0;this.seed=gridIndex*37+7;this.ready=false;
    // A flat ~45 pace made the AI a non-issue once the starting-grid
    // distance bug was fixed (the player's 78 top speed on straights,
    // even accounting for braking through corners, comfortably beat it).
    // ~58 average, spread across the grid, needs real pace to beat.
    this.baseSpeed=58+((this.seed%9)-4)*1.4;
    this.knockback=new THREE.Vector3();
    this.spinTimer=0;
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
    this.knockback.set(0,0,0);this.spinTimer=0;
    const p=this.track.point(raw),tan=this.track.tangent(raw);
    this.mesh.position.copy(p);this.mesh.position.y+=.65;this.mesh.rotation.y=Math.atan2(tan.x,tan.z);
  }
  // Called on a collision (player or another AI car): knocks this car
  // sideways and makes it visibly lose control for a moment instead of
  // serenely continuing along the centerline as if nothing happened.
  hit(pushDir,strength){
    this.knockback.addScaledVector(pushDir,strength);
    this.spinTimer=Math.max(this.spinTimer,.7);
  }
  update(dt){
    if(!this.ready)return;
    if(this.spinTimer>0)this.spinTimer=Math.max(0,this.spinTimer-dt);
    const spinFactor=this.spinTimer>0?.35:1;
    this.speed=THREE.MathUtils.lerp(this.speed,this.baseSpeed*spinFactor,dt*1.8);
    this.progress+=Math.max(this.speed,0)/this.track.length*dt;
    if(this.progress>=1){this.progress-=1;this.lap++}
    this.distance=(this.lap-1)+this.progress;
    const p=this.track.point(this.progress),tan=this.track.tangent(this.progress);
    this.mesh.position.copy(p);this.mesh.position.y+=.65;
    // Knockback decays back toward the racing line rather than snapping -
    // reads as the car catching itself after being shoved, not teleporting.
    this.knockback.multiplyScalar(Math.max(0,1-4.5*dt));
    this.mesh.position.add(this.knockback);
    const baseYaw=Math.atan2(tan.x,tan.z);
    const wobble=this.spinTimer>0?Math.sin(this.spinTimer*38)*this.spinTimer*.85:0;
    this.mesh.rotation.y=baseYaw+wobble;
    this.mesh.userData.distance=this.distance;this.mesh.userData.progress=this.progress;this.mesh.userData.lap=this.lap;
  }
}
