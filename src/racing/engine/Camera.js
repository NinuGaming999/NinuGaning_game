import * as THREE from "three";

export class ChaseCamera{
  constructor(camera,track,input){
    this.camera=camera;this.track=track;this.input=input;
    this.target=new THREE.Vector3();
    this.orbitYaw=0;this.orbitPitch=.12;
  }
  update(dt,car){
    if(!car)return;
    const p=car.mesh.position;
    const carForward=new THREE.Vector3(Math.sin(car.yaw),0,Math.cos(car.yaw));
    const roadForward=this.track.tangent(car.progress);

    // Normal gameplay: hard-lock the camera to the direction the car is
    // actually facing. The camera stays behind the vehicle and looks ahead.
    let desired;
    if(this.input.freeCam){
      // Optional freecam: C toggles it; A/D/W/S still drive the car.
      const yaw=this.orbitYaw;
      const pitch=this.orbitPitch;
      const back=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(-12);
      desired=p.clone().add(back);
      desired.y+=6+Math.sin(pitch)*5;
    }else{
      desired=p.clone().addScaledVector(carForward,-11.5);
      desired.y+=5.8;
    }
    this.camera.position.lerp(desired,1-Math.pow(.0008,dt));

    let lookDir=carForward;
    if(!this.input.freeCam){
      // Look farther down the driving line on long mountain sections.
      const blend=THREE.MathUtils.clamp(Math.abs(car.speed)/70,.15,.65);
      lookDir=carForward.clone().lerp(roadForward,blend).normalize();
    }else{
      lookDir=new THREE.Vector3(Math.sin(this.orbitYaw),0,Math.cos(this.orbitYaw));
    }
    const lookAhead=p.clone().addScaledVector(lookDir,18);
    lookAhead.y+=1.0;
    this.target.lerp(lookAhead,1-Math.pow(.0007,dt));
    this.camera.lookAt(this.target);
  }
}
