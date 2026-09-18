import * as THREE from "three";

export function createCar(color,name){
  const root=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.2,.62,4.25),new THREE.MeshStandardMaterial({color:new THREE.Color(color),metalness:.55,roughness:.25}));
  body.position.y=1.02;body.castShadow=true;
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.62,.6,1.75),new THREE.MeshStandardMaterial({color:0x111a22,metalness:.1,roughness:.1,transparent:true,opacity:.95}));
  cabin.position.set(0,1.46,-.05);
  root.add(body,cabin);
  const bumper=new THREE.Mesh(new THREE.BoxGeometry(2,.2,.25),new THREE.MeshStandardMaterial({color:0x121212}));
  bumper.position.z=2.05; bumper.position.y=.83;root.add(bumper);
  for(const x of [-.97,.97]) for(const z of [-1.4,1.4]){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.28,12),new THREE.MeshStandardMaterial({color:0x050505,roughness:1}));
    w.rotation.z=Math.PI/2;w.position.set(x,.58,z);w.castShadow=true;root.add(w);
  }
  const glow=new THREE.Mesh(new THREE.BoxGeometry(1.7,.08,.08),new THREE.MeshBasicMaterial({color:new THREE.Color(color)}));
  glow.position.set(0,1.0,-2.16);root.add(glow);

  root.userData={name,color,progress:0,distance:0,lap:1,speed:0,finished:false,yaw:0};
  return root;
}

export class CarPhysics{
  constructor(mesh,track){
    this.mesh=mesh;this.track=track;
    this.progress=0;this.lap=1;this.speed=0;this.distance=0;this.finished=false;
    // `yaw` is the body/steering heading (what the wheels point toward).
    // `moveYaw` is the direction the car actually travels. Under normal
    // grip they track each other almost instantly; holding the handbrake
    // loosens the grip so moveYaw lags behind yaw, producing a slide/drift
    // without needing a full slip-angle tyre model.
    this.yaw=0;this.moveYaw=0;
    this.offTrack=false;
    // Smoothed reference point used for ride height + off-track pull.
    // Re-deriving this from a fresh discrete nearest-sample search every
    // frame (with zero smoothing) is what caused visible shaking: which
    // sample counts as "nearest" can flicker by one index frame-to-frame,
    // and on steep mountain sections that flicker is a real height jump.
    this._refPoint=new THREE.Vector3();
  }

  reset(gridIndex=0){
    const t=(.008-gridIndex*.005+1)%1;
    const p=this.track.point(t),tan=this.track.tangent(t);
    this.progress=t;this.lap=1;this.speed=0;this.distance=t;this.finished=false;
    // Track tangent points in the direction that counts as race-forward.
    // The car's +Z nose uses the same convention.
    this.yaw=Math.atan2(tan.x,tan.z);
    this.moveYaw=this.yaw;
    this.mesh.position.copy(p);this.mesh.position.y+=.65;this.mesh.rotation.y=this.yaw;
    this._refPoint.copy(p);
    this.offTrack=false;
  }

  update(dt,input){
    if(this.finished)return;

    const throttle=input.gas?1:0;
    const brake=input.brake?1:0;
    const hand=input.handbrake?1:0;
    const boost=input.boost&&this.speed>18?1:0;

    if(throttle)this.speed+=50*dt;
    else if(!brake)this.speed-=16*dt;

    if(brake){
      // S is a real brake while moving forward and becomes reverse once slow.
      if(this.speed>0)this.speed-=62*dt;
      else this.speed-=34*dt;
    }
    if(boost)this.speed+=34*dt;
    if(hand)this.speed*=Math.max(0,1-2.8*dt);

    // Driving off the paved road costs top speed instead of instantly
    // killing momentum - keeps the shoulder feeling like rough ground
    // rather than an invisible wall.
    const offTrackDrag=this.offTrack?.55:1;
    this.speed=THREE.MathUtils.clamp(this.speed,-16,78*offTrackDrag);
    if(Math.abs(this.speed)<.7&&!throttle&&!brake)this.speed=0;

    // A = left, D = right (see Input.js). Steering authority is highest at
    // low/medium speed and tapers off at top speed so the car stays
    // controllable instead of snapping sideways on the fastest straights.
    const steer=(input.right?-1:0)+(input.left?1:0);
    const speedFactor=1-Math.min(Math.abs(this.speed),70)/70*.45;
    const steering=1.15*speedFactor*(hand?1.35:1);
    // Reverse steering naturally inverts the steering response.
    const reverseSign=this.speed<0?-1:1;
    this.yaw+=steer*steering*dt*reverseSign;

    // Grip: how quickly the travel direction catches up to where the car
    // is pointed. Handbrake loosens grip -> the tail steps out into a
    // drift. Off-track grip is also reduced (loose gravel/grass).
    const gripRate=(hand?2.6:16)*(this.offTrack?.6:1);
    let yawDiff=this.yaw-this.moveYaw;
    yawDiff=Math.atan2(Math.sin(yawDiff),Math.cos(yawDiff));
    this.moveYaw+=yawDiff*(1-Math.exp(-gripRate*dt));

    const oldPos=this.mesh.position.clone();
    const forward=new THREE.Vector3(Math.sin(this.moveYaw),0,Math.cos(this.moveYaw));
    this.mesh.position.addScaledVector(forward,this.speed*dt);

    // Find where we are on the circuit BEFORE updating race progress.
    const nearest=this.track.nearestProgress(this.mesh.position,this.progress);
    const center=this.track.point(nearest);
    // Smooth the raw search result instead of using it directly - this is
    // what removes the shake: single-index flicker from the discrete
    // search gets filtered out, while genuine elevation change (which
    // happens gradually as you drive) still comes through with only a
    // few milliseconds of lag, which is imperceptible.
    this._refPoint.lerp(center,1-Math.exp(-20*dt));
    const distXZ=Math.hypot(this.mesh.position.x-this._refPoint.x,this.mesh.position.z-this._refPoint.z);
    const edge=this.track.roadWidth*.8;
    this.offTrack=distXZ>this.track.roadWidth*.62;

    if(distXZ>edge){
      // Gentle, continuous nudge back toward the road - never a hard
      // teleport/snap, so it never feels like hitting a wall.
      const over=distXZ-edge;
      const pull=1-Math.exp(-1.6*dt*(1+over*.02));
      this.mesh.position.x=THREE.MathUtils.lerp(this.mesh.position.x,this._refPoint.x,pull);
      this.mesh.position.z=THREE.MathUtils.lerp(this.mesh.position.z,this._refPoint.z,pull);
    }

    this.mesh.position.y=this._refPoint.y+.65;
    this.mesh.rotation.y=this.yaw;

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
