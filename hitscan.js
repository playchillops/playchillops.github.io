/** Dependency-free hitscan, plain {x,y,z} vectors.
 * raycast(origin,direction,{colliders=[],targets=[],maxDistance=1000,ignore=[]})
 * => null OR {kind:'world'|'target',distance,point,normal,collider?,target?,zone?}.
 * Direction is normalized internally; zero/invalid direction returns null.
 * Box colliders match movement.js: min/max (Three.Box3) or center/size.
 * Ramps: type:'ramp',axis:'x'|'z',direction:1|-1, matching movement.js.
 * Targets: {id,position:FEET,height:1.8,radius:.28,crouched?,alive?,health?}.
 * Automatic zones: spherical head, body box, two leg boxes. No Three imports.
 * Custom hitZones: {head: shape,body: shape,legs: shape} or array of
 * {zone:'head'|'body'|'legs',min,max} / {zone,center,radius} WORLD-space shapes.
 * Disabled/dead targets are skipped. ignore takes target refs or ids.
 * World occludes targets (including ties). No penetration.
 * rayAABB / raySphere are also exported for integration tests and utilities.
 */
const EPS=1e-8;
const add=(o,d,t)=>({x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t});
const valid=v=>v&&['x','y','z'].every(a=>Number.isFinite(v[a]));
function bounds(c){
  if(!c||c.enabled===false||c.solid===false)return null;
  if(c.min&&c.max)return c;
  const p=c.center||c.position,s=c.size;if(!p||!s)return null;
  return{min:{x:p.x-s.x/2,y:p.y-s.y/2,z:p.z-s.z/2},max:{x:p.x+s.x/2,y:p.y+s.y/2,z:p.z+s.z/2}};
}
/** direction must be unit length for distances in world units. */
export function rayAABB(origin,direction,box,maxDistance=Infinity){
  const b=bounds(box);if(!b||!valid(origin)||!valid(direction)||!valid(b.min)||!valid(b.max))return null;
  let near=-Infinity,far=Infinity,normal={x:0,y:0,z:0};
  for(const a of ['x','y','z']){
    if(Math.abs(direction[a])<EPS){if(origin[a]<b.min[a]||origin[a]>b.max[a])return null;continue;}
    let t1=(b.min[a]-origin[a])/direction[a],t2=(b.max[a]-origin[a])/direction[a];
    const n=direction[a]>0?-1:1;
    if(t1>t2)[t1,t2]=[t2,t1];
    if(t1>near){near=t1;normal={x:0,y:0,z:0};normal[a]=n;}
    far=Math.min(far,t2);if(near>far)return null;
  }
  const distance=Math.max(0,near);
  if(far<0||distance>maxDistance)return null;
  return{distance,point:add(origin,direction,distance),normal:near<0?{x:0,y:0,z:0}:normal};
}
export function raySphere(origin,direction,sphere,maxDistance=Infinity){
  const c=sphere.center||sphere.position,r=sphere.radius;
  if(!valid(c)||!valid(origin)||!valid(direction)||!Number.isFinite(r)||r<0)return null;
  const ox=origin.x-c.x,oy=origin.y-c.y,oz=origin.z-c.z;
  const a=direction.x**2+direction.y**2+direction.z**2;
  if(a<EPS)return null;
  const b=ox*direction.x+oy*direction.y+oz*direction.z,cc=ox**2+oy**2+oz**2-r*r;
  const discriminant=b*b-a*cc;if(discriminant<0)return null;
  const far=(-b+Math.sqrt(discriminant))/a;if(far<0)return null;
  const distance=cc<=0?0:(-b-Math.sqrt(discriminant))/a;if(distance>maxDistance)return null;
  const point=add(origin,direction,distance);
  const n=Math.hypot(point.x-c.x,point.y-c.y,point.z-c.z)||1;
  return{distance,point,normal:distance===0?{x:0,y:0,z:0}:{x:(point.x-c.x)/n,y:(point.y-c.y)/n,z:(point.z-c.z)/n}};
}
function rayRamp(o,d,c,maxDistance){
  const b=bounds(c);if(!b)return null;
  const a=c.axis==='x'?'x':'z',sign=c.direction===-1?-1:1;
  const slope=(b.max.y-b.min.y)/Math.max(EPS,b.max[a]-b.min[a])*sign;
  const intercept=sign===1?b.min.y-slope*b.min[a]:b.max.y-slope*b.min[a];
  // Intersect convex half-spaces: four sides, bottom, sloped top.
  const planes=[];
  for(const axis of ['x','z']){
    const n={x:0,y:0,z:0};n[axis]=1;planes.push([n,b.max[axis]]);
    const m={x:0,y:0,z:0};m[axis]=-1;planes.push([m,-b.min[axis]]);
  }
  if(c.surfaceOnly){const bottom={x:0,y:-1,z:0};bottom[a]=slope;planes.push([bottom,-intercept+(c.thickness??.18)]);}
  else planes.push([{x:0,y:-1,z:0},-b.min.y]);
  const top={x:0,y:1,z:0};top[a]=-slope;planes.push([top,intercept]);
  let near=0,far=maxDistance,normal={x:0,y:0,z:0};
  for(const [n,k] of planes){
    const no=n.x*o.x+n.y*o.y+n.z*o.z,nd=n.x*d.x+n.y*d.y+n.z*d.z;
    if(Math.abs(nd)<EPS){if(no>k+EPS)return null;continue;}
    const t=(k-no)/nd;
    if(nd<0){if(t>near){near=t;const l=Math.hypot(n.x,n.y,n.z);normal={x:n.x/l,y:n.y/l,z:n.z/l};}}
    else far=Math.min(far,t);
    if(near>far+EPS)return null;
  }
  if(far<0||near>maxDistance)return null;
  return{distance:near,point:add(o,d,near),normal};
}
export function getHitZones(target){
  if(target.hitZones){
    return Array.isArray(target.hitZones)?target.hitZones:Object.entries(target.hitZones).flatMap(([zone,s])=>(Array.isArray(s)?s:[s]).map(shape=>({...shape,zone})));
  }
  const p=target.position||target.feet;if(!valid(p))return [];
  const h=target.height??(target.crouched?1.12:1.8),r=target.radius??.28;
  const headRadius=Math.min(.19,h*.115),headY=p.y+h-headRadius;
  const box=(zone,minY,maxY,minX,maxX)=>({zone,min:{x:p.x+minX,y:p.y+minY,z:p.z-r*.68},max:{x:p.x+maxX,y:p.y+maxY,z:p.z+r*.68}});
  return[
    {zone:'head',center:{x:p.x,y:headY,z:p.z},radius:headRadius},
    box('body',h*.40,h-2*headRadius,-r,r),
    box('legs',0,h*.40,-r*.8,-r*.08),
    box('legs',0,h*.40,r*.08,r*.8)
  ];
}
export function raycast(origin,direction,{colliders=[],targets=[],maxDistance=1000,ignore=[]}={}){
  if(!valid(origin)||!valid(direction)||Number.isNaN(maxDistance)||maxDistance<0)return null;
  const length=Math.hypot(direction.x,direction.y,direction.z);if(length<EPS)return null;
  const d={x:direction.x/length,y:direction.y/length,z:direction.z/length};
  let result=null,best=maxDistance;
  const ignored=new Set(ignore);
  for(const c of colliders){
    if(!c||c.blocksShots===false||ignored.has(c)||(c.id!==undefined&&ignored.has(c.id)))continue;
    const hit=c.type==='ramp'?rayRamp(origin,d,c,best):rayAABB(origin,d,c,best);
    if(hit&&(!result||hit.distance<best)){best=hit.distance;result={...hit,kind:'world',collider:c};}
  }
  for(const t of targets){
    if(!t||t.enabled===false||t.alive===false||t.dead||t.health<=0||ignored.has(t)||(t.id!==undefined&&ignored.has(t.id)))continue;
    for(const shape of getHitZones(t)){
      const hit=shape.radius!==undefined?raySphere(origin,d,shape,best):rayAABB(origin,d,shape,best);
      if(hit&&(!result||hit.distance<best-EPS)){best=hit.distance;result={...hit,kind:'target',target:t,zone:shape.zone||'body'};}
    }
  }
  return result;
}
export const hitscan=raycast;

/** true when a solid box (inflated sideways by pad) sits on the segment origin -> origin+dir*dist. Ramps and floors are skipped. */
export function wallBlocked(origin,direction,dist,colliders,pad=.07){
  const L=Math.hypot(direction.x,direction.y,direction.z);if(L<EPS||!(dist>0))return false;
  const d={x:direction.x/L,y:direction.y/L,z:direction.z/L};
  for(const c of colliders){
    if(!c||c.blocksShots===false||c.type==='ramp')continue;
    const b=bounds(c);if(!b||b.max.y-b.min.y>60||b.max.x-b.min.x>70)continue;
    const bx={min:{x:b.min.x-pad,y:b.min.y,z:b.min.z-pad},max:{x:b.max.x+pad,y:b.max.y,z:b.max.z+pad}};
    const hit=rayAABB(origin,d,bx,dist-.02);if(hit&&hit.distance>0.001)return true;
  }
  return false;
}
