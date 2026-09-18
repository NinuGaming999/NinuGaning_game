import * as THREE from "three";

// Cheap deterministic value-noise (no extra dependency) for natural-looking
// height/color variation away from the road.
function noise2(x,z){
  const s=Math.sin(x*12.9898+z*78.233)*43758.5453;
  return s-Math.floor(s);
}
function smoothNoise(x,z,freq){
  const fx=x*freq,fz=z*freq;
  const x0=Math.floor(fx),z0=Math.floor(fz);
  const tx=fx-x0,tz=fz-z0;
  const a=noise2(x0,z0),b=noise2(x0+1,z0),c=noise2(x0,z0+1),d=noise2(x0+1,z0+1);
  const u=tx*tx*(3-2*tx),v=tz*tz*(3-2*tz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,u),THREE.MathUtils.lerp(c,d,u),v);
}

export class WorldBuilder{
  constructor(scene,track,quality={shadows:true,shadowMapSize:2048,decorScale:1}){
    this.scene=scene;this.track=track;this.quality=quality;this.batches=[];
  }
  addBase(){
    this.buildTerrain();
    this.buildRoadClearing();
    this.buildRidge();
    this.buildLighting();
    this.buildAtmosphere();
  }

  // An invisible "tunnel" volume that follows the road end-to-end. It
  // writes to the depth buffer but never draws any color, and it has
  // nothing to do with car physics whatsoever (collision only checks
  // car-vs-car distances in RacingGameV2.jsx) - this is purely a render
  // trick. Because it's rendered before the mountain ridge (renderOrder
  // enforces that regardless of add order) and sits well outside the
  // actual road/car space, any mountain geometry that ends up overlapping
  // the road corridor gets hidden behind this invisible wall from the
  // camera's point of view, while the real road surface and every car -
  // which live *inside* the corridor, never behind its walls relative to
  // the chase camera - are completely unaffected and keep rendering
  // exactly as normal.
  buildRoadClearing(){
    const samples=this.track.samples;
    const half=180;       // corridor half-width - generously covers even a badly-placed mountain's footprint
    const bottomOff=-15;  // below local road height
    const topOff=72;      // above local road height - clears the tallest ridge cones near the road
    const positions=[];
    const up=new THREE.Vector3(0,1,0);
    const n=samples.length;
    for(let i=0;i<n;i+=2){
      const p0=samples[i], p1=samples[(i+2)%n];
      const tan=p1.clone().sub(p0).normalize();
      const side=new THREE.Vector3(-tan.z,0,tan.x); // shared for both ends of this short segment - adjacent samples are only ~10m apart so the twist is negligible
      const mk=(p,s,vOff)=>p.clone().addScaledVector(side,s*half).add(up.clone().multiplyScalar(vOff));
      const bl0=mk(p0,-1,bottomOff),tl0=mk(p0,-1,topOff),tr0=mk(p0,1,topOff),br0=mk(p0,1,bottomOff);
      const bl1=mk(p1,-1,bottomOff),tl1=mk(p1,-1,topOff),tr1=mk(p1,1,topOff),br1=mk(p1,1,bottomOff);
      // left wall
      positions.push(bl0.x,bl0.y,bl0.z, tl0.x,tl0.y,tl0.z, tl1.x,tl1.y,tl1.z);
      positions.push(bl0.x,bl0.y,bl0.z, tl1.x,tl1.y,tl1.z, bl1.x,bl1.y,bl1.z);
      // roof
      positions.push(tl0.x,tl0.y,tl0.z, tr0.x,tr0.y,tr0.z, tr1.x,tr1.y,tr1.z);
      positions.push(tl0.x,tl0.y,tl0.z, tr1.x,tr1.y,tr1.z, tl1.x,tl1.y,tl1.z);
      // right wall
      positions.push(tr0.x,tr0.y,tr0.z, br0.x,br0.y,br0.z, br1.x,br1.y,br1.z);
      positions.push(tr0.x,tr0.y,tr0.z, br1.x,br1.y,br1.z, tr1.x,tr1.y,tr1.z);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(positions),3));
    const mat=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true});
    const occluder=new THREE.Mesh(geo,mat);
    occluder.renderOrder=-10; // must draw (and write depth) before the ridge below
    occluder.frustumCulled=false; // it wraps the whole track; letting it get culled piecemeal risks gaps
    this.scene.add(occluder);
  }

  // A height-displaced, vertex-colored ground that actually follows the
  // road's elevation instead of a flat plane - on a track that climbs to
  // ~150 units, a flat plane at y=-1.2 left the road looking like it was
  // floating over nothing on the mountain sections. Every vertex's height
  // and color is computed individually against the nearby track surface,
  // so the terrain reads as a proper valley/mountainside the road cuts
  // through rather than a painted floor.
  buildTerrain(){
    const size=3200;
    const segs=this.quality.decorScale<1?90:130; // fewer verts on mobile
    const geo=new THREE.PlaneGeometry(size,size,segs,segs);
    geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;

    // Subsample the track centerline into a fast lookup set - checking
    // every dense sample per vertex would be far too slow; a few hundred
    // evenly spaced points is plenty since we only need smooth influence,
    // not exact nearest-point precision.
    const trackPts=[];
    for(let i=0;i<this.track.samples.length;i+=6) trackPts.push(this.track.samples[i]);

    const baseY=-7;      // valley floor far from any road
    const influenceR=170; // how far the road's elevation pulls the ground up to meet it
    const colors=new Float32Array(pos.count*3);
    const col=new THREE.Color();
    const grass=new THREE.Color(0x142a18),dirt=new THREE.Color(0x2a2118),rock=new THREE.Color(0x3a3f44),snow=new THREE.Color(0xdfe8f0);

    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);
      let best=Infinity,bestY=0;
      for(let k=0;k<trackPts.length;k++){
        const p=trackPts[k],dx=x-p.x,dz=z-p.z,d2=dx*dx+dz*dz;
        if(d2<best){best=d2;bestY=p.y;}
      }
      const d=Math.sqrt(best);
      const t=THREE.MathUtils.clamp(1-d/influenceR,0,1);
      const smooth=t*t*(3-2*t);
      const roll=(smoothNoise(x,z,.006)-.5)*14+(smoothNoise(x,z,.02)-.5)*3; // gentle rolling terrain away from the road
      const y=THREE.MathUtils.lerp(baseY+roll,bestY-1.6,smooth);
      pos.setY(i,y);

      // Blend a believable ground material by height/slope: grass/dirt low
      // down, bare rock higher up, snow near the mountain's upper sections -
      // matching the road's own snowy-peak decoration tint.
      const alt=y+roll*0;
      let base;
      if(alt>92) base=col.copy(rock).lerp(snow,THREE.MathUtils.clamp((alt-92)/40,0,1));
      else if(alt>34) base=col.copy(grass).lerp(rock,THREE.MathUtils.clamp((alt-34)/58,0,1));
      else base=col.copy(dirt).lerp(grass,THREE.MathUtils.clamp((alt+7)/41,0,1));
      const speck=(noise2(Math.floor(x*3),Math.floor(z*3))-.5)*.06;
      colors[i*3]=THREE.MathUtils.clamp(base.r+speck,0,1);
      colors[i*3+1]=THREE.MathUtils.clamp(base.g+speck,0,1);
      colors[i*3+2]=THREE.MathUtils.clamp(base.b+speck,0,1);
    }
    geo.setAttribute("color",new THREE.BufferAttribute(colors,3));
    geo.computeVertexNormals();

    const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
    ground.receiveShadow=true;
    this.scene.add(ground);
    this._trackPts=trackPts;
  }

  // Distant ridge, instanced (one draw call). Mountains are nudged outward
  // away from the actual road path so they never visually poke through
  // it - the old fixed-radius ring didn't account for the track's real
  // (non-circular) footprint, so on some stretches the road passed right
  // through where a mountain cone was sitting.
  buildRidge(){
    const trackPts=this._trackPts||this.track.samples;
    const clearOf=(x,z,minDist)=>{
      for(let k=0;k<trackPts.length;k+=2){
        const p=trackPts[k];
        if((x-p.x)*(x-p.x)+(z-p.z)*(z-p.z)<minDist*minDist) return false;
      }
      return true;
    };
    const mountainMat=new THREE.MeshStandardMaterial({color:0x111c25,roughness:1});
    const ridgeGeo=new THREE.ConeGeometry(1,1,6);
    const count=40;
    const ridge=new THREE.InstancedMesh(ridgeGeo,mountainMat,count);
    const m=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scl=new THREE.Vector3();
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2,h=60+(i%8)*14,w=80+(i%5)*20;
      let r=340+(i%4)*55;
      const minClear=w*.5+90;
      for(let tries=0;tries<10;tries++){
        const x=Math.cos(a)*r,z=Math.sin(a)*r;
        if(clearOf(x,z,minClear))break;
        r+=45;
      }
      pos.set(Math.cos(a)*r,h/2-4,Math.sin(a)*r);
      quat.setFromAxisAngle(new THREE.Vector3(0,1,0),a*.7);
      scl.set(w,h,w);
      m.compose(pos,quat,scl);
      ridge.setMatrixAt(i,m);
    }
    ridge.instanceMatrix.needsUpdate=true;
    ridge.receiveShadow=true;
    this.scene.add(ridge);
  }

  buildLighting(){
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
  }

  buildAtmosphere(){
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
