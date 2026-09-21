import * as THREE from "three";

export function createCar(color,name){
  const root=new THREE.Group();
  const paint=new THREE.MeshStandardMaterial({color:new THREE.Color(color),metalness:.55,roughness:.25});
  const dark=new THREE.MeshStandardMaterial({color:0x121212,metalness:.3,roughness:.6});
  const chrome=new THREE.MeshStandardMaterial({color:0xb8bfc6,metalness:.9,roughness:.25});

  const body=new THREE.Mesh(new THREE.BoxGeometry(2.2,.62,4.25),paint);
  body.position.y=1.02;body.castShadow=true;
  const hood=new THREE.Mesh(new THREE.BoxGeometry(1.9,.28,1.1),paint);
  hood.position.set(0,1.0,1.72);hood.castShadow=true;
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.62,.6,1.75),new THREE.MeshStandardMaterial({color:0x111a22,metalness:.1,roughness:.1,transparent:true,opacity:.95}));
  cabin.position.set(0,1.46,-.05);
  root.add(body,hood,cabin);

  const bumper=new THREE.Mesh(new THREE.BoxGeometry(2,.2,.25),dark);
  bumper.position.z=2.05; bumper.position.y=.83;root.add(bumper);
  const splitter=new THREE.Mesh(new THREE.BoxGeometry(2.05,.08,.4),dark);
  splitter.position.set(0,.55,2.15);root.add(splitter);

  for(const x of [-.97,.97]) for(const z of [-1.4,1.4]){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.28,14),new THREE.MeshStandardMaterial({color:0x050505,roughness:1}));
    w.rotation.z=Math.PI/2;w.position.set(x,.58,z);w.castShadow=true;root.add(w);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.3,7),chrome);
    rim.rotation.z=Math.PI/2;rim.position.set(x,.58,z);root.add(rim);
  }

  for(const x of [-.72,.72]){
    const head=new THREE.Mesh(new THREE.BoxGeometry(.32,.16,.1),new THREE.MeshBasicMaterial({color:0xfff6d8}));
    head.position.set(x,.98,2.16);root.add(head);
    const tail=new THREE.Mesh(new THREE.BoxGeometry(.3,.16,.08),new THREE.MeshBasicMaterial({color:0xff2b2b}));
    tail.position.set(x,.98,-2.14);root.add(tail);
  }

  for(const x of [-.95,.95]){
    const mirror=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.32),dark);
    mirror.position.set(x,1.32,.35);root.add(mirror);
  }

  const wing=new THREE.Mesh(new THREE.BoxGeometry(1.5,.08,.5),dark);
  wing.position.set(0,1.55,-1.95);root.add(wing);
  for(const x of [-.55,.55]){
    const strut=new THREE.Mesh(new THREE.BoxGeometry(.08,.4,.08),dark);
    strut.position.set(x,1.32,-1.95);root.add(strut);
  }

  const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.35,8),chrome);
  exhaust.rotation.x=Math.PI/2;exhaust.position.set(.6,.55,-2.18);root.add(exhaust);

  const glow=new THREE.Mesh(new THREE.BoxGeometry(1.7,.08,.08),new THREE.MeshBasicMaterial({color:new THREE.Color(color)}));
  glow.position.set(0,1.0,-2.16);root.add(glow);

  root.userData={name,color,progress:0,distance:0,lap:1,speed:0,finished:false,yaw:0};
  return root;
}

// A real (simplified) vehicle-dynamics model: the car has mass, and every
// motion comes from an actual force being integrated into a velocity
// vector, rather than a scripted "blend toward this number" kinematic
// model. Engine force, braking, drag, and tire grip are all forces;
// steering applies torque into a real angular velocity with its own
// rotational inertia and damping, so it has to build up and bleed off
// like a real spinning object rather than snapping to a target rate.
// Collisions (see applyImpulse()) exchange real momentum between cars
// instead of being hand-scripted push/kick effects.
export class CarPhysics{
  constructor(mesh,track){
    this.mesh=mesh;this.track=track;
    this.progress=0;this.lap=1;this.distance=0;this.finished=false;
    this.mass=1250;
    this.yaw=0;              // body heading (steering points the car this way)
    this.angularVel=0;       // rad/s - real rotational inertia, not an instant turn rate
    this.vel=new THREE.Vector3(); // actual world-space velocity (m/s); can point anywhere, not just "forward"
    this.speed=0;             // derived scalar (forward component of vel) kept for HUD/network/etc.
    this.offTrack=false;
    this.spinTimer=0;
    this._refPoint=new THREE.Vector3();

    // Tuning constants for the force model.
    this.enginePower=9400;      // N, forward drive force at full throttle
    this.brakeForce=15500;      // N, opposing current forward motion
    this.reverseEnginePower=4200;
    this.reverseTopSpeed=15;
    this.boostForce=5200;
    this.dragLinear=16;         // N per m/s - rolling resistance
    this.dragQuad=.62;          // N per (m/s)^2 - air resistance
    this.gripStiffness=2600;    // N per m/s of lateral slip, before clamping to maxGripForce
    this.maxGripForce=15800;    // N - the cap that lets a fast, sharp turn genuinely break traction
    this.steerTorque=5.4;       // rad/s^2 at full steering input
    this.angularDamping=5.2;    // 1/s
  }

  reset(gridIndex=0){
    // See AI.js's reset() for why this must not wrap a negative grid offset
    // into a near-1 progress value (it would falsely credit a car starting
    // behind the line with almost a full lap of distance).
    const raw=.008-gridIndex*.005;
    const p=this.track.point(raw),tan=this.track.tangent(raw);
    this.progress=raw;this.lap=1;this.distance=raw;this.finished=false;
    this.yaw=Math.atan2(tan.x,tan.z);
    this.angularVel=0;
    this.vel.set(0,0,0);
    this.speed=0;
    this.mesh.position.copy(p);this.mesh.position.y+=.65;this.mesh.rotation.y=this.yaw;
    this._refPoint.copy(p);
    this.offTrack=false;
    this.spinTimer=0;
  }

  // A real collision impulse (conservation of momentum along the contact
  // normal, with a restitution/bounciness factor), plus a bit of induced
  // spin from the tangential component - this is what makes a hit look
  // different depending on how it actually landed, instead of always
  // playing the same scripted "kick" regardless of the geometry of the
  // impact.
  applyImpulse(normal,otherVel,otherMass,restitution=.35){
    const relVel=new THREE.Vector3().subVectors(this.vel,otherVel);
    const closingSpeed=relVel.dot(normal);
    if(closingSpeed>=0)return; // already separating, nothing to resolve
    const invMassSum=1/this.mass+1/otherMass;
    const impulseMag=-(1+restitution)*closingSpeed/invMassSum;
    this.vel.addScaledVector(normal,impulseMag/this.mass);
    // Tangential component of the hit induces some spin - an off-centre
    // knock spins you, a square-on hit mostly just pushes you back.
    const tangent=new THREE.Vector3(-normal.z,0,normal.x);
    const tangentialSpeed=relVel.dot(tangent);
    this.angularVel+=THREE.MathUtils.clamp(-tangentialSpeed*.09,-3.5,3.5);
    this.spinTimer=Math.max(this.spinTimer,.4+Math.min(1,Math.abs(impulseMag)/9000));
  }

  update(dt,input){
    if(this.finished)return;
    if(this.spinTimer>0)this.spinTimer=Math.max(0,this.spinTimer-dt);

    const fwd=new THREE.Vector3(Math.sin(this.yaw),0,Math.cos(this.yaw));
    const side=new THREE.Vector3(-fwd.z,0,fwd.x);
    const vf=this.vel.dot(fwd);   // forward speed
    const vs=this.vel.dot(side);  // sideways slip speed

    const throttle=input.gas?1:0;
    const brake=input.brake?1:0;
    const hand=input.handbrake?1:0;
    const boost=input.boost&&vf>18?1:0;
    // Driving off the paved road, or freshly hit, loosens grip and engine
    // authority - rough ground / a car that's still catching itself.
    const gripMul=(this.offTrack?.55:1)*(hand?.4:1)*(this.spinTimer>0?.35:1);

    const force=new THREE.Vector3();

    // Engine / brake / reverse - force tapers off approaching top speed,
    // like a real engine losing thrust as RPM climbs, instead of a hard
    // speed cap.
    let engineF=0;
    if(throttle)engineF+=this.enginePower*gripMul*Math.max(.08,1-Math.max(vf,0)/78*.62);
    if(brake){
      if(vf>.6)engineF-=this.brakeForce;
      else engineF-=this.reverseEnginePower*Math.max(0,1-Math.max(-vf,0)/this.reverseTopSpeed);
    }
    if(boost)engineF+=this.boostForce;
    force.addScaledVector(fwd,engineF);

    // Drag - rolling resistance (linear) + air resistance (quadratic),
    // opposing the FULL velocity vector so residual sideways sliding
    // bleeds off too, not just forward speed.
    const speedMag=this.vel.length();
    force.addScaledVector(this.vel,-this.dragLinear);
    if(speedMag>1e-4)force.addScaledVector(this.vel,-this.dragQuad*speedMag);

    // Tire grip: a spring-like force resisting sideways slip, clamped to
    // a maximum - this cap is what lets a hard, fast turn genuinely
    // overwhelm the tires and slide instead of grip being infinitely
    // strong.
    const maxGrip=this.maxGripForce*gripMul;
    const lateralF=THREE.MathUtils.clamp(-this.gripStiffness*vs,-maxGrip,maxGrip);
    force.addScaledVector(side,lateralF);

    this.vel.addScaledVector(force,dt/this.mass);
    if(this.vel.length()<.05&&!throttle&&!brake)this.vel.set(0,0,0);

    // Steering applies torque, not an instant turn rate - the car has to
    // spin up into a turn and bleeds angular velocity back off via
    // damping, so it has real rotational inertia (and a hit's induced
    // spin, from applyImpulse(), behaves the same way and has to be
    // steered/damped out rather than being cosmetic).
    // Keyboard input is inherently on/off (bang-bang), which is fine for a
    // human who naturally eases off - but an AI holding that pattern
    // forever against a system with real rotational inertia is a classic
    // unstable combination (a double-integrator needs proportional
    // control or it oscillates). So the AI can instead pass a continuous
    // input.steer in [-1,1]; keyboard players keep using left/right.
    const steer=typeof input.steer==="number"?THREE.MathUtils.clamp(input.steer,-1,1):(input.right?-1:0)+(input.left?1:0);
    // Steering authority is highest at low speed (easiest to turn tightly
    // near a stop, like a real car) and tapers off at speed for stability -
    // NOT the other way around. Scaling torque UP with speed would mean a
    // nearly-stopped car has almost no ability to turn, which is both
    // unrealistic and a genuine deadlock risk: it can't reorient without
    // speed, and it can't safely build speed while badly misaligned.
    const speedFactor=1-Math.min(Math.abs(vf),60)/60*.55;
    const torque=steer*this.steerTorque*(.35+speedFactor*.9)*(hand?1.25:1);
    this.angularVel+=torque*dt;
    this.angularVel*=Math.max(0,1-this.angularDamping*dt);
    this.yaw+=this.angularVel*dt;

    const oldPos=this.mesh.position.clone();
    this.mesh.position.addScaledVector(this.vel,dt);

    // Find where we are on the circuit BEFORE updating race progress.
    const nearest=this.track.nearestProgress(this.mesh.position,this.progress);
    const center=this.track.point(nearest);
    // Smooth the raw search result instead of using it directly - this is
    // what removes shake: single-index flicker from the discrete search
    // gets filtered out, while genuine elevation change still comes
    // through with only a few milliseconds of lag, which is imperceptible.
    this._refPoint.lerp(center,1-Math.exp(-20*dt));
    const distXZ=Math.hypot(this.mesh.position.x-this._refPoint.x,this.mesh.position.z-this._refPoint.z);
    const edge=this.track.roadWidth*.8;
    this.offTrack=distXZ>this.track.roadWidth*.62;

    if(distXZ>edge){
      // A gentle spring pulling back toward the road, applied straight to
      // velocity (so it's a force like everything else here) rather than
      // teleporting the position - never a hard wall.
      const over=distXZ-edge;
      const toCenter=new THREE.Vector3(this._refPoint.x-this.mesh.position.x,0,this._refPoint.z-this.mesh.position.z).normalize();
      // This must be dt-scaled like any other force integration (a stray
      // *40 here previously meant it was injecting several m/s of
      // velocity EVERY SINGLE FRAME while off-track, not a gentle nudge -
      // a runaway feedback that could snap the car into a violent,
      // unrecoverable spin the instant it grazed the road edge).
      this.vel.addScaledVector(toCenter,(4+over*.4)*dt);
    }

    this.mesh.position.y=this._refPoint.y+.65;
    this.mesh.rotation.y=this.yaw;
    this.speed=this.vel.dot(fwd);

    // IMPORTANT: race progress follows actual movement direction.
    // A car turned around and driven with W therefore goes BACK around the
    // track and loses progress instead of magically continuing race-forward.
    const moved=this.mesh.position.clone().sub(oldPos);
    const tangent=this.track.tangent(nearest);
    const signedDistance=moved.x*tangent.x+moved.z*tangent.z;
    const signedProgress=signedDistance/this.track.length;
    let newProgress=this.progress+signedProgress;

    if(signedProgress>0){
      if(newProgress>=1){
        newProgress-=1;
        this.lap++;
      }
    }else if(signedProgress<0){
      if(newProgress<0){
        if(this.lap<=1){
          // Guard against reversing back across the start/finish line on
          // lap 1 to farm free "progress" - hold at the line instead.
          newProgress=0;
        }else{
          newProgress+=1;
          this.lap--;
        }
      }
    }

    this.progress=THREE.MathUtils.clamp(newProgress,0,1);
    this.distance=(this.lap-1)+this.progress;

    if(this.lap>TOTAL_LAPS){
      this.finished=true;
      this.lap=TOTAL_LAPS+1;
      this.distance=TOTAL_LAPS;
    }

    this.mesh.userData.progress=this.progress;
    this.mesh.userData.distance=this.distance;
    this.mesh.userData.lap=this.lap;
    this.mesh.userData.speed=this.speed;
    this.mesh.userData.yaw=this.yaw;
    this.mesh.userData.finished=this.finished;
  }
}
export const TOTAL_LAPS=3;
