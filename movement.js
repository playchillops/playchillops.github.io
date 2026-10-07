/** Sniper Chill movement - standalone ES module, no dependencies.
 * createController(colliders = [], options = {})
 * Colliders: {min:{x,y,z},max:{x,y,z}} / Three.Box3, or {center,size}.
 * Ramps: same bounds plus {type:'ramp',axis:'x'|'z',direction:1|-1}.
 * direction=1 rises toward max on that axis; -1 rises toward min.
 * position is FEET. Default floorY=0; pass null for maps with voids.
 * update(dt seconds, input?) returns state. Inputs: forward/right [-1,1],
 * jump/sprint/crouch booleans, lookX/lookY pixel deltas (positive down).
 * Keyboard: WASD/arrows, Space, Shift, C/Ctrl. Unlocked fallback: drag look.
 * connect(element) attaches input; requestPointerLock() is called by your UI
 * from a user gesture. Touch drag looks; movement can use setInput/virtual UI.
 * applyToCamera(Three camera) applies eye position + YXZ rotation.
 * Colliders array remains live. Call setColliders to replace it.
 */
const EPS = 1e-5;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
function bounds(c) {
  if (!c || c.enabled === false || c.solid === false) return null;
  if (c.min && c.max) return c;
  const p=c.center || c.position, s=c.size;
  if (!p || !s) return null;
  return {min:{x:p.x-s.x/2,y:p.y-s.y/2,z:p.z-s.z/2},max:{x:p.x+s.x/2,y:p.y+s.y/2,z:p.z+s.z/2}};
}
function surface(c,b,x,z) {
  if(c.type!=='ramp') return b.max.y;
  const a=c.axis==='x'?'x':'z', p=a==='x'?x:z;
  const t=clamp((p-b.min[a])/(b.max[a]-b.min[a] || 1),0,1);
  return b.min.y+(b.max.y-b.min.y)*(c.direction===-1?1-t:t);
}
function bottom(c,b,x,z) {
  if(c.type==='ramp'&&c.surfaceOnly) return surface(c,b,x,z)-(c.thickness??.18);
  return b.min.y;
}
export function createController(initialColliders=[], options={}) {
  let colliders=initialColliders;
  const opt={radius:.28,height:1.8,crouchHeight:1.12,eyeInset:.16,
    speed:4.6,sprintSpeed:7.2,crouchSpeed:2.45,acceleration:22,airAcceleration:5,
    friction:16,gravity:22,jumpSpeed:7.1,stepHeight:.32,snapDistance:.38,
    sensitivity:.0022,floorY:0,maxSlope:Math.PI/3,...options};
  const p={x:0,y:opt.floorY??0,z:0,...options.position};
  const v={x:0,y:0,z:0};
  let height=opt.height, eyeHeight=height-opt.eyeInset;
  let yaw=options.yaw||0,pitch=options.pitch||0,grounded=false,crouched=false;
  let jumpHeld=false,jumpBuffer=0,coyote=0,enabled=true,element=null,cleanup=()=>{};
  const held=new Set();
  let manual={forward:0,right:0,jump:false,sprint:false,crouch:false};
  const state={position:p,velocity:v,eye:{x:p.x,y:p.y+eyeHeight,z:p.z},yaw,pitch,
    grounded,crouched,height,speed:0,pointerLocked:false};
  function horizontalOverlap(b,x=p.x,z=p.z) {
    return x+opt.radius>b.min.x+EPS&&x-opt.radius<b.max.x-EPS&&
      z+opt.radius>b.min.z+EPS&&z-opt.radius<b.max.z-EPS;
  }
  function clearAt(y,h,x=p.x,z=p.z,except=null) {
    for(const c of colliders){const b=bounds(c);if(!b||c===except||!horizontalOverlap(b,x,z))continue;
      const top=surface(c,b,x,z);
      if(y<top-EPS&&y+h>bottom(c,b,x,z)+EPS)return false;
    }return true;
  }
  function support(x,z,fromY,maxRise=0) {
    let best=opt.floorY!==null&&opt.floorY<=fromY+maxRise+EPS?opt.floorY:-Infinity;
    for(const c of colliders){const b=bounds(c);if(!b||!horizontalOverlap(b,x,z))continue;
      const top=surface(c,b,x,z);
      if(c.type==='ramp'){
        const a=c.axis==='x'?'x':'z';
        if((b.max.y-b.min.y)/Math.max(EPS,b.max[a]-b.min[a])>Math.tan(opt.maxSlope))continue;
      }
      if(top<=fromY+maxRise+EPS&&top>best)best=top;
    }return best;
  }
  // jump pad under the feet: a solid box carrying pad={vy,dx,dz}; ladder: a non-solid volume with ladder=true (W up, S down)
  function padAt(x,z,y) {
    for(const c of colliders){if(!c||!c.pad||c.enabled===false)continue;const b=bounds(c);if(!b)continue;
      if(x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z&&Math.abs(b.max.y-y)<.04)return c.pad;}
    return null;
  }
  function onLadder(x,z,y) {
    for(const c of colliders){if(!c||!c.ladder||c.enabled===false||!c.min)continue;
      if(x+opt.radius>c.min.x&&x-opt.radius<c.max.x&&z+opt.radius>c.min.z&&z-opt.radius<c.max.z&&y>=c.min.y-.05&&y<c.max.y)return c;}
    return null;
  }
  function moveAxis(axis,delta,wasGrounded) {
    if(!delta)return;
    p[axis]+=delta;
    for(const c of colliders){const b=bounds(c);if(!b||!horizontalOverlap(b))continue;
      const top=surface(c,b,p.x,p.z);
      if(p.y>=top-EPS||p.y+height<=bottom(c,b,p.x,p.z)+EPS)continue;
      const rise=top-p.y;
      let stepAllowed=wasGrounded&&rise<=opt.stepHeight+EPS;
      if(c.type==='ramp'){
        const a=c.axis==='x'?'x':'z',slope=(b.max.y-b.min.y)/Math.max(EPS,b.max[a]-b.min[a]);
        // Tiny per-substep ramp ascent is continuous, not a box step.
        stepAllowed=slope<=Math.tan(opt.maxSlope)&&rise<=opt.stepHeight+Math.abs(delta)*slope+EPS&&(wasGrounded||v.y<=2);
      }
      if(stepAllowed&&clearAt(top,height,p.x,p.z,c)){p.y=top;continue;}
      const old=p[axis]-delta;
      p[axis]=old; const wasIn=horizontalOverlap(b); p[axis]=old+delta;
      if(wasIn||c.type==='ramp'){p[axis]=old;v[axis]=0;continue;} // already inside the footprint (ramp/deck edge): never teleport across it
      p[axis]=delta>0?b.min[axis]-opt.radius:b.max[axis]+opt.radius;
      v[axis]=0;
    }
  }
  function sync(){
    Object.assign(state,{yaw,pitch,grounded,crouched,height,speed:Math.hypot(v.x,v.z)});
    Object.assign(state.eye,{x:p.x,y:p.y+eyeHeight,z:p.z});
    return state;
  }
  function look(dx=0,dy=0){
    if(!enabled)return;
    yaw-=Number.isFinite(dx)?dx*opt.sensitivity:0;
    pitch=clamp(pitch-(Number.isFinite(dy)?dy*opt.sensitivity:0),-Math.PI/2+.02,Math.PI/2-.02);
    yaw=((yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
    sync();
  }
  function update(dt,input={}) {
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
    const i={...manual,...input};
    if(!enabled){v.x=v.z=0;return sync();}
    if(i.lookX||i.lookY)look(i.lookX,i.lookY);
    const keys={forward:(held.has('KeyW')||held.has('ArrowUp')?1:0)-(held.has('KeyS')||held.has('ArrowDown')?1:0),
      right:(held.has('KeyD')||held.has('ArrowRight')?1:0)-(held.has('KeyA')||held.has('ArrowLeft')?1:0)};
    const f=clamp((i.forward||0)+keys.forward,-1,1),r=clamp((i.right||0)+keys.right,-1,1);
    const jumping=!!i.jump||held.has('Space');
    if(jumping&&!jumpHeld)jumpBuffer=.12;
    jumpHeld=jumping;
    const wantsCrouch=!!i.crouch||held.has('ShiftLeft')||held.has('ShiftRight')||held.has('ControlLeft')||held.has('ControlRight')||held.has('KeyC');
    crouched=wantsCrouch||!clearAt(p.y,opt.height);
    height=crouched?opt.crouchHeight:opt.height;
    const sprint=false; // no sprint: Shift = crouch
    const speed=(crouched?opt.crouchSpeed:sprint?opt.sprintSpeed:opt.speed)*(i.knife?(opt.knifeSpeedMul||1.22):1)*clamp(Number.isFinite(i.speedMul)?i.speedMul:1,.2,3);   // speedMul: shared Ryzen Turbo / Quantum Dash power
    const len=Math.max(1,Math.hypot(f,r));
    const tx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)/len*speed;
    const tz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)/len*speed;
    const steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;
    for(let step=0;step<steps;step++){
      const floor=support(p.x,p.z,p.y,.025);
      if(v.y<=0&&p.y>=floor-EPS&&p.y-floor<=.025){p.y=floor;grounded=true;v.y=0;}
      if(grounded)coyote=.1;else coyote=Math.max(0,coyote-h);
      if(grounded&&v.y<=0){const pd=padAt(p.x,p.z,p.y);if(pd){v.y=pd.vy;v.x=pd.dx||0;v.z=pd.dz||0;grounded=false;coyote=0;jumpBuffer=0;}}
      if(jumpBuffer>0&&coyote>0){v.y=opt.jumpSpeed;grounded=false;coyote=0;jumpBuffer=0;}
      jumpBuffer=Math.max(0,jumpBuffer-h);
      const lad=onLadder(p.x,p.z,p.y);
      if(lad){ // climbing: forward input climbs, back goes down, no gravity; sideways/forward moves are slower (forward presses into the wall, over the top you walk off)
        const ca=1-Math.exp(-14*h);v.x+=(tx*.6-v.x)*ca;v.z+=(tz*.6-v.z)*ca;v.y=f>0?3.2:f<0?-3.2:0;
        moveAxis('x',v.x*h,false);moveAxis('z',v.z*h,false);
        const oy=p.y;p.y+=v.y*h;grounded=false;
        if(v.y<0){const fl=support(p.x,p.z,oy,.025);if(p.y<=fl){p.y=fl;v.y=0;grounded=true;}}
        else if(v.y>0){for(const c of colliders){const b=bounds(c);if(!b||!horizontalOverlap(b))continue;const bt=bottom(c,b,p.x,p.z);if(oy+height<=bt+EPS&&p.y+height>=bt){p.y=bt-height;v.y=0;}}}
        continue;
      }
      const wasGrounded=grounded;
      const accel=grounded?(f||r?opt.acceleration:opt.friction):opt.airAcceleration;
      const alpha=1-Math.exp(-accel*h);
      // flying (super trampoline launch): faster than 1.5x walk speed in the air -> no drag, input only nudges (stateless: same on client and server)
      if(!grounded&&Math.hypot(v.x,v.z)>opt.speed*1.5){v.x+=tx*.55*h;v.z+=tz*.55*h;}
      else{v.x+=(tx-v.x)*alpha;v.z+=(tz-v.z)*alpha;}
      moveAxis('x',v.x*h,wasGrounded);moveAxis('z',v.z*h,wasGrounded);
      const oldY=p.y;
      v.y-=opt.gravity*h;
      p.y+=v.y*h;grounded=false;
      if(v.y>0){
        for(const c of colliders){const b=bounds(c);if(!b||!horizontalOverlap(b))continue;
          {const bt=bottom(c,b,p.x,p.z);if(oldY+height<=bt+EPS&&p.y+height>=bt){p.y=bt-height;v.y=0;}}
        }
      }else{
        const floor=support(p.x,p.z,oldY,.025);
        if(p.y<=floor&&oldY>=floor-EPS){p.y=floor;v.y=0;grounded=true;}
        else if(wasGrounded&&oldY-floor<=opt.snapDistance&&oldY>=floor){p.y=floor;v.y=0;grounded=true;}
      }
    }
    eyeHeight+=(height-opt.eyeInset-eyeHeight)*(1-Math.exp(-18*dt));
    return sync();
  }
  function connect(el){
    cleanup();element=el;
    const doc=el.ownerDocument,win=doc.defaultView;
    let dragging=false,lastX=0,lastY=0,pointerId=null;
    const listeners=[];
    function on(target,type,fn,opts){target.addEventListener(type,fn,opts);listeners.push(()=>target.removeEventListener(type,fn,opts));}
    const isText=target=>target?.closest?.('input,textarea,select,[contenteditable="true"]');
    on(win,'keydown',e=>{if(!enabled||isText(e.target))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();held.add(e.code);});
    on(win,'keyup',e=>held.delete(e.code));
    const reset=()=>{held.clear();dragging=false;pointerId=null;manual.jump=false;};
    on(win,'blur',reset);on(doc,'visibilitychange',()=>{if(doc.hidden)reset();});
    on(doc,'pointerlockchange',()=>{state.pointerLocked=doc.pointerLockElement===el;dragging=false;});
    on(doc,'mousemove',e=>{if(doc.pointerLockElement===el)look(e.movementX,e.movementY);});
    on(el,'pointerdown',e=>{if(!enabled||doc.pointerLockElement===el||e.button!==0)return;dragging=true;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;el.setPointerCapture?.(e.pointerId);});
    on(el,'pointermove',e=>{if(!dragging||e.pointerId!==pointerId||doc.pointerLockElement===el)return;look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;});
    const stop=e=>{if(e.pointerId===pointerId){dragging=false;pointerId=null;}};
    on(el,'pointerup',stop);on(el,'pointercancel',stop);on(el,'lostpointercapture',stop);
    // Only cancel native touch scrolling on the play surface.
    on(el,'touchmove',e=>{if(dragging)e.preventDefault();},{passive:false});
    cleanup=()=>{reset();for(const remove of listeners)remove();if(doc.pointerLockElement===el)doc.exitPointerLock?.();state.pointerLocked=false;element=null;};
    return api;
  }
  const api={state,update,look,connect,
    setInput(input){manual={...manual,...input};},
    setColliders(next){colliders=next||[];},
    setSensitivity(v){if(Number.isFinite(v)&&v>0)opt.sensitivity=v;},
    setEnabled(value){enabled=!!value;if(!enabled){held.clear();manual={forward:0,right:0,jump:false,sprint:false,crouch:false};}},
    impulse(vel){if(!vel)return;v.x=Number.isFinite(vel.x)?vel.x:v.x;v.y=Number.isFinite(vel.y)?vel.y:v.y;v.z=Number.isFinite(vel.z)?vel.z:v.z;grounded=false;coyote=0;jumpBuffer=0;sync();},   // power launches (Starship)
        teleport(position,rotation={}){Object.assign(p,position);v.x=v.y=v.z=0;grounded=false;coyote=jumpBuffer=0;if(rotation.yaw!==undefined)yaw=rotation.yaw;if(rotation.pitch!==undefined)pitch=clamp(rotation.pitch,-1.55,1.55);sync();},
    getDirection(){const cp=Math.cos(pitch);return{x:-Math.sin(yaw)*cp,y:Math.sin(pitch),z:-Math.cos(yaw)*cp};},
    applyToCamera(camera){camera.position.set(state.eye.x,state.eye.y,state.eye.z);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0,'YXZ');},
    async requestPointerLock(){if(!element?.requestPointerLock)return false;try{await element.requestPointerLock();return element.ownerDocument.pointerLockElement===element;}catch{return false;}},
    exitPointerLock(){element?.ownerDocument.exitPointerLock?.();},
    dispose(){cleanup();enabled=false;}
  };
  sync();return api;
}
