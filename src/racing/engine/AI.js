import * as THREE from "three";
import { CarPhysics } from "./Car.js";

// AI cars now run on the exact same CarPhysics force/mass/friction model
// the player uses - the "driver" here just generates steering/throttle/
// brake input from a lookahead point on the track (and a bit of upcoming-
// curvature braking) instead of reading the keyboard. That means AI cars
// can genuinely slide, lose grip, and get knocked around by a real
// collision impulse exactly like the player does, rather than teleporting
// along the centerline immune to physics.
// Racing-line speed plan, computed once per track and shared by every AI.
// For each point on the circuit it works out the fastest speed the tires can
// actually hold through the local corner (using the REAL grip + downforce
// numbers from CarPhysics), then walks backwards around the lap so the car
// starts braking early enough to hit each corner speed. The result is a
// deterministic "how fast should I be going right here" value - no random
// wandering and no late panic braking - which is what makes the AI both
// consistent over the whole lap and genuinely fast.
const _profileCache=new WeakMap();
function speedProfile(track,phys){
  if(_profileCache.has(track))return _profileCache.get(track);
  const n=track.samples.length,S=track.samples;
  const ds=track.length/n;
  const ang=new Float32Array(n);
  for(let i=0;i<n;i++){
    const a=S[i],b=S[(i+1)%n];
    ang[i]=Math.atan2(b.x-a.x,b.z-a.z);
  }
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const curv=new Float32Array(n);
  const W=3; // curvature measured over +-3 samples (~30m) so noise can't fake a corner
  for(let i=0;i<n;i++){
    const d=wrap(ang[(i+W)%n]-ang[(i-W+n)%n]);
    curv[i]=Math.abs(d)/(2*W*ds);
  }
  // Use only part of the available grip when planning corner speeds: the
  // tires also have to cope with steering transitions, bumps and the
  // occasional nudge from another car, so a real driver never plans a
  // corner at the absolute edge of adhesion.
  const GRIP_USE=0.5;
  const G=phys.maxGripForce*GRIP_USE/phys.mass,K=phys.downforce*GRIP_USE/phys.mass;
  const VMAX=phys.topSpeedRef*.98;
  const v=new Float32Array(n);
  for(let i=0;i<n;i++){
    const k=Math.max(curv[i],1e-5);
    // v^2/r = G + K*v^2  ->  v = sqrt(G / (k - K)) when k > K, else unlimited
    const denom=k-K;
    v[i]=denom>1e-6?Math.min(VMAX,Math.sqrt(G/denom)):VMAX;
  }
  // Backward pass (twice around so the loop seam is handled): you can only
  // arrive at a corner as fast as you can still brake down for it.
  const aBrake=12; // m/s^2, comfortably under the real brake force
  for(let pass=0;pass<2;pass++){
    for(let i=n*2-1;i>=0;i--){
      const a=i%n,b=(i+1)%n;
      const lim=Math.sqrt(v[b]*v[b]+2*aBrake*ds);
      if(lim<v[a])v[a]=lim;
    }
  }
  const out={v,ds,n};
  _profileCache.set(track,out);
  return out;
}

export class AIController{
  constructor(mesh,track,gridIndex){
    this.mesh=mesh;this.track=track;this.gridIndex=gridIndex;
    this.seed=gridIndex*37+7;this.ready=false;
    this.physics=new CarPhysics(mesh,track);
    // A flat centerline-follow at ~45 was a non-issue once the starting-
    // grid distance bug was fixed - the player's real top speed comfortably
    // beat it. This pace target needs genuinely good driving to beat.
    // Deterministic per-car character (NOT random wandering): how close to the
    // grip limit this driver is willing to push, and which part of the road
    // they prefer. Skill 0.90-1.0 keeps the field varied but every car is
    // fast; lane offset spreads the pack so they don't all stack on one line.
    this.skill=.90+((this.seed%7)/6)*.10;
    this.laneOffset=(((this.seed*13)%7)-3)*.9; // metres, -2.7..+2.7
    this.profile=speedProfile(track,this.physics);
    this._steerState=0;
    this._recovering=false; // hysteresis state, see update()
    this._stuckTimer=0;
    this._lastProgressCheck=0;
    this._progressAtLastCheck=0;
    this._unstuckHold=0;
  }
  init(){ this.reset(); this.ready=true; }
  reset(){
    this.physics.reset(this.gridIndex);
    this._steerState=0;
    this._recovering=false;
    this._stuckTimer=0;
    this._lastProgressCheck=0;
    this._progressAtLastCheck=this.physics.distance;
    this._unstuckHold=0;
    this._hardStuckTimer=0;
  }
  // Delegated so collisions can treat AI exactly like the player - a real
  // impulse exchanged with whichever car (or AI) it hit, not a scripted
  // knockback.
  applyImpulse(normal,otherVel,otherMass,restitution){
    this.physics.applyImpulse(normal,otherVel,otherMass,restitution);
  }
  get vel(){return this.physics.vel;}
  get mass(){return this.physics.mass;}
  get distance(){return this.physics.distance;}
  get lap(){return this.physics.lap;}
  get progress(){return this.physics.progress;}
  get speed(){return this.physics.speed;}
  get lateralSlip(){return this.physics.lateralSlip;}
  get braking(){return this.physics.braking;}

  curvatureAhead(d){
    const eps=3/this.track.samples.length;
    const t=this.physics.trackPos+d;
    const a=this.track.tangent(t-eps),b=this.track.tangent(t+eps);
    const ang=Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z);
    return Math.abs(ang/(2*eps*this.track.length));
  }

  update(dt){
    if(!this.ready)return;
    const p=this.physics;

    // Safety net: if genuine progress has stalled for a few seconds -
    // whatever the cause (a bad spin, a collision pileup, an unlucky spot
    // on the track), a real driver doesn't sit there forever fighting it.
    // They eventually just aim at the road right in front of them and go,
    // rather than a lookahead point far down the track that may demand a
    // big detour they can't currently make. This never teleports the car -
    // it only changes what the driver is steering toward.
    this._lastProgressCheck+=dt;
    if(this._lastProgressCheck>3){
      const gained=Math.abs(p.distance-this._progressAtLastCheck)*this.track.length;
      this._stuckTimer=gained<12?this._stuckTimer+this._lastProgressCheck:0;
      this._progressAtLastCheck=p.distance;
      this._lastProgressCheck=0;
    }
    // Once triggered, commit to the escape for a real stretch of time
    // rather than bailing the instant a single check window shows any
    // progress at all - a small partial gain right at the edge of the
    // trouble spot isn't the same as actually being clear of it, and
    // bailing out too early was letting the car get dragged straight
    // back into the same trap over and over.
    if(this._stuckTimer>3)this._unstuckHold=9;
    if(this._unstuckHold>0)this._unstuckHold=Math.max(0,this._unstuckHold-dt);
    const unstuck=this._unstuckHold>0;
    if(unstuck)this._stuckTimer=0;
    this._hardStuckTimer=(this._stuckTimer>0||unstuck)?(this._hardStuckTimer||0)+dt:0;
    if(this._hardStuckTimer>16){
      // Absolute last resort: real progress has been stuck for a very
      // long time despite the graceful recovery above. Rather than leave
      // the car permanently deadlocked, forcefully realign it to the road
      // - like a driver doing a three-point turn to get going again, not
      // a teleport: position is untouched, only heading and velocity are
      // reset to point the right way down the track it's already on.
      const tan=this.track.tangent(p.progress);
      p.yaw=Math.atan2(tan.x,tan.z);
      p.angularVel=0;
      p.vel.copy(tan).multiplyScalar(14);
      this._hardStuckTimer=0;this._unstuckHold=0;this._stuckTimer=0;
    }

    // --- Where am I, and where should I aim? -----------------------------
    // Uses the car's exact position on the circuit (p.trackPos), never a
    // drifting integrated estimate, so the aim point is always genuinely
    // AHEAD of the car along the road.
    const pos=p.trackPos;
    const speed=Math.max(p.speed,6);
    const lookMeters=unstuck?10:THREE.MathUtils.clamp(8+speed*.55,14,70);
    const aimT=pos+lookMeters/this.track.length;
    const target=this.track.point(aimT);
    const tan=this.track.tangent(aimT);
    // Shift the aim point sideways for this driver's preferred lane, easing
    // it back to the centre in tight sections so the offset never costs time.
    const side=new THREE.Vector3(-tan.z,0,tan.x);
    const aimK=this.curvatureAhead(lookMeters/this.track.length);
    const laneFade=THREE.MathUtils.clamp(1-aimK*120,0,1);
    target.addScaledVector(side,this.laneOffset*laneFade);
    const dx=target.x-p.mesh.position.x,dz=target.z-p.mesh.position.z;
    const desiredYaw=Math.atan2(dx,dz);
    let diff=desiredYaw-p.yaw;
    diff=Math.atan2(Math.sin(diff),Math.cos(diff));

    // --- How fast should I be going here? ----------------------------------
    // Look up the precomputed racing-line speed plan a little ahead of the
    // car (about one reaction-time of travel) and take the lowest value in
    // that span, so braking begins on time and is never a late surprise.
    const prof=this.profile;
    const idx0=Math.floor(pos*prof.n);
    const span=Math.max(2,Math.ceil((speed*.35)/prof.ds));
    let planned=Infinity;
    for(let k=0;k<=span;k++)planned=Math.min(planned,prof.v[(idx0+k)%prof.n]);
    const targetSpeed=planned*this.skill;

    // Hysteresis: only treat the car as "badly aimed" at a big heading
    // error, and only clear it once well below that, so it can't flicker.
    if(!this._recovering&&Math.abs(diff)>1.3)this._recovering=true;
    else if(this._recovering&&Math.abs(diff)<.4)this._recovering=false;
    const recovering=this._recovering&&!unstuck;

    // If the car is already sliding, more steering lock just makes it
    // worse - back off the steering and the throttle and let the tires
    // regrip (this breaks the diff -> steer -> slip -> diff feedback loop).
    const slip=Math.abs(p.lateralSlip);
    const slipEase=THREE.MathUtils.clamp(1-slip/9,.25,1);

    // Steering authority fades with speed in CarPhysics, so the gain must
    // not be a fixed number or the car would be twitchy at 300 km/h.
    const gain=THREE.MathUtils.clamp(2.4*(1-Math.min(speed,90)/90*.45),1.3,2.4);
    // Cross-track correction: pure "aim at a point ahead" steering leaves a
    // steady sideways offset on long fast curves (the car drifts a few
    // metres wide at 250+ km/h without ever "feeling" wrong). Feed the real
    // sideways error from the racing line back into the steering so the
    // car holds its line at any speed.
    const cNow=this.track.point(pos),tNow=this.track.tangent(pos);
    const sideNow=new THREE.Vector3(-tNow.z,0,tNow.x);
    const xErr=(p.mesh.position.x-cNow.x)*sideNow.x+(p.mesh.position.z-cNow.z)*sideNow.z-this.laneOffset*laneFade;
    const xCorr=THREE.MathUtils.clamp(xErr*.045,-.4,.4);
    const input={
      steer:THREE.MathUtils.clamp((diff*gain-p.angularVel*.6+xCorr)*slipEase,-1,1),
      gas:unstuck?Math.abs(diff)<.9:!recovering&&slip<6&&p.speed<targetSpeed,
      brake:!unstuck&&(recovering||p.speed>targetSpeed+2.5||slip>7),
      boost:false,handbrake:false,
    };
    p.update(dt,input);
  }
}
