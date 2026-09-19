import * as THREE from "three";

function lerp(a,b,t){ return a+(b-a)*t; }
function catmull(p0,p1,p2,p3,t){
  const t2=t*t,t3=t2*t;
  return new THREE.Vector3(
    .5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    .5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
    .5*((2*p1.z)+(-p0.z+p2.z)*t+(2*p0.z-5*p1.z+4*p2.z-p3.z)*t2+(-p0.z+3*p1.z-3*p2.z+p3.z)*t3)
  );
}
function buildControlPoints(){
  const points=[];
  // ~2.5 km alpine loop: long straights, hairpins, ridge and valley sections.
  const raw=[
    [0,38,0],[125,52,90],[250,66,120],[390,72,70],[510,60,-35],[560,45,-145],
    [510,32,-270],[390,24,-350],[245,31,-420],[90,22,-470],[-70,18,-430],
    [-180,28,-350],[-225,48,-230],[-200,72,-95],[-120,98,35],[10,128,130],
    [155,148,215],[300,132,250],[420,108,220],[510,90,140],[575,78,30],
    [625,70,-100],[660,54,-240],[635,40,-380],[560,28,-505],[440,18,-610],
    [285,12,-690],[115,9,-725],[-50,14,-680],[-195,25,-595],[-310,48,-480],
    [-365,72,-320],[-380,93,-150],[-350,110,15],[-275,125,165],[-160,135,285],
    [-10,118,350],[150,98,360],[285,76,320],[405,58,250],[485,45,150],
    [535,38,40],[495,32,-75],[410,26,-160],[285,22,-205],[150,27,-180],[45,34,-120]
  ];
  for(const p of raw) points.push(new THREE.Vector3(...p));
  return points;
}

export class MountainTrack{
  constructor(scene,quality={shadows:true,decorScale:1}){
    this.scene=scene;
    this.quality=quality;
    this.samples=[];
    this.length=0;
    this.roadWidth=18;
    this.buildData();
    this.addRoad();
    this.decorQueue=this.makeDecorationQueue();
    this.decorInstances=this.setupDecorationInstances();
  }
  buildData(){
    const cps=buildControlPoints();
    const segs=cps.length;
    const dense=[];
    // More samples per control-point segment = a smoother road ribbon and
    // more accurate physics/curvature (the old 18-step resolution left
    // ~8.3m between samples, which was coarse enough to cause visible
    // kinks). point()/tangent() below interpolate between samples anyway,
    // so this is a quality/memory tradeoff rather than a correctness one.
    const steps=30;
    for(let i=0;i<segs;i++){
      const p0=cps[(i-1+segs)%segs],p1=cps[i],p2=cps[(i+1)%segs],p3=cps[(i+2)%segs];
      for(let s=0;s<steps;s++){
        dense.push(catmull(p0,p1,p2,p3,s/steps));
      }
    }
    this.samples=dense;
    let length=0;
    for(let i=0;i<dense.length;i++){
      const a=dense[i],b=dense[(i+1)%dense.length];
      length+=a.distanceTo(b);
    }
    this.length=length;
    // Keep nearestProgress()'s search window covering a roughly constant
    // physical distance (~220m each side) regardless of sample density.
    this.searchWindow=Math.max(50,Math.ceil(220/(length/dense.length)));
  }
  point(t){
    // Smoothly interpolate between adjacent samples instead of snapping to
    // the nearest one. This also protects against a subtle float-precision
    // trap: nearestProgress() returns exact multiples of 1/n, and running
    // those back through a bare floor(t*n) would occasionally (~1 in 3
    // samples, verified) land one whole index short due to rounding in the
    // wraparound math - which used to snap the reference "center" point a
    // full sample-spacing (~8m) away from the car for no reason, including
    // right at the starting grid. Interpolating makes that error vanish
    // (it becomes a sub-millimeter blend instead of a wrong sample).
    const n=this.samples.length;
    const f=(((t%1)+1)%1)*n;
    let i=Math.floor(f);
    const frac=f-i;
    if(i>=n)i=0;
    const a=this.samples[i], b=this.samples[(i+1)%n];
    return new THREE.Vector3(
      a.x+(b.x-a.x)*frac,
      a.y+(b.y-a.y)*frac,
      a.z+(b.z-a.z)*frac
    );
  }
  tangent(t){
    // Symmetric finite difference through the (now continuous) point()
    // function, so the tangent is smooth everywhere rather than only at
    // sample boundaries.
    const eps=.5/this.samples.length;
    const a=this.point(t-eps), b=this.point(t+eps);
    return b.sub(a).normalize();
  }
  nearestProgress(pos,guess=0){
    const n=this.samples.length;
    let center=Math.floor(((guess%1)+1)%1*n);
    let best=center,bestD=Infinity;
    // Local window. Full scan only when far from previous estimate.
    const w=this.searchWindow||50;
    for(let d=-w;d<=w;d++){
      const i=(center+d+n*2)%n;
      const s=this.samples[i];
      const dist=s.distanceToSquared(pos);
      if(dist<bestD){bestD=dist;best=i;}
    }
    if(bestD>this.roadWidth*this.roadWidth*25){
      for(let i=0;i<n;i+=2){
        const dist=this.samples[i].distanceToSquared(pos);
        if(dist<bestD){bestD=dist;best=i;}
      }
    }
    return best/n;
  }
  addRoad(){
    const road=this.ribbonGeometry(this.samples,this.roadWidth,0.05);
    const mesh=new THREE.Mesh(road,new THREE.MeshStandardMaterial({color:0x242a32,roughness:.93,metalness:.02}));
    mesh.receiveShadow=true; this.scene.add(mesh);
    const center=this.ribbonGeometry(this.samples,0.17,0.14);
    const line=new THREE.Mesh(center,new THREE.MeshBasicMaterial({color:0xeff7ff}));
    this.scene.add(line);

    const edgeL=this.ribbonGeometry(this.samples,.16,0.25,-this.roadWidth*.47);
    const edgeR=this.ribbonGeometry(this.samples,.16,0.25,this.roadWidth*.47);
    const edgeMat=new THREE.MeshBasicMaterial({color:0x19d3ff});
    this.scene.add(new THREE.Mesh(edgeL,edgeMat),new THREE.Mesh(edgeR,edgeMat));

    const start=this.quadAt(.003,16,0.15);
    const startMesh=new THREE.Mesh(start,new THREE.MeshBasicMaterial({color:0xffffff}));
    this.scene.add(startMesh);

    for(let i=0;i<7;i++){
      const t=.003+i*.06;
      const p=this.point(t),q=this.tangent(t),yaw=Math.atan2(q.x,q.z);
      const sign=i%2?1:-1;
      const marker=new THREE.Mesh(new THREE.BoxGeometry(.22,.35,3.8),new THREE.MeshBasicMaterial({color:sign>0?0xff2e9c:0x19d3ff}));
      // Keep visual markers beside the road, never across the main racing line.
      const roadside=new THREE.Vector3(-q.z,0,q.x).normalize();
      marker.position.copy(p).addScaledVector(roadside,sign*(this.roadWidth*.72));
      marker.position.y+=1.0; marker.rotation.y=yaw; this.scene.add(marker);
    }
    this.addStreetLamps();
  }
  // Neon-styled street lamps lining the road (fits the game's established
  // cyan/pink accent palette better than plain white light poles).
  // Instanced (2 draw calls total for every lamp on the whole circuit) and
  // built from emissive-look materials rather than real THREE.PointLights,
  // which would each cost a lighting pass - dozens of real dynamic lights
  // would undo the lighting-cost work already done elsewhere.
  addStreetLamps(){
    const spacing=110; // meters between lamps
    const count=Math.max(1,Math.floor(this.length/spacing));
    const poleGeo=new THREE.CylinderGeometry(.14,.2,5.6,7);
    const poleMat=new THREE.MeshStandardMaterial({color:0x1c2128,metalness:.6,roughness:.5});
    const armGeo=new THREE.BoxGeometry(1.6,.16,.16);
    const bulbGeo=new THREE.IcosahedronGeometry(.42,1);
    const bulbMat=new THREE.MeshBasicMaterial({color:0xffffff});
    const pole=new THREE.InstancedMesh(poleGeo,poleMat,count);
    const arm=new THREE.InstancedMesh(armGeo,poleMat,count);
    const bulb=new THREE.InstancedMesh(bulbGeo,bulbMat,count);
    pole.castShadow=arm.castShadow=false;
    const m=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scl=new THREE.Vector3(1,1,1);
    const col=new THREE.Color();
    const offset=this.roadWidth*1.12;
    for(let i=0;i<count;i++){
      const t=(i*spacing)/this.length;
      const p=this.point(t),tan=this.tangent(t);
      const side=new THREE.Vector3(-tan.z,0,tan.x);
      const sign=i%2?1:-1;
      const yaw=Math.atan2(tan.x,tan.z);
      const base=p.clone().addScaledVector(side,sign*offset);

      pos.copy(base);pos.y+=2.8;
      quat.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
      m.compose(pos,quat,scl);pole.setMatrixAt(i,m);

      pos.copy(base);pos.y+=5.4;pos.addScaledVector(side,-sign*.8);
      m.compose(pos,quat,scl);arm.setMatrixAt(i,m);

      pos.copy(base);pos.y+=5.4;pos.addScaledVector(side,-sign*1.6);
      m.compose(pos,quat,scl);bulb.setMatrixAt(i,m);
      bulb.setColorAt(i,col.set(sign>0?0xff2e9c:0x19d3ff));
    }
    pole.instanceMatrix.needsUpdate=true;
    arm.instanceMatrix.needsUpdate=true;
    bulb.instanceMatrix.needsUpdate=true;
    if(bulb.instanceColor)bulb.instanceColor.needsUpdate=true;
    this.scene.add(pole,arm,bulb);
  }
  ribbonGeometry(samples,width,yOffset,lateralOffset=0){
    const verts=[],uvs=[];
    const n=samples.length;
    for(let i=0;i<n;i++){
      const p=samples[i],prev=samples[(i-1+n)%n],next=samples[(i+1)%n];
      const t=next.clone().sub(prev).normalize();
      const side=new THREE.Vector3(-t.z,0,t.x).normalize();
      const left=p.clone().addScaledVector(side,width).addScaledVector(side,lateralOffset);
      const right=p.clone().addScaledVector(side,-width).addScaledVector(side,lateralOffset);
      left.y+=yOffset; right.y+=yOffset;
      verts.push(left.x,left.y,left.z,right.x,right.y,right.z);
      uvs.push(0,i/n,1,i/n);
    }
    const indices=[];
    for(let i=0;i<n;i++){
      const a=i*2,b=i*2+1,c=((i+1)%n)*2,d=((i+1)%n)*2+1;
      indices.push(a,c,b,b,c,d);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    g.setIndex(indices); g.computeVertexNormals();
    return g;
  }
  quadAt(t,width,height){
    const p=this.point(t),prev=this.point(t-.002),next=this.point(t+.002);
    const side=next.clone().sub(prev).normalize();
    const left=new THREE.Vector3(-side.z,0,side.x);
    const a=p.clone().addScaledVector(left,width/2);const b=p.clone().addScaledVector(left,-width/2);
    const c=b.clone().add(new THREE.Vector3(0,height,0));const d=a.clone().add(new THREE.Vector3(0,height,0));
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute([a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,d.x,d.y,d.z],3));
    g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;
  }
  makeDecorationQueue(){
    // Scenery is instanced now (see setupDecorationInstances), so it's cheap
    // to render - desktop gets a denser scene, mobile stays lighter.
    const scale=this.quality.decorScale??1;
    const treeCount=Math.round(400*scale);
    const rockCount=Math.round(170*scale);
    const q=[];
    for(let i=0;i<treeCount;i++) q.push({type:"tree",t:(i/treeCount+.011)%1,side:i%2?1:-1,seed:i});
    for(let i=0;i<rockCount;i++) q.push({type:"rock",t:(i/rockCount+.027)%1,side:i%2?1:-1,seed:1000+i});
    this._treeTotal=treeCount;this._rockTotal=rockCount;
    return q;
  }
  setupDecorationInstances(){
    // All trees/rocks share one geometry+material each and are drawn with
    // three InstancedMesh objects (3 draw calls total) instead of one Mesh
    // per object (previously ~630 separate meshes - the main source of both
    // the loading-time stutter and the ongoing per-frame draw-call cost).
    const trunkGeo=new THREE.CylinderGeometry(.18,.28,1,6);
    const leafGeo=new THREE.ConeGeometry(1.8,1,7);
    const rockGeo=new THREE.DodecahedronGeometry(1,0);
    // White base color so each instance's tint (instanceColor) shows true.
    const trunkMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
    const leafMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
    const rockMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
    const trunkMesh=new THREE.InstancedMesh(trunkGeo,trunkMat,Math.max(1,this._treeTotal));
    const leafMesh=new THREE.InstancedMesh(leafGeo,leafMat,Math.max(1,this._treeTotal));
    const rockMesh=new THREE.InstancedMesh(rockGeo,rockMat,Math.max(1,this._rockTotal));
    // Small/numerous decoration casting shadows is expensive for little
    // visual payoff at driving speed - skip cast, keep receive so they
    // still sit believably in the road/mountain shadow.
    for(const m of [trunkMesh,leafMesh,rockMesh]){m.castShadow=false;m.receiveShadow=true;m.count=0;this.scene.add(m);}
    return {trunkMesh,leafMesh,rockMesh,nextTree:0,nextRock:0};
  }
  buildDecorationBatch(start,count){
    const end=Math.min(start+count,this.decorQueue.length);
    const {trunkMesh,leafMesh,rockMesh}=this.decorInstances;
    const m=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scl=new THREE.Vector3(),col=new THREE.Color();
    for(let i=start;i<end;i++){
      const d=this.decorQueue[i],p=this.point(d.t),tan=this.tangent(d.t),side=new THREE.Vector3(-tan.z,0,tan.x);
      const off=this.roadWidth*(1.4+((d.seed*13)%90)/60);
      const base=p.clone().addScaledVector(side,off);
      const yaw=(d.seed*2.399)%(Math.PI*2); // cheap deterministic pseudo-random rotation for variety
      const snowy=base.y>92; // tint high-altitude scenery white/blue like snowcap
      if(d.type==="tree"){
        const h=6+((d.seed*7)%80)/10;
        pos.copy(base);pos.y+=h*.2;
        quat.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
        scl.set(1,h*.42,1);
        m.compose(pos,quat,scl);
        const idx=this.decorInstances.nextTree++;
        trunkMesh.setMatrixAt(idx,m);
        trunkMesh.setColorAt(idx,col.setHSL(.08,.35,snowy?.75:.28+((d.seed%7)*.015)));

        pos.copy(base);pos.y+=h*.63;
        scl.set(1,h*.58,1);
        m.compose(pos,quat,scl);
        leafMesh.setMatrixAt(idx,m);
        leafMesh.setColorAt(idx,snowy?col.setHSL(.55,.25,.85):col.setHSL(.4,.5,.16+((d.seed%9)*.012)));
      }else{
        const s=1+((d.seed*17)%60)/20;
        pos.copy(base);pos.y+=s*.45;
        quat.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
        scl.set(s,s*(.55+((d.seed%5)*.08)),s);
        m.compose(pos,quat,scl);
        const idx=this.decorInstances.nextRock++;
        rockMesh.setMatrixAt(idx,m);
        rockMesh.setColorAt(idx,snowy?col.setHSL(.58,.15,.82):col.setHSL(.58,.08,.28+((d.seed%6)*.02)));
      }
    }
    trunkMesh.count=this.decorInstances.nextTree;
    leafMesh.count=this.decorInstances.nextTree;
    rockMesh.count=this.decorInstances.nextRock;
    trunkMesh.instanceMatrix.needsUpdate=true;leafMesh.instanceMatrix.needsUpdate=true;rockMesh.instanceMatrix.needsUpdate=true;
    if(trunkMesh.instanceColor)trunkMesh.instanceColor.needsUpdate=true;
    if(leafMesh.instanceColor)leafMesh.instanceColor.needsUpdate=true;
    if(rockMesh.instanceColor)rockMesh.instanceColor.needsUpdate=true;
    return end;
  }
}
