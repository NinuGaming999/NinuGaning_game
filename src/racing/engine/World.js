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
    this.buildRidge();
    this.buildLandmarkTower();
    this.buildLighting();
    this.buildAtmosphere();
  }

  // A height-displaced, vertex-colored ground that actually follows the
  // road's elevation instead of a flat plane - on a track that climbs to
  // ~150 units, a flat plane at y=-1.2 left the road looking like it was
  // floating over nothing on the mountain sections. Every vertex's height
  // and color is computed individually against the nearby track surface,
  // so the terrain reads as a proper valley/mountainside the road cuts
  // through rather than a painted floor.
  // True per-pixel surface detail via textures rather than more geometry -
  // adding enough vertices to get pixel-level detail directly into the
  // terrain mesh (millions of them) would reintroduce the exact kind of
  // lag spike already fixed elsewhere. A 512x512 canvas is ~262,000 real,
  // independently-set pixels, tiled across the terrain by the GPU per
  // rendered screen-pixel at essentially no added cost - vertex colors
  // still drive the broad grass/dirt/rock/snow blend, this multiplies in
  // fine-grained grain on top, and the normal map adds real per-pixel lit
  // bumpiness without a single extra triangle.
  buildDetailTextures(){
    const size=512;
    const detailCanvas=document.createElement("canvas");
    detailCanvas.width=detailCanvas.height=size;
    const dctx=detailCanvas.getContext("2d");
    const dImg=dctx.createImageData(size,size);
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        let n=0,amp=1,freq=1,norm=0;
        for(let o=0;o<4;o++){
          n+=smoothNoise(x*freq,y*freq,1/48)*amp;
          norm+=amp;amp*=.5;freq*=2.1;
        }
        n/=norm;
        const v=Math.max(0,Math.min(255,Math.floor(170+(n-.5)*150)));
        const i=(y*size+x)*4;
        dImg.data[i]=v;dImg.data[i+1]=v;dImg.data[i+2]=v;dImg.data[i+3]=255;
      }
    }
    dctx.putImageData(dImg,0,0);
    const detailTex=new THREE.CanvasTexture(detailCanvas);
    detailTex.wrapS=detailTex.wrapT=THREE.RepeatWrapping;
    detailTex.repeat.set(220,220);
    detailTex.colorSpace=THREE.SRGBColorSpace;

    const normalCanvas=document.createElement("canvas");
    normalCanvas.width=normalCanvas.height=size;
    const nctx=normalCanvas.getContext("2d");
    const nImg=nctx.createImageData(size,size);
    const h=(x,y)=>smoothNoise(x,y,1/34)*.65+smoothNoise(x,y,1/11)*.35;
    const strength=1.6;
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const hl=h(x-1,y),hr=h(x+1,y),hd=h(x,y-1),hu=h(x,y+1);
        const nx=(hl-hr)*strength,ny=(hd-hu)*strength,nz=1;
        const len=Math.hypot(nx,ny,nz);
        const i=(y*size+x)*4;
        nImg.data[i]=Math.floor((nx/len*.5+.5)*255);
        nImg.data[i+1]=Math.floor((ny/len*.5+.5)*255);
        nImg.data[i+2]=Math.floor((nz/len*.5+.5)*255);
        nImg.data[i+3]=255;
      }
    }
    nctx.putImageData(nImg,0,0);
    const normalTex=new THREE.CanvasTexture(normalCanvas);
    normalTex.wrapS=normalTex.wrapT=THREE.RepeatWrapping;
    normalTex.repeat.set(220,220);

    return {detailTex,normalTex};
  }

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

    const {detailTex,normalTex}=this.buildDetailTextures();
    const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:1,map:detailTex,normalMap:normalTex,normalScale:new THREE.Vector2(.7,.7)
    }));
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

  // A tall Burj Khalifa-style tapered/tiered skyscraper landmark, visible
  // from much of the circuit, with a glowing red/blue "NINU GAMING"
  // projection wrapped around it like the real building's LED light shows.
  // Placed well clear of the road and the mountain ridge (reuses the same
  // clearance check as buildRidge()), and it's a single static landmark
  // (8 small meshes total) so it costs nothing worth measuring.
  buildLandmarkTower(){
    const trackPts=this._trackPts||this.track.samples;
    const clearOf=(x,z,minDist)=>{
      for(let k=0;k<trackPts.length;k+=2){
        const p=trackPts[k];
        if((x-p.x)*(x-p.x)+(z-p.z)*(z-p.z)<minDist*minDist) return false;
      }
      return true;
    };
    let angle=0.65,radius=470;
    for(let tries=0;tries<12;tries++){
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      if(clearOf(x,z,140))break;
      radius+=40;
    }
    const baseX=Math.cos(angle)*radius,baseZ=Math.sin(angle)*radius;

    const group=new THREE.Group();
    group.position.set(baseX,-4,baseZ);
    const glass=new THREE.MeshStandardMaterial({color:0x0a1620,metalness:.55,roughness:.2});
    // Tapered tiers, each set back from the one below - the classic
    // Burj Khalifa silhouette.
    const tiers=[
      {w:46,h:120,y:0},
      {w:34,h:110,y:120},
      {w:23,h:90,y:230},
      {w:13,h:70,y:320},
    ];
    let totalH=0;
    for(const t of tiers){
      const seg=new THREE.Mesh(new THREE.BoxGeometry(t.w,t.h,t.w),glass);
      seg.position.y=t.y+t.h/2;
      group.add(seg);
      totalH=t.y+t.h;
    }
    const spire=new THREE.Mesh(new THREE.CylinderGeometry(.6,3,40,8),glass);
    spire.position.y=totalH+20;
    group.add(spire);

    // Glowing sign band wrapped around the widest tier, one screen per side.
    const signTex=this.buildSignTexture();
    const signMat=new THREE.MeshBasicMaterial({map:signTex,transparent:true,depthWrite:false});
    const bandY=tiers[0].h*.62;
    const bandW=tiers[0].w+.3,bandH=tiers[0].h*.42;
    const offsets=[
      {x:0,z:bandW/2+.05,ry:0},
      {x:0,z:-bandW/2-.05,ry:Math.PI},
      {x:bandW/2+.05,z:0,ry:Math.PI/2},
      {x:-bandW/2-.05,z:0,ry:-Math.PI/2},
    ];
    for(const o of offsets){
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(bandW*.92,bandH),signMat);
      screen.position.set(o.x,bandY,o.z);
      screen.rotation.y=o.ry;
      group.add(screen);
    }
    this.scene.add(group);
  }

  // Canvas-drawn "LED projection" texture: NINU in red, GAMING in blue,
  // soft glow, transparent background so the dark tower glass shows
  // through around the letters (matches how real building projections
  // only light up where the image is, not the whole facade).
  buildSignTexture(){
    const w=512,h=768;
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const ctx=c.getContext("2d");
    ctx.clearRect(0,0,w,h);
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="bold 92px sans-serif";
    const glow=(text,y,color)=>{
      ctx.shadowColor=color;ctx.shadowBlur=34;ctx.fillStyle=color;
      ctx.fillText(text,w/2,y);
      ctx.shadowBlur=14;ctx.fillText(text,w/2,y);
    };
    glow("NINU",h*.36,"#ff3040");
    glow("GAMING",h*.6,"#2599ff");
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
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
