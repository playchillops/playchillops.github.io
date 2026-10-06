/** Cartoon destruction. No dependencies or network. Factory receives game's THREE.
 * createDestruction(THREE,{scene,map,colliderArrays:[phys,world],onCollidersChanged,onEvent})
 * damage(pos,radius,amount,{source}), damageHit(hitscanHit,amount,{source}), reset(matchId)
 * update(dt), getState(), getEvents(afterSeq), applyEvent(event), register({...}), dispose().
 * Only reset at MATCH END, never round start. Structural floors/ramps remain intact.
 * Authority emits absolute-HP events; replicas applyEvent in sequence without simulating damage.
 */
const xyz=p=>({x:p.x,y:p.y,z:p.z}), valid=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const clone=v=>JSON.parse(JSON.stringify(v));
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
export function createDestruction(THREE,o={}){
 const {scene,map}=o;if(!scene||!map)throw new TypeError('scene and map required');
 let disposed=false,seq=0,epoch=String(o.matchId??'match-1'),navVersion=0;
 const pieces=new Map(),byCollider=new Map(),events=[],debris=[],owned=[],originals=[],extraProps=[];
 const arrays=[...new Set([map.colliders,map.physicsColliders,...(o.colliderArrays||[])].filter(Array.isArray))];
 const fx=new THREE.Group();fx.name='cartoon destruction debris';scene.add(fx);
 const cube=new THREE.BoxGeometry(1,1,1),palette=[0xffbaaa,0xa6eee4,0xffe5a9,0xd4c2f3,0xbde8bb];
 const materials=palette.map(color=>new THREE.MeshLambertMaterial({color,flatShading:true}));
 const bounds=m=>new THREE.Box3().setFromObject(m);
 const same=(a,b)=>a?.min&&a?.max&&['x','y','z'].every(k=>Math.abs(a.min[k]-b.min[k])<.025&&Math.abs(a.max[k]-b.max[k])<.025);
 function editCollider(c,active){for(const a of arrays){const i=a.indexOf(c);if(active&&i<0)a.push(c);else if(!active&&i>=0)a.splice(i,1);}}
 function rebuildNav(){const n=map.navGrid;if(n?.walkable&&n.height){const good=[];for(let r=0;r<n.rows;r++)for(let c=0;c<n.cols;c++){
   const i=r*n.cols+c,x=n.originX+(c+.5)*n.cellSize,z=n.originZ+(r+.5)*n.cellSize,y=n.height[i];
   n.walkable[i]=Number.isFinite(y)&&!(map.colliders||[]).some(b=>b.enabled!==false&&b.solid!==false&&b.min&&x>b.min.x-.45&&x<b.max.x+.45&&z>b.min.z-.45&&z<b.max.z+.45&&b.max.y>y+.5&&b.min.y<y+1.8)?1:0;
   if(n.walkable[i])good.push(i);
  }n.randomWalkable=()=>{if(!good.length)return null;const i=good[Math.floor(Math.random()*good.length)];return n.cellToWorld(i%n.cols,Math.floor(i/n.cols));};}
  navVersion++;o.onCollidersChanged?.({version:navVersion,colliderArrays:arrays,navGrid:map.navGrid});
 }
 function register({id,mesh,collider,hp=80,decor=[]}){
  if(disposed||!id||pieces.has(id)||!mesh||!collider||!Number.isFinite(hp)||hp<=0)throw new TypeError('Unique id, mesh, collider and positive HP required');
  collider.destructionId=id;const p={id,mesh,collider,hp,maxHP:hp,alive:true,visible:mesh.visible,decor,box:bounds(mesh),originalMaterial:mesh.material};
  const mat=mesh.material.clone();mesh.material=mat;owned.push(mat);p.material=mat;pieces.set(id,p);byCollider.set(collider,p);editCollider(collider,true);return id;
 }
 // Existing Kite Garden cover and nonstructural walls. Never break ground, ramps,
 // terrace slabs, roofs, perimeter or landmark buildings; they underpin navigation.
 // Add small breakable toy crates and slatted fence panels in clear lanes.
 if(o.addProps!==false)for(const [name,x,z,w,h,depth,color] of [
  ['crate',2,1,1.2,1.2,1.2,0xffc393],['crate',-2,-2,1.2,1.2,1.2,0xa6ded5],
  ['fence',-4,17,2.6,1.5,.16,0xffd7a7],['fence',3,-22,2.6,1.5,.16,0xb9e3d2]]){
  const b={min:{x:x-w/2,y:0,z:z-depth/2},max:{x:x+w/2,y:h,z:z+depth/2},name};
  if((map.colliders||[]).some(c=>c.min&&c.max&&b.min.x<c.max.x&&b.max.x>c.min.x&&b.min.z<c.max.z&&b.max.z>c.min.z&&b.max.y>c.min.y))continue;
  const material=new THREE.MeshLambertMaterial({color,flatShading:true}),mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),material);
  mesh.position.set(x,h/2,z);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;map.group.add(mesh);editCollider(b,true);extraProps.push({mesh,b,material});
 }
 map.group.updateMatrixWorld(true);
 const candidates=map.group.children.filter(m=>m.isMesh&&(/planter \/ cover|window left|window right|window sill|mid angle|connector elbow|crate|fence|wall panel/.test(m.name)||m.userData.destructible===true));
 candidates.forEach((mesh,index)=>{
  const b=bounds(mesh),size=b.getSize(new THREE.Vector3()),matching=arrays.flat().filter(c=>same(c,b));
  const unique=[...new Set(matching)];if(!unique.length)return;
  // Remove all source boxes, keeping references and array positions for disposal.
  const links=[];for(const a of arrays)for(const c of unique){const i=a.indexOf(c);if(i>=0){links.push({a,c,i});a.splice(i,1);}}
  const prev=mesh.visible;mesh.visible=false;
  const axis=size.x>=size.z?'x':'z',length=size[axis],nx=Math.max(1,Math.ceil(length/1.35));
  const container=new THREE.Group();container.name=mesh.name+' destructible panels';map.group.add(container);
  const isPlanter=/planter/.test(mesh.name),decor=isPlanter?map.group.children.filter(m=>m!==mesh&&m.isMesh&&m.position.x>=b.min.x-.15&&m.position.x<=b.max.x+.15&&m.position.z>=b.min.z-.15&&m.position.z<=b.max.z+.15&&m.position.y>=b.max.y-.2&&m.position.y<=b.max.y+.7).map(m=>({mesh:m,visible:m.visible})):[];
  const ids=[];for(let i=0;i<nx;i++){
   const lo=b.min.clone(),hi=b.max.clone();lo[axis]=b.min[axis]+length*i/nx;hi[axis]=b.min[axis]+length*(i+1)/nx;
   const s=hi.clone().sub(lo),m=new THREE.Mesh(new THREE.BoxGeometry(s.x,s.y,s.z),mesh.material);m.position.copy(lo.clone().add(hi).multiplyScalar(.5));m.castShadow=m.receiveShadow=true;container.add(m);
   const id=`kite-${index}-${mesh.name.replace(/[^a-z0-9]+/gi,'-')}-${i}`;ids.push(id);register({id,mesh:m,collider:{min:xyz(lo),max:xyz(hi),name:mesh.name},hp:isPlanter?70:110});
  }
  originals.push({mesh,prev,container,links,ids,decor});
 });
 function decorations(){for(const p of originals){const alive=p.ids.some(id=>pieces.get(id).alive);for(const d of p.decor)d.mesh.visible=alive&&d.visible;}}
 function burst(p,seed,point){const rnd=random(seed),center=p.box.getCenter(new THREE.Vector3()),size=p.box.getSize(new THREE.Vector3());
  const count=Math.min(22,Math.max(8,Math.round(size.x*size.y*size.z*6)));
  for(let i=0;i<count;i++){if(debris.length>=160){const d=debris.shift();fx.remove(d.mesh);}
   const m=new THREE.Mesh(cube,materials[Math.floor(rnd()*materials.length)]),s=.09+rnd()*.2;m.scale.set(s,s*(.35+rnd()),s);
   m.position.copy(center).add(new THREE.Vector3((rnd()-.5)*size.x,(rnd()-.5)*size.y,(rnd()-.5)*size.z));m.rotation.set(rnd()*6,rnd()*6,rnd()*6);
   const dx=m.position.x-point.x,dz=m.position.z-point.z,l=Math.hypot(dx,dz)||1;
   debris.push({mesh:m,v:new THREE.Vector3(dx/l*(2+rnd()*4),2+rnd()*5,dz/l*(2+rnd()*4)),spin:new THREE.Vector3(rnd()*5,rnd()*5,rnd()*5),life:2.5+rnd(),floor:Math.max(0,p.box.min.y)});fx.add(m);
  }
 }
 function applyHP(p,hp,e){const was=p.alive;p.hp=Math.max(0,Math.min(p.maxHP,hp));p.alive=p.hp>0;p.mesh.visible=p.alive&&p.visible;editCollider(p.collider,p.alive);
  p.material.color.copy(p.originalMaterial.color).multiplyScalar(.62+.38*p.hp/p.maxHP);
  if(was&&!p.alive)burst(p,e.seed,e.position);return was!==p.alive;
 }
 function emit(e){events.push(clone(e));o.onEvent?.(clone(e));return clone(e);}
 function commit(changes,position,source){if(!changes.length)return null;const e={version:1,type:'damage',epoch,seq:++seq,position:xyz(position),source,seed:hash(epoch+':'+seq),changes};
  let changed=false;for(const c of changes)changed=applyHP(pieces.get(c.id),c.hp,e)||changed;decorations();if(changed)rebuildNav();return emit(e);
 }
 function damage(position,radius,amount,{source='blast'}={}){if(disposed||!valid(position)||!Number.isFinite(radius)||radius<=0||!Number.isFinite(amount)||amount<=0)return null;
  const changes=[];for(const p of pieces.values()){if(!p.alive)continue;const distance=p.box.distanceToPoint(new THREE.Vector3(position.x,position.y,position.z));if(distance>radius)continue;
   const loss=amount*Math.max(.15,1-distance/radius);changes.push({id:p.id,hp:Math.max(0,Math.round((p.hp-loss)*1000)/1000)});
  }return commit(changes,position,source);
 }
 function damageHit(hit,amount,{source='bullet'}={}){const p=byCollider.get(hit?.collider);if(disposed||!p?.alive||!valid(hit.point)||!Number.isFinite(amount)||amount<=0)return null;return commit([{id:p.id,hp:Math.max(0,p.hp-amount)}],hit.point,source);}
 function restore(){for(const p of pieces.values()){p.hp=p.maxHP;p.alive=true;p.mesh.visible=p.visible;p.material.color.copy(p.originalMaterial.color);editCollider(p.collider,true);}for(const d of debris)fx.remove(d.mesh);debris.length=0;decorations();rebuildNav();}
 function reset(matchId){if(disposed)return null;const e={version:1,type:'reset',epoch,seq:++seq,nextEpoch:String(matchId??epoch+'-next')};restore();emit(e);epoch=e.nextEpoch;return clone(e);}
 function applyEvent(e){if(disposed||e?.version!==1||e.epoch!==epoch||e.seq!==seq+1)return false;
  if(e.type==='damage'){if(!valid(e.position)||!Array.isArray(e.changes)||!e.changes.every(c=>pieces.has(c.id)&&Number.isFinite(c.hp)&&c.hp>=0&&c.hp<=pieces.get(c.id).maxHP))return false;let changed=false;for(const c of e.changes)changed=applyHP(pieces.get(c.id),c.hp,e)||changed;decorations();if(changed)rebuildNav();}
  else if(e.type==='reset'&&typeof e.nextEpoch==='string'){restore();epoch=e.nextEpoch;}else return false;
  seq=e.seq;events.push(clone(e));return true;
 }
 rebuildNav();
 return {damage,damageHit,reset,register,applyEvent,group:fx,
  getState:()=>({epoch,seq,navVersion,pieces:[...pieces.values()].map(p=>({id:p.id,hp:p.hp,maxHP:p.maxHP,alive:p.alive}))}),getEvents:(afterSeq=0)=>clone(events.filter(e=>e.seq>afterSeq)),
  update(dt){if(disposed||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);for(let i=debris.length-1;i>=0;i--){const d=debris[i];d.life-=dt;d.v.y-=14*dt;d.mesh.position.addScaledVector(d.v,dt);d.mesh.rotation.x+=d.spin.x*dt;d.mesh.rotation.y+=d.spin.y*dt;
   if(d.mesh.position.y<d.floor+.06){d.mesh.position.y=d.floor+.06;d.v.y=Math.abs(d.v.y)*.28;d.v.x*=.82;d.v.z*=.82;}if(d.life<.7)d.mesh.scale.multiplyScalar(Math.max(0,1-dt*3));if(d.life<=0){fx.remove(d.mesh);debris.splice(i,1);}}
  },dispose(){if(disposed)return;disposed=true;for(const p of pieces.values()){editCollider(p.collider,false);p.mesh.material=p.originalMaterial;}
   for(const a of originals){a.mesh.visible=a.prev;for(const d of a.decor)d.mesh.visible=d.visible;for(const l of a.links)if(!l.a.includes(l.c))l.a.splice(Math.min(l.i,l.a.length),0,l.c);a.container.traverse(m=>m.isMesh&&m.geometry.dispose());a.container.removeFromParent();}
   for(const p of extraProps){editCollider(p.b,false);p.mesh.removeFromParent();p.mesh.geometry.dispose();p.material.dispose();}fx.removeFromParent();cube.dispose();materials.forEach(m=>m.dispose());owned.forEach(m=>m.dispose());rebuildNav();
  }};
}
export default createDestruction;
