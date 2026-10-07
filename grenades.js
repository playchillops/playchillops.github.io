/** Purchased cartoon grenades. Requires THREE and game's hitscan.raycast.
 * createGrenades(THREE,{scene,map,colliders,raycast,destruction,economy?,getTargets?,
 * onDamage(target,amount,meta),onFlash(target,seconds,meta),onEvent,authority:true})
 * throwGrenade(type,{position,direction,charge|speed,owner,team,consume:true}), update(dt),
 * blocksSight(a,b), smokeDensity(eye), view(camera,avatars), preview(on,{type,position,direction,charge}),
 * flashStrength(eye,forward), getEvents(afterSeq), applyEvent(e), clearRound(), reset(matchId), dispose().
 * Fixed 1/120 step, swept collisions (simulateFlight: the SAME code runs on the server to know where smokes land).
 * Server AUTHORITATIVE detonation events, not floating-point lockstep. Replicas never deal damage.
 * 2026-10-06 (Juan): smoke = big opaque CS-style cloud (~5 m, 18 s) you cannot see through, from inside or outside;
 * frag = much bigger explosion (fireball, shockwave, debris, smoke, scorch) with a 2x radius; hold V/H/J to throw farther.
 */
export const GRENADE_ITEMS=Object.freeze({
 frag:{name:'Spicy Pebble',price:300,category:4,desc:'Confetti frag · big blast · max 1'},
 smoke:{name:'Pocket Cloud',price:300,category:4,desc:'Thick smoke for 18 s · max 1'},
 flash:{name:'Disco Blink',price:200,category:4,desc:'Cartoon flash · max 2'}
});
export const GRENADE_CONFIG=Object.freeze({frag:{fuse:1.6,radius:10,damage:150},smoke:{fuse:1.8,radius:5,height:3.2,duration:18},flash:{fuse:1.25,radius:14,duration:2.5}});
// hold to throw farther: a tap lobs it (speed 9, ~9 m), a full ~1 s hold throws it ~2.2x as far (speed 17, ~19 m); 0.4 = the old fixed throw
export const THROW={min:9,max:17,lift:2.2,tap:.15,full:1};
export const chargeOf=(heldSeconds)=>Math.max(0,Math.min(1,(heldSeconds-THROW.tap)/(THROW.full-THROW.tap)));
export function throwVelocity(direction,charge=.4){const l=Math.hypot(direction.x,direction.y,direction.z)||1,c=Math.max(0,Math.min(1,Number.isFinite(charge)?charge:.4)),s=THROW.min+(THROW.max-THROW.min)*c;return{x:direction.x/l*s,y:direction.y/l*s+THROW.lift,z:direction.z/l*s};}
const v=p=>({x:p.x,y:p.y,z:p.z}),valid=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])),copy=o=>JSON.parse(JSON.stringify(o));
const STEP=1/120;
/** one physics step on a plain body {p,vel,resting} (gravity, swept bounce, floor). Shared by client sim, preview and server. */
export function stepBody(g,raycast,colliders,dt=STEP){
 if(g.resting)return;
 g.vel.y-=18*dt;const mx=g.vel.x*dt,my=g.vel.y*dt,mz=g.vel.z*dt,dist=Math.hypot(mx,my,mz);
 const hit=dist>1e-9?raycast(v(g.p),{x:mx,y:my,z:mz},{colliders,maxDistance:dist+.13}):null;
 if(hit){let nx=hit.normal.x,ny=hit.normal.y,nz=hit.normal.z;if(nx*nx+ny*ny+nz*nz<.1){nx=-mx/dist;ny=-my/dist;nz=-mz/dist;}
  g.p.x=hit.point.x+nx*.135;g.p.y=hit.point.y+ny*.135;g.p.z=hit.point.z+nz*.135;const d=g.vel.x*nx+g.vel.y*ny+g.vel.z*nz;
  g.vel.x=(g.vel.x-1.48*d*nx)*.72;g.vel.y=(g.vel.y-1.48*d*ny)*.72;g.vel.z=(g.vel.z-1.48*d*nz)*.72;
  if(ny>.6&&Math.hypot(g.vel.x,g.vel.y,g.vel.z)<1.2){g.vel.x=g.vel.y=g.vel.z=0;g.resting=true;}}
 else{g.p.x+=mx;g.p.y+=my;g.p.z+=mz;}
 if(g.p.y<.13){g.p.y=.13;g.vel.y=Math.abs(g.vel.y)*.3;g.vel.x*=.7;g.vel.z*=.7;if(Math.hypot(g.vel.x,g.vel.y,g.vel.z)<1.2){g.vel.x=g.vel.y=g.vel.z=0;g.resting=true;}}
}
/** where a grenade thrown from `position` with `velocity` is after `time` s (server: smoke landing spot for bot line of sight) */
export function simulateFlight(position,velocity,{raycast,colliders=[],time=1.6,dt=STEP,points=null,every=6}={}){
 const g={p:v(position),vel:v(velocity),resting:false},n=Math.round(time/dt);
 for(let i=0;i<n;i++){stepBody(g,raycast,colliders,dt);if(points&&i%every===0)points.push(v(g.p));if(g.resting&&points)break;}
 return{position:g.p,resting:g.resting};
}
/** does segment a-b pass through an ellipsoid smoke (center c, radii r horizontally, h vertically, scaled by k)? */
export function segmentInSmoke(a,b,c,r,h){
 const sy=r/h,ax=a.x-c.x,ay=(a.y-c.y)*sy,az=a.z-c.z,dx=b.x-a.x,dy=(b.y-a.y)*sy,dz=b.z-a.z,L=dx*dx+dy*dy+dz*dz;
 const t=L?Math.max(0,Math.min(1,-(ax*dx+ay*dy+az*dz)/L)):0,px=ax+dx*t,py=ay+dy*t,pz=az+dz*t;return px*px+py*py+pz*pz<r*r;
}
export function createGrenades(THREE,o={}){
 if(!o.scene||typeof o.raycast!=='function')throw new TypeError('scene and raycast required');
 let disposed=false,seq=0,serial=0,epoch=String(o.matchId??'match-1'),accum=0,clock=0;
 const authority=o.authority!==false,active=[],clouds=[],flashes=[],events=[],bursts=[],blasts=[],scorches=[];
 const group=new THREE.Group();group.name='cartoon grenade effects';o.scene.add(group);
 const body=new THREE.SphereGeometry(.13,10,7),cap=new THREE.BoxGeometry(.08,.07,.08),puff=new THREE.IcosahedronGeometry(1,1),puffHi=new THREE.IcosahedronGeometry(1,2),ball=new THREE.SphereGeometry(1,20,14),cube=new THREE.BoxGeometry(1,1,1),ringG=new THREE.RingGeometry(.86,1,48),discG=new THREE.CircleGeometry(1,28);
 ringG.rotateX(-Math.PI/2);discG.rotateX(-Math.PI/2);
 const mats={frag:new THREE.MeshLambertMaterial({color:0xffb094}),smoke:new THREE.MeshLambertMaterial({color:0xb8e9e1}),flash:new THREE.MeshLambertMaterial({color:0xffe6a6})};
 const grey=new THREE.MeshLambertMaterial({color:0x6e8192});
 const burstMat=new THREE.MeshBasicMaterial({color:0xffd7a8,transparent:true,opacity:.6,depthWrite:false});
 // toon steps for the smoke (3 bands like the characters), opaque: nothing shows through
 const grad=new THREE.DataTexture(new Uint8Array([150,205,255]),3,1,THREE.RedFormat);grad.minFilter=grad.magFilter=THREE.NearestFilter;grad.needsUpdate=true;
 const smokeMat=new THREE.MeshToonMaterial({color:0xffffff,gradientMap:grad,emissive:0x2b3236});
 const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_e=new THREE.Euler(),_c=new THREE.Color();
 const rnd=(a,b)=>a+Math.random()*(b-a),ease=(t)=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3),back=(t)=>{t=Math.max(0,Math.min(1,t));const c=1.5;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
 function publish(e){events.push(copy(e));o.onEvent?.(copy(e));return copy(e);}
 function mesh(type){const g=new THREE.Group(),m=new THREE.Mesh(body,mats[type]),c=new THREE.Mesh(cap,grey);g.add(m,c);c.position.y=.16;group.add(g);return g;}
 function spawn(e){const m=mesh(e.grenade);m.position.set(e.position.x,e.position.y,e.position.z);active.push({id:e.id,type:e.grenade,owner:e.owner,team:e.team,m,p:v(e.position),vel:v(e.velocity),age:0,resting:false});}
 function throwGrenade(type,{position,direction,speed,charge,owner='player',team='T',consume=true}={}){
  if(disposed||!authority||!GRENADE_CONFIG[type]||!valid(position)||!valid(direction))return false;
  const length=Math.hypot(direction.x,direction.y,direction.z);if(length<1e-8)return false;
  if(consume&&(!o.economy||!o.economy.consumeGrenade(type)))return false;
  const vel=Number.isFinite(speed)&&speed>0&&charge==null?{x:direction.x/length*speed,y:direction.y/length*speed+THROW.lift,z:direction.z/length*speed}:throwVelocity(direction,charge);
  const e={version:1,type:'throw',epoch,seq:++seq,id:`${epoch}-g${++serial}`,grenade:type,owner:String(owner),team:String(team),position:v(position),velocity:vel};
  spawn(e);return publish(e);
 }
 const sight=(a,b)=>{const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},distance=Math.hypot(d.x,d.y,d.z);return distance<.2||!o.raycast(a,d,{colliders:o.colliders||[],maxDistance:distance-.15});};

 // ---------------------------------------------------------------- smoke: one InstancedMesh per cloud (core ellipsoid + 70 puffs)
 const PUFFS=72;
 function makeSmoke(p){
  const cfg=GRENADE_CONFIG.smoke,R=cfg.radius,H=cfg.height,im=new THREE.InstancedMesh(ball,smokeMat,PUFFS);im.frustumCulled=false;im.renderOrder=1;
  const center={x:p.x,y:p.y+1.0,z:p.z},puffs=[];
  // instance 0 = the core (guarantees no see-through gaps); the rest sit on the ellipsoid shell and poke out = billowy silhouette
  puffs.push({x:0,y:0,z:0,s:[R*.9,H*.88,R*.9],d:0,ph:0,c:0xdfe6e6});
  for(let i=1;i<PUFFS;i++){const k=i/(PUFFS-1),y=1-k*1.25,rr=Math.sqrt(Math.max(0,1-y*y)),a=i*2.399963,yy=Math.max(-.45,y);
   const sc=rnd(1.25,2.1)*(yy<-.2?1.15:1);puffs.push({x:Math.cos(a)*rr*R*.84,y:yy*H*.84,z:Math.sin(a)*rr*R*.84,s:[sc,sc*rnd(.85,1),sc],d:rnd(0,.45),ph:rnd(0,6.28),c:[0xdfe5e4,0xeef1f0,0xd6dddd,0xf6f7f5,0xcdd6d7][i%5]});}
  for(let i=0;i<PUFFS;i++){_c.setHex(puffs[i].c);im.setColorAt(i,_c);}
  im.position.set(center.x,center.y,center.z);group.add(im);
  const c={position:center,radius:R,height:H,left:cfg.duration,age:0,im,puffs,k:0};clouds.push(c);updateSmoke(c,0);return c;
 }
 function updateSmoke(c,dt){
  c.age+=dt;c.left-=dt;const dur=GRENADE_CONFIG.smoke.duration,out=Math.max(0,Math.min(1,c.left/2.6));   // last 2.6 s: puffs shrink away
  c.k=Math.min(ease(c.age/1.1),out);   // occlusion strength follows the visuals
  for(let i=0;i<c.puffs.length;i++){const P=c.puffs[i],g=back((c.age-P.d)/1.2),f=i===0?Math.min(ease(c.age/1.4),out):Math.min(g,Math.max(0,Math.min(1,(c.left-(P.d*3))/2.2))),br=1+.05*Math.sin(clock*.8+P.ph),rise=(1-out)*1.2;
   const sp=i===0?1:.25+.75*Math.min(1,g);_p.set(P.x*sp,P.y*sp+rise+(1-Math.min(1,g))*-.6,P.z*sp);_e.set(0,P.ph+clock*.05,0);_q.setFromEuler(_e);
   _s.set(P.s[0]*f*br,P.s[1]*f*br,P.s[2]*f*br);if(f<=.001)_s.set(1e-4,1e-4,1e-4);_m.compose(_p,_q,_s);c.im.setMatrixAt(i,_m);}
  c.im.instanceMatrix.needsUpdate=true;
 }
 // ---------------------------------------------------------------- frag: fireball, fire + smoke puffs, shockwave, confetti debris, scorch (6 draw calls)
 function makeBlast(p,rest){
  const R=GRENADE_CONFIG.frag.radius,g=new THREE.Group();g.position.set(p.x,p.y,p.z);group.add(g);
  // opaque cartoon shapes that grow and shrink (the outline post-pass draws over transparent effects, which looked dirty)
  const coreM=new THREE.MeshBasicMaterial({color:0xfff1b0}),core=new THREE.Mesh(ball,coreM);g.add(core);
  const fireM=new THREE.MeshBasicMaterial({color:0xffffff}),fire=new THREE.InstancedMesh(ball,fireM,18);fire.frustumCulled=false;g.add(fire);
  const smokeM=new THREE.MeshToonMaterial({color:0xffffff,gradientMap:grad}),smk=new THREE.InstancedMesh(ball,smokeM,20);smk.frustumCulled=false;g.add(smk);
  const ringM=new THREE.MeshBasicMaterial({color:0xfff6d8,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}),ring=new THREE.Mesh(ringG,ringM);ring.position.y=.12;g.add(ring);
  const debM=new THREE.MeshLambertMaterial({color:0xffffff}),deb=new THREE.InstancedMesh(cube,debM,22);deb.frustumCulled=false;g.add(deb);
  const fp=[],sp=[],dp=[];
  // fire: a lumpy fireball bursting out of a white-hot core (yellow inside, orange / red outside)
  for(let i=0;i<18;i++){const a=rnd(0,6.28),up=rnd(.1,1),s=rnd(7,13),hot=i<6;fp.push({v:[Math.cos(a)*s*(1-up*.55),up*s*.75+2.5,Math.sin(a)*s*(1-up*.55)],p:[0,.3,0],s:hot?rnd(1.3,1.7):rnd(.9,1.35)});_c.setHex(hot?[0xffc21a,0xffd84a][i%2]:[0xff7a00,0xff5200,0xff9900,0xe8341c][i%4]);fire.setColorAt(i,_c);}
  // smoke: a ring rolling out along the ground + a column going up, small puffs (one big blob read as a boulder)
  for(let i=0;i<20;i++){const a=rnd(0,6.28),col=i>=12,s=col?rnd(.6,1.8):rnd(5,8.5);sp.push({v:[Math.cos(a)*s,col?rnd(3.5,6.5):rnd(.3,1.4),Math.sin(a)*s],p:[0,col?1:.4,0],s:col?rnd(.75,1.05):rnd(.55,.85),d:rnd(.1,.32)});_c.setHex([0x5c5753,0x6c6560,0x7a726c,0x504b48][i%4]);smk.setColorAt(i,_c);}
  for(let i=0;i<22;i++){const a=rnd(0,6.28),s=rnd(6,15);dp.push({v:[Math.cos(a)*s,rnd(4,11),Math.sin(a)*s],p:[0,.3,0],r:[rnd(0,6),rnd(0,6),rnd(0,6)],w:[rnd(-12,12),rnd(-12,12),rnd(-12,12)],s:rnd(.1,.26),stop:false});_c.setHex([0xff6b9d,0xffd166,0x7fe3ff,0x7dffb0,0x5a4a3a,0x3b3330][i%6]);deb.setColorAt(i,_c);}
  blasts.push({g,core,coreM,fire,fireM,smk,smokeM,ring,ringM,deb,debM,fp,sp,dp,t:0,R});
  if(rest){const sm=new THREE.MeshBasicMaterial({color:0x1d1612,transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),sc=new THREE.Mesh(discG,sm);sc.position.set(p.x,p.y-.11,p.z);sc.scale.setScalar(2.6);sc.rotation.y=rnd(0,6);group.add(sc);scorches.push({m:sc,mat:sm,left:14});}
 }
 function updateBlast(b,dt){
  b.t+=dt;const t=b.t,R=b.R;
  const cs=t<.09?ease(t/.09)*1.9:1.9*(1-ease((t-.09)/.28));b.core.scale.setScalar(Math.max(1e-4,cs));b.coreM.color.setHex(t<.06?0xfff6c8:t<.16?0xffe066:0xffb020);
  for(let i=0;i<b.fp.length;i++){const f=b.fp[i],drag=Math.exp(-4*t);_p.set(f.v[0]*(1-drag)/4,.3+f.v[1]*(1-drag)/4+t*1.2,f.v[2]*(1-drag)/4);const s=f.s*(.45+ease(t/.22)*1.35)*(1-ease(Math.max(0,Math.min(1,(t-.25)/.55))));_s.setScalar(Math.max(1e-4,s));_q.identity();_m.compose(_p,_q,_s);b.fire.setMatrixAt(i,_m);}
  b.fire.instanceMatrix.needsUpdate=true;
  for(let i=0;i<b.sp.length;i++){const f=b.sp[i],tt=Math.max(0,t-f.d),drag=Math.exp(-2.2*tt);_p.set(f.v[0]*(1-drag)/2.2,f.p[1]+f.v[1]*(1-drag)/2.2+tt*.7,f.v[2]*(1-drag)/2.2);const s=tt<=0?1e-4:f.s*(.4+ease(tt/.6)*1.2+tt*.35)*(1-ease(Math.max(0,Math.min(1,(tt-1.0)/1.25))));_s.setScalar(Math.max(1e-4,s));_q.identity();_m.compose(_p,_q,_s);b.smk.setMatrixAt(i,_m);}
  b.smk.instanceMatrix.needsUpdate=true;
  const rs=.5+ease(t/.38)*R*1.05;b.ring.scale.set(rs,1,rs);b.ringM.opacity=Math.max(0,.85*(1-t/.5));
  for(let i=0;i<b.dp.length;i++){const d=b.dp[i];if(!d.stop){d.v[1]-=20*dt;d.p[0]+=d.v[0]*dt;d.p[1]+=d.v[1]*dt;d.p[2]+=d.v[2]*dt;d.r[0]+=d.w[0]*dt;d.r[1]+=d.w[1]*dt;d.r[2]+=d.w[2]*dt;if(d.p[1]<.05){d.p[1]=.05;d.v[1]*=-.35;d.v[0]*=.5;d.v[2]*=.5;if(Math.abs(d.v[1])<1)d.stop=true;}}
   _p.set(d.p[0],d.p[1],d.p[2]);_e.set(d.r[0],d.r[1],d.r[2]);_q.setFromEuler(_e);const s=d.s*(t>2.2?Math.max(0,1-(t-2.2)/.6):1);_s.set(s,s*.6,s*1.3);if(s<=0)_s.setScalar(1e-4);_m.compose(_p,_q,_s);b.deb.setMatrixAt(i,_m);}
  b.deb.instanceMatrix.needsUpdate=true;
  return t<2.9;
 }
 function disposeBlast(b){b.g.removeFromParent();for(const m of [b.coreM,b.fireM,b.smokeM,b.ringM,b.debM])m.dispose();for(const m of [b.fire,b.smk,b.deb])m.dispose?.();}

 function effect(e){const cfg=GRENADE_CONFIG[e.grenade],p=e.position;
  if(e.grenade==='smoke')makeSmoke(p);
  else if(e.grenade==='flash'){flashes.push({position:v(p),left:.28,radius:cfg.radius});const m=new THREE.Mesh(puff,burstMat);m.position.set(p.x,p.y,p.z);group.add(m);bursts.push({m,left:.4,max:.4});}
  else makeBlast(p,!!e.rest);
  if(!authority)return;
  const targets=o.getTargets?.()||[];
  // Calculate shelter BEFORE geometry is destroyed, so blast damage stays coherent. Damage falls off with distance (full at the centre).
  for(const target of targets){if(target.alive===false||target.health<=0)continue;const q=target.eye||{x:target.position.x,y:target.position.y+(target.height??1.8)*.6,z:target.position.z};const dist=Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z);if(dist>cfg.radius)continue;
   if(e.grenade==='frag'){const sheltered=!sight(p,q),k=Math.pow(1-dist/cfg.radius,1.25);o.onDamage?.(target,Math.round(cfg.damage*k*(sheltered?.25:1)),{source:'frag',owner:e.owner,team:e.team,position:v(p)});}
   if(e.grenade==='flash'&&sight(p,q)){
    const facing=target.forward?Math.max(0,(target.forward.x*(p.x-q.x)+target.forward.y*(p.y-q.y)+target.forward.z*(p.z-q.z))/Math.max(.01,dist)):1;
    o.onFlash?.(target,cfg.duration*(1-dist/cfg.radius)*(.2+.8*facing),{owner:e.owner,position:v(p)});
   }
  }
  if(e.grenade==='frag')o.destruction?.damage(p,Math.min(cfg.radius,7),cfg.damage,{source:'frag'});
 }
 function detonate(g){const e={version:1,type:'detonate',epoch,seq:++seq,id:g.id,grenade:g.type,owner:g.owner,team:g.team,position:v(g.p),rest:!!g.resting};effect(e);publish(e);}
 function step(){
  for(let i=active.length-1;i>=0;i--){const g=active[i];g.age+=STEP;
   stepBody(g,o.raycast,o.colliders||[]);const sp=Math.hypot(g.vel.x,g.vel.y,g.vel.z);
   g.m.position.set(g.p.x,g.p.y,g.p.z);g.m.rotation.x+=STEP*sp;g.m.rotation.z+=STEP*2;
   if(authority&&g.age>=GRENADE_CONFIG[g.type].fuse){detonate(g);g.m.removeFromParent();active.splice(i,1);}
  }
 }
 function update(dt){if(disposed||!Number.isFinite(dt)||dt<=0)return;clock+=dt;accum+=Math.min(dt,.25);while(accum>=STEP){step();accum-=STEP;}
  for(let i=clouds.length-1;i>=0;i--){const c=clouds[i];updateSmoke(c,dt);if(c.left<=0){c.im.removeFromParent();c.im.dispose?.();clouds.splice(i,1);}}
  for(let i=flashes.length-1;i>=0;i--){flashes[i].left-=dt;if(flashes[i].left<=0)flashes.splice(i,1);}
  for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.left-=dt;b.m.scale.setScalar(.2+(1-b.left/b.max)*3);if(b.left<=0){b.m.removeFromParent();bursts.splice(i,1);}}
  for(let i=blasts.length-1;i>=0;i--)if(!updateBlast(blasts[i],dt)){disposeBlast(blasts[i]);blasts.splice(i,1);}
  for(let i=scorches.length-1;i>=0;i--){const s=scorches[i];s.left-=dt;s.mat.opacity=.6*Math.min(1,s.left/3);if(s.left<=0){s.m.removeFromParent();s.mat.dispose();scorches.splice(i,1);}}
 }
 function clear(){active.forEach(g=>g.m.removeFromParent());clouds.forEach(c=>{c.im.removeFromParent();c.im.dispose?.();});bursts.forEach(b=>b.m.removeFromParent());blasts.forEach(disposeBlast);scorches.forEach(s=>{s.m.removeFromParent();s.mat.dispose();});
  active.length=clouds.length=flashes.length=bursts.length=blasts.length=scorches.length=0;accum=0;if(fog)fog.style.opacity='0';}
 function clearRound(){if(disposed)return false;clear();if(authority)publish({version:1,type:'clear',epoch,seq:++seq});return true;}
 function applyEvent(e){if(disposed||authority||e?.version!==1||e.epoch!==epoch||e.seq!==seq+1)return false;
  if(e.type==='throw'){if(!GRENADE_CONFIG[e.grenade]||!valid(e.position)||!valid(e.velocity)||typeof e.id!=='string')return false;spawn(e);}
  else if(e.type==='detonate'){if(!GRENADE_CONFIG[e.grenade]||!valid(e.position))return false;const i=active.findIndex(g=>g.id===e.id);if(i>=0){active[i].m.removeFromParent();active.splice(i,1);}effect(e);}
  else if(e.type==='clear')clear();else if(e.type==='reset'&&typeof e.nextEpoch==='string'){clear();epoch=e.nextEpoch;}else return false;seq=e.seq;events.push(copy(e));return true;
 }
 // smoke occlusion (scaled by how grown / dissipated the cloud is)
 function blocksSight(a,b){if(!valid(a)||!valid(b))return false;return clouds.some(c=>c.k>.35&&segmentInSmoke(a,b,c.position,c.radius*c.k*.96,c.height*c.k*.96));}
 /** 0..1: how deep the eye is inside a smoke (1 = nothing visible) */
 function smokeDensity(eye){let d=0;for(const c of clouds){if(c.k<=.05)continue;const R=c.radius*c.k,H=c.height*c.k,dx=(eye.x-c.position.x)/R,dy=(eye.y-c.position.y)/H,dz=(eye.z-c.position.z)/R,n=Math.sqrt(dx*dx+dy*dy+dz*dz);if(n<1.08)d=Math.max(d,Math.min(1,(1.08-n)/.35));}return d;}
 // full-screen fog while your camera is inside a cloud (the puffs' back faces are culled, so from inside you would see out)
 let fog=null;if(o.overlay!==false&&typeof document!=='undefined'){fog=document.createElement('div');fog.style.cssText='position:fixed;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .12s;background:radial-gradient(ellipse at 50% 55%,#e6ecec 0%,#d3dcdd 55%,#bfcacd 100%)';(o.root||document.body).appendChild(fog);}
 /** call once per frame before render: fog overlay + hide avatars that are inside or behind a smoke */
 function view(camera,avatars){
  const eye=camera.position,d=smokeDensity(eye);if(fog){const op=d<=0?0:Math.min(1,.25+d*1.1);if(Math.abs(+fog.style.opacity-op)>.01)fog.style.opacity=String(op);}
  if(!clouds.length||!avatars)return d;
  for(const b of avatars){const gr=b.group||b;if(!gr||!gr.visible)continue;const p=gr.position,head={x:p.x,y:p.y+1.6,z:p.z},chest={x:p.x,y:p.y+1.0,z:p.z};if(blocksSight(eye,head)&&blocksSight(eye,chest))gr.visible=false;}
  return d;
 }
 // ---------------------------------------------------------------- aim preview while charging: dotted arc + landing ring
 const pvGeo=new THREE.BufferGeometry(),pvPos=new Float32Array(3*64);pvGeo.setAttribute('position',new THREE.BufferAttribute(pvPos,3));pvGeo.setDrawRange(0,0);
 const pvMat=new THREE.PointsMaterial({color:0xffffff,size:.16,transparent:true,opacity:.95,depthWrite:false,depthTest:false}),pv=new THREE.Points(pvGeo,pvMat);pv.frustumCulled=false;pv.visible=false;group.add(pv);
 const landM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}),land=new THREE.Mesh(ringG,landM);land.visible=false;group.add(land);
 let pvT=0;
 function preview(on,{type='frag',position,direction,charge=0}={}){
  pv.visible=land.visible=!!on;if(!on||!valid(position)||!valid(direction))return;
  if(clock-pvT<1/30)return;pvT=clock;   // 30 Hz is plenty
  const pts=[],cfg=GRENADE_CONFIG[type]||GRENADE_CONFIG.frag,r=simulateFlight(position,throwVelocity(direction,charge),{raycast:o.raycast,colliders:o.colliders||[],time:cfg.fuse,dt:1/60,points:pts,every:3});
  const n=Math.min(64,pts.length);for(let i=0;i<n;i++){pvPos[i*3]=pts[i].x;pvPos[i*3+1]=pts[i].y;pvPos[i*3+2]=pts[i].z;}pvGeo.setDrawRange(1,Math.max(0,n-1));pvGeo.attributes.position.needsUpdate=true;
  const col={frag:0xff9a5c,smoke:0xd5e2df,flash:0xffe066}[type]||0xffffff;pvMat.color.setHex(col);landM.color.setHex(col);
  land.position.set(r.position.x,r.position.y-.08,r.position.z);const rs=(type==='smoke'?cfg.radius*.5:type==='frag'?1.4:1)*(1+.08*Math.sin(clock*8));land.scale.set(rs,1,rs);
 }
 return {throwGrenade,update,applyEvent,clearRound,blocksSight,smokeDensity,view,preview,group,setEconomy(economy){o.economy=economy;},
  flashStrength(eye,forward){if(!valid(eye))return 0;let s=0;for(const f of flashes){const d=Math.hypot(f.position.x-eye.x,f.position.y-eye.y,f.position.z-eye.z);if(d<f.radius&&sight(eye,f.position)){const facing=valid(forward)?Math.max(0,(forward.x*(f.position.x-eye.x)+forward.y*(f.position.y-eye.y)+forward.z*(f.position.z-eye.z))/Math.max(.01,d)):1;s=Math.max(s,(1-d/f.radius)*(.2+.8*facing));}}return s;},
  reset(matchId){if(!authority||disposed)return false;const e={version:1,type:'reset',epoch,seq:++seq,nextEpoch:String(matchId??epoch+'-next')};clear();publish(e);epoch=e.nextEpoch;return e;},
  getState:()=>({epoch,seq,active:active.map(g=>({id:g.id,type:g.type,position:v(g.p),age:g.age})),clouds:clouds.length,blasts:blasts.length}),getEvents:(afterSeq=0)=>copy(events.filter(e=>e.seq>afterSeq)),
  dispose(){if(disposed)return;clear();disposed=true;group.removeFromParent();fog?.remove();for(const g of [body,cap,puff,puffHi,ball,cube,ringG,discG,pvGeo])g.dispose();Object.values(mats).forEach(m=>m.dispose());grey.dispose();burstMat.dispose();smokeMat.dispose();grad.dispose();pvMat.dispose();landM.dispose();}
 };
}
export default createGrenades;
