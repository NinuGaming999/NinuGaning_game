import * as THREE from "three";
import { CarPhysics } from "./Car.js";

// AI cars now run on the exact same CarPhysics force/mass/friction model
// the player uses - the "driver" here just generates steering/throttle/
// brake input from a lookahead point on the track (and a bit of upcoming-
// curvature braking) instead of reading the keyboard. That means AI cars
// can genuinely slide, lose grip, and get knocked around by a real
// collision impulse exactly like the player does, rather than teleporting
// along the centerline immune to physics.
export class AIController{
  constructor(mesh,track,gridIndex){
    this.mesh=mesh;this.track=track;this.gridIndex=gridIndex;
    this.seed=gridIndex*37+7;this.ready=false;
    this.physics=new CarPhysics(mesh,track);
    // A flat centerline-follow at ~45 was a non-issue once the starting-
    // grid distance bug was fixed - the player's real top speed comfortably
    // beat it. This pace target needs genuinely good driving to beat.
    this.paceTarget=58+((this.seed%9)-4)*1.4;
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

  curvatureAhead(d){
    const eps=3/this.track.samples.length;
    const t=this.physics.progress+d;
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

    const speed=Math.max(p.speed,6);
    const lookDist=unstuck?.0015:THREE.MathUtils.clamp(speed/this.track.length*.9,.006,.05);
    const target=this.track.point(p.progress+lookDist);
    const dx=target.x-p.mesh.position.x,dz=target.z-p.mesh.position.z;
    const desiredYaw=Math.atan2(dx,dz);
    let diff=desiredYaw-p.yaw;
    diff=Math.atan2(Math.sin(diff),Math.cos(diff));

    // Brake ahead of the sharpest upcoming curvature rather than reacting
    // to it - the same look-further-ahead-and-slow-down approach a
    // competent human driver uses. Critically, the target speed is
    // derived from the car's REAL grip physics (centripetal force at
    // speed v around radius r is m*v^2/r; the tires can only supply up to
    // maxGripForce), not an arbitrary heuristic - an earlier version of
    // this used a disconnected formula that let the AI attempt corners at
    // roughly double the speed its own tires could actually hold, which
    // wasn't a physics bug, it was a genuinely correct spin-out caused by
    // asking for more grip than exists.
    let maxK=0;
    for(let d=.006;d<=.05;d+=.008)maxK=Math.max(maxK,this.curvatureAhead(d));
    const radius=1/Math.max(maxK,1e-6);
    const gripLimitSpeed=Math.sqrt(p.maxGripForce*radius/p.mass);
    const safeSpeed=gripLimitSpeed*.78+4; // a margin below the true limit, like a real driver leaves

    // If a spin/collision has left the car pointed well away from where
    // it needs to go, flooring the throttle just drives it further off
    // course in whatever direction it happens to be facing. A real (or
    // just competent) driver eases off and lets the car recover its
    // heading before accelerating again, rather than fighting a big
    // heading error at full throttle. This needs hysteresis (enter at a
    // high threshold, only exit once well below it) - checking a single
    // fixed threshold every frame let the flag flicker on and off many
    // times a second whenever diff hovered near it, which fed the car
    // alternating tiny throttle/brake pulses that cancelled out into a
    // stable near-zero-speed deadlock that never actually recovered.
    if(!this._recovering&&Math.abs(diff)>1.3)this._recovering=true;
    else if(this._recovering&&Math.abs(diff)<.4)this._recovering=false;
    const recovering=this._recovering&&!unstuck;

    const input={
      // PD steering, not just P: reacting to the heading error alone
      // (diff) overshoots and oscillates on a system with real
      // rotational inertia, because it never anticipates "I'm already
      // rotating fast enough, ease off" - it only notices once it's
      // overshot past zero. Damping against the car's current angular
      // velocity is what actually lets it settle onto a heading instead
      // of swinging past it and fighting its way back over and over.
      steer:THREE.MathUtils.clamp(diff*2.4-p.angularVel*.6,-1,1),
      gas:unstuck?Math.abs(diff)<.9:!recovering&&p.speed<Math.min(safeSpeed,this.paceTarget+4),
      brake:!unstuck&&(recovering||p.speed>safeSpeed+3),
      boost:false,handbrake:false,
    };
    p.update(dt,input);
  }
}
