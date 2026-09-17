export class InputManager{
  constructor(canvas){
    this.state={left:false,right:false,gas:false,brake:false,boost:false,handbrake:false};
    this.canvas=canvas;this.freeCam=false;this.cameraProxy=null;
    this._cleanupFns=[];
    // A / Left = steer left, D / Right = steer right (matches the on-screen
    // legend and Car.js's steer calculation). A previous build had these
    // swapped internally while the legend still said "A=LEFT, D=RIGHT" -
    // that mismatch caused a spin-out into facing backward, and since race
    // progress is measured by actual movement direction (see Car.js), a
    // backward-facing car being driven with W reads as "stuck"/blocked.
    const A_BUTTON = "left";
    const D_BUTTON = "right";
    this.map={
      KeyA:A_BUTTON,ArrowLeft:A_BUTTON,
      KeyD:D_BUTTON,ArrowRight:D_BUTTON,
      KeyW:"gas",ArrowUp:"gas",
      KeyS:"brake",ArrowDown:"brake",
      ShiftLeft:"boost",ShiftRight:"boost",
      Space:"handbrake"
    };
    this._on(window,"keydown",e=>{
      const k=this.map[e.code];
      if(k){e.preventDefault();this.state[k]=true}
      if(e.code==="KeyC"){e.preventDefault();this.freeCam=!this.freeCam}
    },{passive:false});
    this._on(window,"keyup",e=>{
      const k=this.map[e.code];
      if(k){e.preventDefault();this.state[k]=false}
    },{passive:false});
    this._on(window,"blur",()=>this.clear());
    this._on(document,"visibilitychange",()=>{if(document.hidden)this.clear()});
    this.bindTouch();
    this.bindFreeCamLook();
  }
  // This engine now lives inside a React single-page app instead of owning
  // a whole static page, so it can be mounted/unmounted many times in one
  // browser session (leaving the racing screen and coming back). Track
  // every listener we attach so destroy() can remove them - otherwise
  // they'd pile up on `window`/`document` across visits and both leak
  // memory and double-fire on stale InputManager instances.
  _on(target,event,handler,opts){
    target.addEventListener(event,handler,opts);
    this._cleanupFns.push(()=>target.removeEventListener(event,handler,opts));
  }
  destroy(){
    for(const fn of this._cleanupFns)fn();
    this._cleanupFns=[];
  }
  clear(){for(const k of Object.keys(this.state))this.state[k]=false}
  bindTouch(){
    for(const el of document.querySelectorAll("[data-control]")){
      const key=el.dataset.control;
      const set=v=>{this.state[key]=v};
      this._on(el,"pointerdown",e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);set(true);navigator.vibrate?.(10)},{passive:false});
      this._on(el,"pointerup",e=>{e.preventDefault();set(false)},{passive:false});
      this._on(el,"pointercancel",()=>set(false));
      this._on(el,"lostpointercapture",()=>set(false));
      this._on(el,"contextmenu",e=>e.preventDefault());
    }
  }
  bindFreeCamLook(){
    let dragging=false,lastX=0,lastY=0;
    this._on(this.canvas,"pointerdown",e=>{
      if(!this.freeCam)return;
      dragging=true;lastX=e.clientX;lastY=e.clientY;
      this.canvas.setPointerCapture?.(e.pointerId);
    });
    this._on(this.canvas,"pointermove",e=>{
      if(!dragging||!this.freeCam||!this.cameraProxy)return;
      const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
      this.cameraProxy.orbitYaw-=dx*.004;
      this.cameraProxy.orbitPitch=Math.max(-.25,Math.min(.7,this.cameraProxy.orbitPitch-dy*.003));
    });
    const stop=()=>dragging=false;
    this._on(this.canvas,"pointerup",stop);
    this._on(this.canvas,"pointercancel",stop);
    this._on(this.canvas,"lostpointercapture",stop);
  }
}
