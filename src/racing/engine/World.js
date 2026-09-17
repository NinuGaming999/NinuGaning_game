import * as THREE from "three";

export class WorldBuilder{
  constructor(scene,track,quality={shadows:true,shadowMapSize:2048}){
    this.scene=scene;this.track=track;this.quality=quality;this.batches=[];
  }
  addBase(){
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshStandardMaterial({color:0x08150f,roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-1.2;ground.receiveShadow=true;this.scene.add(ground);

    // Distant ridge is instanced (one draw call) instead of 40 separate
    // meshes, and none of them cast shadows - they're silhouettes at the
    // edge of the fog, a shadow pass on them would be wasted cost.
    const mountainMat=new THREE.MeshStandardMaterial({color:0x111c25,roughness:1});
    const ridgeGeo=new THREE.ConeGeometry(1,1,6);
    const ridge=new THREE.InstancedMesh(ridgeGeo,mountainMat,40);
    const m=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scl=new THREE.Vector3();
    for(let i=0;i<40;i++){
      const a=i/40*Math.PI*2,r=360+(i%4)*55,h=60+(i%8)*14,w=80+(i%5)*20;
      pos.set(Math.cos(a)*r,h/2-4,Math.sin(a)*r);
      quat.setFromAxisAngle(new THREE.Vector3(0,1,0),a*.7);
      scl.set(w,h,w);
      m.compose(pos,quat,scl);
      ridge.setMatrixAt(i,m);
    }
    ridge.instanceMatrix.needsUpdate=true;
    this.scene.add(ridge);

    // A single shadow-casting sun (this used to be duplicated by a second
    // directional light + hemisphere light added in main.js's bootLights(),
    // which doubled both scene brightness and the shadow-map render cost
    // for no visual benefit - that duplicate has been removed).
    const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(260,420,180);
    sun.castShadow=this.quality.shadows;
    const size=this.quality.shadowMapSize||2048;
    sun.shadow.mapSize.set(size,size);sun.shadow.camera.near=1;sun.shadow.camera.far=1200;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xa8d8ff,0x08120e,1.5));

    const mist=new THREE.Mesh(
      new THREE.PlaneGeometry(1600,700),
      new THREE.MeshBasicMaterial({color:0x102638,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide})
    );
    mist.rotation.x=-Math.PI/2;mist.position.y=95;this.scene.add(mist);

    // Cheap night-sky detail: a few hundred points, one draw call.
    const starCount=500;
    const starPos=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){
      const a=Math.random()*Math.PI*2,el=Math.random()*.5+.08,r=1000;
      starPos[i*3]=Math.cos(a)*r*Math.cos(el);
      starPos[i*3+1]=Math.sin(el)*r+120;
      starPos[i*3+2]=Math.sin(a)*r*Math.cos(el);
    }
    const starGeo=new THREE.BufferGeometry();
    starGeo.setAttribute("position",new THREE.BufferAttribute(starPos,3));
    const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xdfeeff,size:1.6,sizeAttenuation:false,transparent:true,opacity:.75}));
    this.scene.add(stars);
  }
}
