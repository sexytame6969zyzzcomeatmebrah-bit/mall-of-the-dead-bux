'use strict';
// ============================================================================
//  MALL OF THE DEAD — core: constants, helpers, settings, map, collision, nav
// ============================================================================
const ASSETS=window.MOTD_ASSETS||{};
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d');
let W=0,H=0,dpr=1,dprCap=9;
const TILE=38,ISOX=1,ISOY=.53,world={w:32,h:26},TAU=Math.PI*2;
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const r2=v=>Math.round(v*100)/100;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const angLerp=(a,b,t)=>a+((((b-a)%TAU)+TAU*1.5)%TAU-Math.PI)*t;
const COARSE=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
const QUERY=new URLSearchParams(location.search);
if(!CanvasRenderingContext2D.prototype.roundRect){CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){this.rect(x,y,w,h)}}

const store={
  get(k,d){try{const v=localStorage.getItem('motd_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('motd_'+k,JSON.stringify(v))}catch(e){}}
};
const settings=Object.assign({vol:.8,shake:true,light:true,autofire:false,name:''},store.get('settings',{}));
const best=Object.assign({wave:0,score:0,kills:0},store.get('best',{}));
const saveSettings=()=>store.set('settings',settings);

function resize(){
  dpr=Math.min(dprCap,COARSE?1.5:2,window.devicePixelRatio||1);W=innerWidth;H=innerHeight;
  canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  if(typeof resizeLights==='function')resizeLights();
}

// ---------------------------------------------------------------- game state
let state='menu';                      // menu | playing | paused | over
let players=[],me=null,zombies=[],bullets=[],eprojs=[],lobs=[],hazards=[],pickups=[],props=[],barrels=[];
let wave=0,kills=0,teamScore=0,spawnLeft=0,spawnTimer=0,intermission=0,time=0,clock=0,startWave=1;
let carrierQueue=[],teamOwned=1,boomQueue=[],nextEid=1,radioOn=false,waveSize=0;
const buffs={dmg:0,rapid:0};
const cam={x:0,y:0,sx:0,sy:0};
const blocks=[];let officeDoor=null;

const characters=[
  {name:'Angry Grandpa',skin:'#edbf9f',shirt:'#468bc8',hair:'#e8e9e4',pants:'#4b5564',belly:true,color:'#6fb1ee'},
  {name:'Tyrone',skin:'#75452f',shirt:'#30343c',hair:'#22252b',pants:'#343943',beanie:true,sleeveless:true,color:'#f0a35a'},
  {name:'Scary Terry',skin:'#b45b9d',shirt:'#7ca653',hair:'#6e346c',pants:'#36323f',scaryTerry:true,color:'#d07fd0'},
  {name:'AJ',skin:'#e9b99b',shirt:'#598d63',hair:'#25232a',pants:'#3f4c57',color:'#7fdc97'}
];

// ---------------------------------------------------------------- map
function rect(x,y,w,h,type,solid=true){const p={x,y,w,h,type,solid};props.push(p);return p}
function rebuildBlocks(){blocks.length=0;for(const p of props)if(p.solid)blocks.push(p);walkDirty=true}
const BARREL_SPOTS=[[12.9,6.4],[18.6,6.4],[8.3,13.3],[23.2,16.7],[12.9,20.8],[18.8,20.8]];
const STATIC_LIGHTS=[
  {x:16,y:11.5,z:1.6,r:6.2,c:'tree'},{x:20.3,y:12.4,z:.6,r:3.4,c:'#cfe0ff'},
  {x:3.5,y:2.7,z:.8,r:2.6,c:'#c9b8ff'},{x:8.6,y:2.7,z:.8,r:2.6,c:'#ffc79a'},{x:23.4,y:2.7,z:.8,r:2.6,c:'#a6ffe9'},{x:28.5,y:2.7,z:.8,r:2.6,c:'#ffe79a'},
  {x:27,y:8.5,z:.8,r:2.6,c:'#e0b6ff'},{x:27.1,y:15.6,z:.8,r:2.6,c:'#aee6ff'},{x:27.1,y:19.7,z:.8,r:2.6,c:'#ffd0b0'},
  {x:5.8,y:21.2,z:.9,r:3.6,c:'#ffe2b0'},
  {x:16,y:.8,z:.2,r:4.2,c:'#9db9ff'},{x:16,y:25.2,z:.2,r:4.2,c:'#9db9ff'},{x:.8,y:13,z:.2,r:4.2,c:'#9db9ff'},{x:31.2,y:13,z:.2,r:4.2,c:'#9db9ff'}
];
function build(){
  props=[];barrels=[];
  const wall=(x,y,w,h)=>rect(x,y,w,h,'wall');
  // Outer ring, with four wide, unobstructed entrance gates.
  wall(.25,.25,12.1,.55);wall(19.65,.25,12.1,.55);
  wall(.25,25.2,12.1,.55);wall(19.65,25.2,12.1,.55);
  wall(.25,.25,.55,10.1);wall(.25,15.65,.55,10.1);
  wall(31.2,.25,.55,10.1);wall(31.2,15.65,.55,10.1);
  // North arcade: open booths and aisles.
  rect(2.0,2.1,3.0,1.15,'shopA');rect(7.1,2.1,3.1,1.15,'shopB');
  rect(21.9,2.1,3.1,1.15,'shopC');rect(27,2.1,3,1.15,'shopD');
  props.push({x:8.65,y:2.65,w:0,h:0,type:'radio',solid:false,renderOrder:18.5});
  rect(5,5.5,2.4,.8,'bench');rect(24.5,5.5,2.4,.8,'bench');
  // Christmas display: raised red tree platform and an adjacent BMW E30 raffle display.
  rect(14.25,10.3,3.5,2.5,'treeBase');props.push({x:16,y:11.5,w:0,h:0,type:'christmasTree',solid:false,renderOrder:31.0});
  rect(18.3,11.1,4.1,2.55,'carPlatform');props.push({x:20.35,y:12.38,w:0,h:0,type:'bmwE30',solid:false,renderOrder:37.1});
  rect(10,9,1.2,1.2,'planter');rect(20.8,9,1.2,1.2,'planter');
  rect(10.2,15,1.2,1.2,'planter');rect(20.6,15,1.2,1.2,'planter');
  // West food court.
  rect(2.1,7.1,2.2,.9,'food');rect(2.1,10.0,2.2,.9,'food');
  rect(5.5,9.0,1.35,.8,'bench');rect(5.5,12.4,1.35,.8,'bench');
  rect(2.2,15.7,2.6,1,'food');rect(5.8,16.4,1.6,.8,'bench');
  // East retail.
  wall(24.4,7.0,4.8,.38);wall(24.4,7.0,.38,4.2);
  wall(24.4,11.0,1.5,.38);wall(27.9,11.0,1.3,.38);
  rect(26,8.1,2.0,.8,'shopE');
  rect(25.5,15.1,3.3,1.1,'shopF');rect(25.5,19.2,3.3,1.1,'shopG');
  rect(21.3,18.4,1.6,.8,'bench');
  // Southwest security office: a three-sided retreat with one door.
  wall(2.0,18.4,2.9,.42);wall(6.7,18.4,3.0,.42);
  wall(2.0,18.4,.42,2.25);wall(2.0,22.05,.42,2.15);wall(9.28,18.4,.42,5.8);
  officeDoor={x:2.0,y:20.65,w:.42,h:1.4,type:'officeDoor',solid:true,renderOrder:25.2,hp:120,broken:0};props.push(officeDoor);
  wall(2.0,23.78,7.7,.42);
  rect(3.0,21.9,1.65,.65,'bench');rect(6.7,21.9,1.4,.65,'bench');
  props.push({x:5.85,y:20.2,w:0,h:0,type:'sign',solid:false,renderOrder:999});
  // South-east service corner.
  rect(20.5,22.2,2.2,.75,'bench');rect(25,22.2,2.2,.75,'planter');
  rebuildBlocks();
  // Explosive barrels: only placed where the floor is actually free.
  for(const [x,y] of BARREL_SPOTS){
    if(collision(x+.25,y+.25,.5))continue;
    const b={x,y,w:.5,h:.5,type:'barrel',solid:true,alive:true,hp:40,idx:barrels.length};
    props.push(b);barrels.push(b);
  }
  rebuildBlocks();
}

// ---------------------------------------------------------------- collision
function collision(x,y,r=.31,skipDoor=false){
  if(x<.05+r||y<.05+r||x>world.w-.05-r||y>world.h-.05-r)return true;
  for(let i=0;i<blocks.length;i++){
    const b=blocks[i];if(skipDoor&&b===officeDoor)continue;
    const cx=clamp(x,b.x,b.x+b.w),cy=clamp(y,b.y,b.y+b.h);
    if((x-cx)**2+(y-cy)**2<r*r)return true;
  }
  return false;
}
// Projectiles fly at torso height: low furniture does not stop bullets. Walls, shops and the closed door do.
function bulletCollision(x,y,r=.07){
  if(x<.05+r||y<.05+r||x>world.w-.05-r||y>world.h-.05-r)return true;
  for(let i=0;i<blocks.length;i++){
    const p=blocks[i];
    if(p.type!=='wall'&&p.type!=='officeDoor'&&!(p.type.charCodeAt(0)===115&&p.type.startsWith('shop')))continue;
    const cx=clamp(x,p.x,p.x+p.w),cy=clamp(y,p.y,p.y+p.h);
    if((x-cx)**2+(y-cy)**2<r*r)return true;
  }
  return false;
}
function move(e,dx,dy,r){
  let moved=false;
  if(!collision(e.x+dx,e.y,r)){e.x+=dx;moved=true}
  if(!collision(e.x,e.y+dy,r)){e.y+=dy;moved=true}
  return moved;
}
function los(x0,y0,x1,y1){
  const d=Math.hypot(x1-x0,y1-y0),n=Math.ceil(d/.3);
  for(let i=1;i<n;i++){const t=i/n;if(bulletCollision(x0+(x1-x0)*t,y0+(y1-y0)*t,.05))return false}
  return true;
}
function raycast(x,y,a,max){
  const dx=Math.cos(a)*.15,dy=Math.sin(a)*.15;let d=0;
  while(d<max){x+=dx;y+=dy;d+=.15;if(bulletCollision(x,y,.05))break}
  return {x,y,d};
}

// ---------------------------------------------------------------- navigation
// One multi-source flow field from every living survivor, so each zombie walks
// the shortest real path to whoever is closest. The office door is treated as
// walkable: zombies queue at it and break it down.
const NAV=.5,NW=64,NH=52,nav=new Float32Array(NW*NH),navQ=new Int32Array(NW*NH),walkGrid=new Uint8Array(NW*NH);
let walkDirty=true,navTimer=0;
function rebuildNav(){
  if(walkDirty){
    for(let iy=0;iy<NH;iy++)for(let ix=0;ix<NW;ix++)walkGrid[iy*NW+ix]=collision((ix+.5)*NAV,(iy+.5)*NAV,.27,true)?0:1;
    walkDirty=false;
  }
  nav.fill(1e7);let head=0,tail=0;
  const alive=players.filter(p=>p.hp>0);
  for(const p of (alive.length?alive:players)){
    const i=clamp(Math.floor(p.y/NAV),0,NH-1)*NW+clamp(Math.floor(p.x/NAV),0,NW-1);
    if(nav[i]!==0){nav[i]=0;navQ[tail++]=i}
  }
  while(head<tail){
    const k=navQ[head++],x=k%NW,y=(k/NW)|0,d=nav[k]+1;
    if(x>0&&walkGrid[k-1]&&nav[k-1]>d){nav[k-1]=d;navQ[tail++]=k-1}
    if(x<NW-1&&walkGrid[k+1]&&nav[k+1]>d){nav[k+1]=d;navQ[tail++]=k+1}
    if(y>0&&walkGrid[k-NW]&&nav[k-NW]>d){nav[k-NW]=d;navQ[tail++]=k-NW}
    if(y<NH-1&&walkGrid[k+NW]&&nav[k+NW]>d){nav[k+NW]=d;navQ[tail++]=k+NW}
  }
}
const NAV_DIRS=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
function navDirection(z,t){
  const x=clamp(Math.floor(z.x/NAV),0,NW-1),y=clamp(Math.floor(z.y/NAV),0,NH-1);
  let bestV=1e8,tx=t.x,ty=t.y;
  for(const [dx,dy] of NAV_DIRS){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=NW||ny>=NH)continue;
    const v=nav[ny*NW+nx]+(dx&&dy?.25:0)+Math.hypot((nx+.5)*NAV-t.x,(ny+.5)*NAV-t.y)*.003;
    if(v<bestV){bestV=v;tx=(nx+.5)*NAV;ty=(ny+.5)*NAV}
  }
  if(bestV>=1e7||nav[y*NW+x]<=1){tx=t.x;ty=t.y}
  const d=Math.hypot(tx-z.x,ty-z.y)||1;
  return [(tx-z.x)/d,(ty-z.y)/d];
}

// ---------------------------------------------------------------- projection
function project(x,y,z=0){return{x:(x-y)*TILE*ISOX+cam.x+cam.sx,y:(x+y)*TILE*ISOY+cam.y+cam.sy-z*TILE}}
function unproject(sx,sy){const X=(sx-cam.x)/(TILE*ISOX),Y=(sy-cam.y)/(TILE*ISOY);return{x:(X+Y)/2,y:(Y-X)/2}}
// World-space facing angle to on-screen angle and back.
const screenAngle=a=>Math.atan2((Math.sin(a)+Math.cos(a))*ISOY,(Math.cos(a)-Math.sin(a))*ISOX);
const worldAngle=(sx,sy)=>Math.atan2(sy/ISOY-sx/ISOX,sy/ISOY+sx/ISOX);
