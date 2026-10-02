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
  const GRIP_USE=0.85;
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

// Mild catch-up for AIs far behind the human (and an easing for a runaway AI
// leader). Set false for a pure, unassisted race.
const RUBBER_BAND=true;

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
    this.skill=.955+((this.seed%7)/6)*.045; // 95.5%-100% of the racing-line plan: close pace so the field actually fights
    this.laneOffset=(((this.seed*13)%7)-3)*.9; // metres, -2.7..+2.7
    this.profile=speedProfile(track,this.physics);
    this._lane=this.laneOffset; // where on the road (metres from centre, + = right) this car is currently aiming
    this._passOp=null;this._passLane=0;this._passT=0;this._passCool=0;
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
    this._lane=this.laneOffset;this._passOp=null;this._passCool=0;
  }
  // Delegated so collisions can treat AI exactly like the player - a real
  // impulse exchanged with whichever car (or AI) it hit, not a scripted
  // knockback.
  applyImpulse(normal,otherVel,otherMass,restitution){
    this.physics.applyImpulse(normal,otherVel,otherMass,restitution);
  }
  get trackPos(){return this.physics.trackPos;}
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

  // `field` = every car on the track (the human player first, then the AIs,
  // as CarPhysics objects). The driver uses it to see who is ahead, who is
  // alongside, and who is the human - so it can follow, pass, defend its
  // space and never just ram the car in front.
  update(dt,field=[]){
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

    // --- Where am I on the road, and who is around me? --------------------
    const L=this.track.length;
    const pos=p.trackPos;
    const speed=Math.max(p.speed,6);
    const tanNow=this.track.tangent(pos);
    const sideNow=new THREE.Vector3(-tanNow.z,0,tanNow.x); // right-hand side of travel
    const cNow=this.track.point(pos);
    const myLat=(p.mesh.position.x-cNow.x)*sideNow.x+(p.mesh.position.z-cNow.z)*sideNow.z;

    let blocker=null;const alongside=[];let passInfo=null;let aheadAny=1e9; // nearest car ahead, any distance up to 260m
    for(const o of field){
      const op=o&&(o.physics||o);
      if(!op||op===p)continue;
      let gap=op.trackPos-pos;gap-=Math.round(gap);gap*=L; // + = that car is ahead of me
      if(Math.abs(gap)>260)continue;
      if(gap>0&&gap<aheadAny)aheadAny=gap;
      if(Math.abs(gap)>120)continue;
      const oc=this.track.point(op.trackPos),ot=this.track.tangent(op.trackPos);
      const oLat=(op.mesh.position.x-oc.x)*(-ot.z)+(op.mesh.position.z-oc.z)*ot.x;
      const info={op,gap,lat:oLat,speed:op.speed};
      if(op===this._passOp)passInfo=info;
      if(Math.abs(gap)<9)alongside.push(info);
      if(gap>3&&Math.abs(oLat-myLat)<3.4&&(!blocker||gap<blocker.gap))blocker=info;
    }

    // --- Overtaking ------------------------------------------------------
    // Come up behind a slower car (the tow from its slipstream helps),
    // pick whichever side of it has room, pull out to that lane, drive past
    // and only come back once clear - the way a real driver passes, rather
    // than all cars sitting on their own private line.
    if(this._passCool>0)this._passCool-=dt;
    const passRange=THREE.MathUtils.clamp(24+speed*.45,34,75);
    if(!this._passOp&&this._passCool<=0&&blocker&&blocker.gap<passRange&&speed-blocker.speed>-4){
      const LIM=6.6;
      const cand=[blocker.lat-4.2,blocker.lat+4.2].map(c=>THREE.MathUtils.clamp(c,-LIM,LIM));
      let best=null,bestScore=-1e9;
      for(const c of cand){
        if(Math.abs(c-blocker.lat)<2.9)continue; // squeezed against the wall - no room that side
        if(alongside.some(a=>a.op!==blocker.op&&Math.abs(a.lat-c)<3.2))continue; // someone already there
        const score=-Math.abs(c-myLat)+(Math.abs(c)<Math.abs(blocker.lat)?.8:0); // small move, toward the middle
        if(score>bestScore){bestScore=score;best=c;}
      }
      if(best!==null){this._passOp=blocker.op;this._passLane=best;this._passT=0;}
    }
    if(this._passOp){
      this._passT+=dt;
      if(!passInfo||passInfo.gap<-11||passInfo.gap>115||this._passT>8){this._passOp=null;this._passCool=1.0;}
    }

    // Lane goal: the pass lane while overtaking, otherwise this driver's own
    // preferred line - nudged away from anyone running right beside us.
    let goal=this._passOp?this._passLane:this.laneOffset;
    for(const a of alongside){
      const dl=myLat-a.lat;
      if(Math.abs(dl)<3.4)goal+=(dl>=0?1:-1)*(3.4-Math.abs(dl))*.9;
    }
    goal=THREE.MathUtils.clamp(goal,-6.8,6.8);
    const slew=(this._passOp?4.2:2.4)*dt;
    this._lane+=THREE.MathUtils.clamp(goal-this._lane,-slew,slew);

    // --- Where should I aim? ---------------------------------------------
    const lookMeters=unstuck?10:THREE.MathUtils.clamp(8+speed*.55,14,70);
    const aimT=pos+lookMeters/L;
    const target=this.track.point(aimT);
    const tan=this.track.tangent(aimT);
    const side=new THREE.Vector3(-tan.z,0,tan.x);
    const aimK=this.curvatureAhead(lookMeters/L);
    const laneFade=THREE.MathUtils.clamp(1-aimK*120,.5,1);
    target.addScaledVector(side,this._lane*laneFade);
    const dx=target.x-p.mesh.position.x,dz=target.z-p.mesh.position.z;
    const desiredYaw=Math.atan2(dx,dz);
    let diff=desiredYaw-p.yaw;
    diff=Math.atan2(Math.sin(diff),Math.cos(diff));

    // --- How fast should I be going here? ----------------------------------
    const prof=this.profile;
    const idx0=Math.floor(pos*prof.n);
    const span=Math.max(2,Math.ceil((speed*.35)/prof.ds));
    let planned=Infinity;
    for(let k=0;k<=span;k++)planned=Math.min(planned,prof.v[(idx0+k)%prof.n]);
    let targetSpeed=planned*this.skill;

    // Light catch-up so the race stays a race: AIs a long way behind the
    // human push a little harder, a runaway AI leader eases a touch. Capped
    // at a few percent - it tightens the pack, it doesn't teleport anyone.
    const human=field[0]&&(field[0].physics||field[0]);
    if(RUBBER_BAND&&human&&human!==p){
      const gapM=(human.distance-p.distance)*L; // + = human is ahead of me
      if(gapM>90)targetSpeed*=1+.05*THREE.MathUtils.clamp((gapM-90)/450,0,1);
      else if(gapM<-380)targetSpeed*=1-.04*THREE.MathUtils.clamp((-gapM-380)/500,0,1);
    }

    // Pace waves: every driver has good and bad stretches (a clean sector, a
    // scruffy one), a slow +-1.5% swing on a different rhythm per car. Without
    // it equally-fast cars just follow each other in a train forever; with it
    // the order really changes - cars catch, tow, and pass each other.
    this._clock=(this._clock||0)+dt;
    targetSpeed*=1+.015*Math.sin(this._clock*(2*Math.PI/(38+(this.seed%5)*9))+this.seed);
    // Pack catch-up: a car that has fallen 60m+ off the car ahead pushes to
    // close the gap (up to +2.5%), so the field stays bunched into real
    // battles instead of stringing out.
    if(aheadAny>60)targetSpeed*=1+.025*THREE.MathUtils.clamp((aheadAny-60)/200,0,1);

    // Never drive into the back of someone: close up on them, then match
    // speed until there's room to pull out and pass.
    if(blocker&&Math.abs(blocker.lat-myLat)<3.0){
      const room=blocker.gap-4.6; // bumper-to-bumper gap
      if(room<26)targetSpeed=Math.min(targetSpeed,blocker.speed+(room<10?-3:3+room*.2));
    }

    if(!this._recovering&&Math.abs(diff)>1.3)this._recovering=true;
    else if(this._recovering&&Math.abs(diff)<.4)this._recovering=false;
    const recovering=this._recovering&&!unstuck;
    const slip=Math.abs(p.lateralSlip);

    // Cross-track error from this car's intended lane (metres, + = right).
    const xErr=myLat-this._lane*laneFade;

    // --- Steering ---------------------------------------------------------
    let steer,boost=false;
    const rateMode=!unstuck&&!recovering&&p.speed>14;
    if(rateMode){
      // Pure-pursuit: the yaw rate needed to swing the car's actual direction
      // of travel onto the aim point, capped to what the tires + downforce
      // can really deliver at this speed (never ask for more turn than
      // exists - that is what made fast cars run wide), then a yaw-rate
      // control loop drives the steering torque to hit it. This tracks the
      // line far more precisely at 250+ km/h than steering off heading error.
      const vAng=Math.atan2(p.vel.x,p.vel.z);
      let alpha=desiredYaw-vAng;alpha=Math.atan2(Math.sin(alpha),Math.cos(alpha));
      const Ld=Math.max(8,Math.hypot(dx,dz));
      let wCmd=2*speed*Math.sin(alpha)/Ld;
      wCmd+=THREE.MathUtils.clamp(-xErr*.018,-.1,.1)*Math.min(1,speed/40);
      const aMax=(p.maxGripForce+p.downforce*speed*speed)/p.mass*.94;
      const wMax=aMax/speed;
      wCmd=THREE.MathUtils.clamp(wCmd,-wMax,wMax);
      const sf=1-Math.min(Math.abs(p.speed),60)/60*.55;
      const gS=p.steerTorque*(.35+sf*.9);
      steer=THREE.MathUtils.clamp((wCmd*p.angularDamping+7*(wCmd-p.angularVel))/gS,-1,1);
      // Flat-out on the straights, exactly like a player holding Shift.
      boost=p.speed<targetSpeed-5&&Math.abs(wCmd)<.05&&slip<2.5;
    }else{
      const slipEase=THREE.MathUtils.clamp(1-slip/9,.25,1);
      const gain=THREE.MathUtils.clamp(2.4*(1-Math.min(speed,90)/90*.45),1.3,2.4);
      steer=THREE.MathUtils.clamp((diff*gain-p.angularVel*.6-THREE.MathUtils.clamp(xErr*.045,-.4,.4))*slipEase,-1,1);
    }
    const input={
      steer,
      gas:unstuck?Math.abs(diff)<.9:!recovering&&slip<7&&p.speed<targetSpeed,
      brake:!unstuck&&(recovering||p.speed>targetSpeed+2.5||slip>8),
      boost,handbrake:false,
    };
    p.update(dt,input);
  }
}
