// ============================================================================
//  simulation (runs in solo and on the co-op host): players, guns, perks,
//  zombies, bosses, pickups and waves. All visual/audio side effects go
//  through fx(), so co-op guests see and hear exactly what the host does.
// ============================================================================
const GUNS=[
  {name:'AR',clip:40,rate:.095,dmg:22,speed:22,spread:.06,reload:1.45,pellets:1,pen:1,life:.9,kb:.5,len:30,unlock:0},
  {name:'LMG',clip:120,rate:.075,dmg:22,speed:22,spread:.07,reload:2.9,pellets:1,pen:1,life:.9,kb:.5,len:44,unlock:2},
  {name:'SHOTGUN',clip:8,rate:.32,dmg:30,speed:18,spread:.17,reload:2.1,pellets:9,pen:3,life:.34,kb:1.5,len:30,unlock:3},
  {name:'LAUNCHER',clip:4,rate:.75,dmg:190,speed:13,spread:.02,reload:2.6,pellets:1,pen:1,life:1.3,kb:0,len:32,unlock:6,boom:2.3},
  {name:'FLAMER',clip:90,rate:.04,dmg:6,speed:9.5,spread:.2,reload:2.4,pellets:1,pen:99,life:.45,kb:0,len:30,unlock:8,flame:true},
  {name:'RAILGUN',clip:5,rate:.85,dmg:300,speed:70,spread:0,reload:2.3,pellets:1,pen:14,life:.4,kb:2.2,len:46,unlock:11,rail:true}
];
const PERKS={
  dmg:{n:'Hollow Points',d:'+20% damage',i:'💥',max:6},
  rate:{n:'Trigger Finger',d:'+12% fire rate',i:'⚡',max:5},
  reload:{n:'Fast Hands',d:'20% faster reloads',i:'🖐',max:4},
  hp:{n:'Thick Skin',d:'+25 max health, heal 25',i:'❤',max:6},
  speed:{n:'Mall Walker',d:'+9% move speed',i:'👟',max:4},
  pierce:{n:'FMJ Rounds',d:'Bullets pierce +1 zombie',i:'🎯',max:3},
  leech:{n:'Vampire',d:'Heal 1 HP per kill',i:'🩸',max:3},
  crit:{n:'Lucky Shot',d:'+10% chance of a x2.5 crit',i:'🍀',max:5},
  boom:{n:'Explosive Rounds',d:'+10% chance kills explode',i:'🧨',max:4},
  mag:{n:'Extended Mags',d:'+30% magazine size',i:'📦',max:3},
  regen:{n:'Second Wind',d:'Regenerate when not hit for 4s',i:'💚',max:3},
  dash:{n:'Adrenaline',d:'Dash recharges 30% faster',i:'💨',max:3},
  nade:{n:'Bandolier',d:'+2 grenades now, +1 every wave',i:'💣',max:3}
};
const PERK_IDS=Object.keys(PERKS);
// r: body radius, hit: bullet hit radius
const ZT={
  walker:{i:0,r:.27,hit:.36,hp:60,dmg:7,reach:.62,score:10},
  runner:{i:1,r:.27,hit:.36,hp:42,dmg:10,reach:.62,score:12},
  sprinter:{i:2,r:.27,hit:.36,hp:48,dmg:10,reach:.62,score:18},
  carrier:{i:3,r:.27,hit:.38,hp:95,dmg:7,reach:.62,score:40},
  crawler:{i:4,r:.21,hit:.3,hp:24,dmg:5,reach:.55,score:8},
  bloater:{i:5,r:.36,hit:.5,hp:150,dmg:12,reach:.7,score:25},
  spitter:{i:6,r:.27,hit:.36,hp:55,dmg:6,reach:.62,score:20},
  riot:{i:7,r:.31,hit:.42,hp:280,dmg:14,reach:.68,score:35},
  giant:{i:8,r:.57,hit:.85,hp:10800,dmg:22,reach:1.05,score:600,boss:true,label:'THE GIANT'},
  santa:{i:9,r:.5,hit:.75,hp:13500,dmg:20,reach:1.0,score:800,boss:true,label:'ZOMBIE SANTA'}
};
const ZNAMES=Object.keys(ZT);
const GATES=[{x:16,y:1.05},{x:16,y:24.95},{x:1.05,y:13},{x:30.95,y:13}];
const PLAYER_SPEED=2.65,DASH_SPEED=8.6,DASH_TIME=.18,DASH_CD=1.6;
const REVIVE_TIME=3,INTERMISSION=11;

const pk=(p,k)=>p.perks[k]||0;
const dmgMul=p=>(1+.2*pk(p,'dmg'))*(buffs.dmg>0?2:1);
const rateMul=p=>(buffs.rapid>0?.55:1)/(1+.12*pk(p,'rate'));
const reloadMul=p=>Math.pow(.8,pk(p,'reload'));
const clipOf=(p,w)=>Math.round(GUNS[w].clip*(1+.3*pk(p,'mag')));
const moveSpeed=p=>PLAYER_SPEED*(1+.09*pk(p,'speed'));
const owned=n=>!!(teamOwned>>n&1);
const isMulti=()=>netPlaying;
const playerById=id=>players.find(p=>p.id===id);

// Everything the player sees or hears. Guests replay the same list.
let outEvents=[];
function fx(ev){playFx(ev);if(netPlaying&&netHost)outEvents.push(ev)}
const say=(text,x,y,color,life=1,size=18)=>fx(['txt',text,r2(x),r2(y),color,life,size]);

function makePlayer(id,character,name,slot=0){
  return {id,character:character||0,name:name||'Survivor',slot,x:16+slot*.55,y:14+slot*.45,angle:0,hp:100,maxHp:100,weapon:0,
    ammo:GUNS.map(g=>g.clip),reload:0,reloadTotal:0,reloadStage:0,cool:0,pcool:0,invuln:0,knockdown:0,downed:false,reviveProgress:0,
    magKills:0,shouted:false,shoutTimer:0,damageVoicePlayed:false,dashT:0,dashCd:0,dvx:0,dvy:0,grenades:2,nadeCd:0,
    perks:{},offer:null,kills:0,score:0,combo:0,comboT:0,lastHit:-99,tp:0,stride:0,moving:false,flash:0,hurtT:0,
    input:{dx:0,dy:0,fire:false,revive:false},px:0,py:0,pa:0,nx:0,ny:0,na:0,gone:false};
}

function reset(){
  build();
  zombies=[];bullets=[];eprojs=[];lobs=[];hazards=[];pickups=[];boomQueue=[];carrierQueue=[];outEvents=[];
  startWave=clamp(Math.floor(Number($('waveTest').value)||1),1,100);
  wave=startWave-1;kills=0;teamScore=0;time=0;intermission=2.6;navTimer=0;spawnLeft=0;spawnTimer=0;waveSize=0;
  buffs.dmg=0;buffs.rapid=0;radioOn=false;nextEid=1;
  teamOwned=1;for(let i=1;i<GUNS.length;i++)if(startWave>GUNS[i].unlock)teamOwned|=1<<i;
  clearFx();buildFloor();
  state='playing';
}

// ---------------------------------------------------------------- weapons
function startReload(p){
  if(p.hp<=0||p.reload>0||p.ammo[p.weapon]>=clipOf(p,p.weapon))return;
  p.reload=p.reloadTotal=GUNS[p.weapon].reload*reloadMul(p);p.reloadStage=0;p.magKills=0;p.shouted=false;
}
function changeGun(p,n){
  if(!p||p.hp<=0||n<0||n>=GUNS.length||!owned(n)||p.weapon===n)return;
  p.weapon=n;p.reload=0;p.reloadTotal=0;p.reloadStage=0;p.magKills=0;p.shouted=false;p.cool=Math.max(p.cool,.14);
}
function swapGun(p,dir=1){
  const have=[];for(let i=0;i<GUNS.length;i++)if(owned(i))have.push(i);
  changeGun(p,have[(have.indexOf(p.weapon)+dir+have.length)%have.length]);
}
function tryShoot(p){
  if(p.hp<=0||p.knockdown>0||p.reload>0||p.cool>0)return;
  const w=p.weapon,g=GUNS[w];
  if(p.ammo[w]<=0){startReload(p);return}
  p.cool=g.rate*rateMul(p);p.ammo[w]--;
  const kind=g.flame?1:g.boom?2:g.rail?3:0,mul=dmgMul(p);
  for(let i=0;i<g.pellets;i++){
    const a=p.angle+rand(-g.spread,g.spread),sp=g.speed*(g.flame?rand(.8,1.15):1);
    bullets.push({x:p.x+Math.cos(a)*.42,y:p.y+Math.sin(a)*.42,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:g.life,
      dmg:g.dmg*mul,pen:g.pen+(kind===0?pk(p,'pierce'):0),hit:[],o:p.id,k:kind,w});
  }
  fx(['shot',p.id,w,r2(p.x),r2(p.y),r2(p.angle)]);
  if(p.ammo[w]===0)startReload(p);
}
function throwNade(p,tx,ty){
  if(p.hp<=0||p.knockdown>0||p.grenades<=0||p.nadeCd>0)return;
  let a=Math.atan2(ty-p.y,tx-p.x),d=clamp(Math.hypot(tx-p.x,ty-p.y),1.2,8);
  const hit=raycast(p.x,p.y,a,d);d=Math.max(.6,hit.d-.25);
  p.grenades--;p.nadeCd=.6;
  lobs.push({k:0,x0:p.x,y0:p.y,tx:p.x+Math.cos(a)*d,ty:p.y+Math.sin(a)*d,t:0,dur:.45+d*.055,o:p.id});
  fx(['snd','throw',r2(p.x),r2(p.y)]);
}
function tryDash(p,dx,dy){
  if(p.hp<=0||p.knockdown>0||p.dashCd>0)return false;
  let m=Math.hypot(dx,dy);
  if(m<.1){dx=Math.cos(p.angle);dy=Math.sin(p.angle);m=1}
  p.dvx=dx/m*DASH_SPEED;p.dvy=dy/m*DASH_SPEED;p.dashT=DASH_TIME;p.dashCd=DASH_CD*Math.pow(.7,pk(p,'dash'));
  p.invuln=Math.max(p.invuln,.32);
  fx(['dash',p.id]);
  return true;
}
// Screen-aligned stick/WASD vector -> world vector (W is up on screen).
const stickToWorld=(dx,dy)=>[(dx+dy)*Math.SQRT1_2,(dy-dx)*Math.SQRT1_2];
function localMove(p,dt){
  p.dashCd=Math.max(0,p.dashCd-dt);
  const ox=p.x,oy=p.y;
  if(p.hp>0&&p.dashT>0){p.dashT-=dt;move(p,p.dvx*dt,p.dvy*dt,.29)}
  else if(p.hp>0&&p.knockdown<=0){
    let dx=p.input.dx,dy=p.input.dy;const mag=Math.hypot(dx,dy);
    if(mag>.02){dx/=Math.max(1,mag);dy/=Math.max(1,mag);const [wx,wy]=stickToWorld(dx,dy),sp=moveSpeed(p);move(p,wx*sp*dt,wy*sp*dt,.29)}
  }
  const moved=Math.hypot(p.x-ox,p.y-oy);p.moving=moved>.0005;if(p.moving)p.stride+=moved*5.2;
}

// ---------------------------------------------------------------- damage
function hurtPlayer(p,amount,opt={}){
  if(p.hp<=0||(!opt.pure&&p.invuln>0))return false;
  const before=p.hp;p.hp=Math.max(0,p.hp-amount);p.lastHit=time;
  if(!opt.pure)p.invuln=.18;
  fx(['hurt',p.id,Math.round(amount)]);
  if(before>p.maxHp*.5&&p.hp<=p.maxHp*.5&&p.hp>0&&!p.damageVoicePlayed){p.damageVoicePlayed=true;fx(['voice',p.id,'damage']);say('CRITICAL!',p.x,p.y-1.5,'#ff7878',1.3)}
  if(p.hp<=0){
    p.downed=true;p.reviveProgress=0;p.reload=0;p.combo=0;
    fx(['down',p.id]);
    if(isMulti())say(p.name+' IS DOWN!',p.x,p.y-1.6,'#ff6b6b',2.2);
  }
  return true;
}
function knockPlayer(p,fromX,fromY,dist,down){
  const d=Math.hypot(p.x-fromX,p.y-fromY)||1,nx=(p.x-fromX)/d,ny=(p.y-fromY)/d;
  for(let k=0;k<Math.round(dist/.13);k++)if(!collision(p.x+nx*.13,p.y+ny*.13,.29)){p.x+=nx*.13;p.y+=ny*.13}
  p.knockdown=Math.max(p.knockdown,down);p.dashT=0;p.tp++;
}
function damageZombie(z,amount,ownerId,opt={}){
  if(z.dead)return;
  const def=ZT[z.t];let crit=false;
  if(z.t==='riot'&&opt.dir){ // frontal riot shield
    const m=Math.hypot(opt.dir[0],opt.dir[1])||1;
    if((opt.dir[0]*Math.cos(z.angle)+opt.dir[1]*Math.sin(z.angle))/m<-.25){amount*=.25;fx(['clang',r2(z.x),r2(z.y)])}
  }
  const owner=ownerId!=null?playerById(ownerId):null;
  if(owner&&opt.canCrit&&Math.random()<.1*pk(owner,'crit')){amount*=2.5;crit=true}
  z.hp-=amount;z.hit=.1;
  if(opt.dir&&opt.kb&&!def.boss&&z.t!=='riot'){const m=Math.hypot(opt.dir[0],opt.dir[1])||1;z.kx+=opt.dir[0]/m*opt.kb;z.ky+=opt.dir[1]/m*opt.kb}
  if(!opt.quiet)fx(['dmg',r2(z.x),r2(z.y),Math.round(amount),crit?1:0]);
  if(def.boss&&!z.enraged&&z.hp>0&&z.hp<=z.maxHp*.5){z.enraged=true;bossEnrage(z)}
  if(z.hp<=0)killZombie(z,owner,opt);
}
function killZombie(z,owner,opt={}){
  if(z.dead)return;z.dead=true;kills++;
  const def=ZT[z.t];
  fx(['die',def.i,r2(z.x),r2(z.y),r2(z.angle),z.id,z.elf?1:0]);
  if(owner){
    owner.kills++;owner.combo++;owner.comboT=3;
    const mult=1+Math.min(4,Math.floor(owner.combo/5)*.5),pts=Math.round(def.score*mult*(opt.nuke?.5:1));
    owner.score+=pts;teamScore+=pts;
    if(pk(owner,'leech')&&owner.hp>0)owner.hp=Math.min(owner.maxHp,owner.hp+pk(owner,'leech'));
    if(!opt.blast&&Math.random()<.1*pk(owner,'boom'))boomQueue.push({x:z.x,y:z.y,r:1.5,dmg:70*dmgMul(owner),o:owner.id,t:0,kind:0});
    if(!opt.blast&&!opt.nuke){owner.magKills++;if(owner.magKills>=5&&!owner.shouted){owner.shouted=true;owner.shoutTimer=1.5;fx(['voice',owner.id,'streak'])}}
  }
  if(z.t==='bloater')boomQueue.push({x:z.x,y:z.y,r:1.9,dmg:90,o:owner?owner.id:null,t:.05,hurt:26,kind:1});
  if(z.t==='carrier'){pickups.push({id:nextEid++,type:'w'+z.loot,x:z.x,y:z.y});say(GUNS[z.loot].name+' DROPPED!',z.x,z.y-1,'#ffca78',2)}
  else if(def.boss)bossDeath(z);
  else if(!opt.nuke&&Math.random()<.045&&pickups.filter(p=>p.life!=null).length<5){
    const roll=Math.random(),type=roll<.34?'medsmall':roll<.54?'nade':roll<.72?'dmg':roll<.9?'rapid':(wave>=4?'nuke':'medsmall');
    pickups.push({id:nextEid++,type,x:z.x,y:z.y,life:20});
  }
}
function explode(b){
  fx(['boom',r2(b.x),r2(b.y),b.r,b.kind||0]);
  if(b.dmg>0)for(const z of zombies){
    if(z.dead)continue;const d=Math.hypot(z.x-b.x,z.y-b.y);
    if(d<b.r+ZT[z.t].r)damageZombie(z,b.dmg*(1-.55*Math.min(1,d/b.r)),b.o,{blast:true,dir:[z.x-b.x,z.y-b.y],kb:3});
  }
  if(b.hurt)for(const p of players){
    const d=Math.hypot(p.x-b.x,p.y-b.y);
    if(d<b.r&&p.hp>0)hurtPlayer(p,b.hurt*(1-.5*d/b.r));
  }
  for(const br of barrels){if(br.alive&&Math.hypot(br.x+.25-b.x,br.y+.25-b.y)<b.r+.2)blowBarrel(br,b.o,.14)}
}
function blowBarrel(br,ownerId,delay=0){
  if(!br.alive)return;br.alive=false;br.solid=false;rebuildBlocks();
  boomQueue.push({x:br.x+.25,y:br.y+.25,r:2.6,dmg:280,o:ownerId,t:delay,hurt:22,kind:2});
  hazards.push({k:1,x:br.x+.25,y:br.y+.25,r:1.3,life:4.5,tick:0,o:ownerId});
}

// ---------------------------------------------------------------- zombies
const ZSPEED={walker:()=>rand(.76,1.02)+wave*.023,runner:()=>rand(1.45,1.85)+wave*.008,sprinter:()=>rand(2.9,3.5),carrier:()=>.95+wave*.02,
  crawler:()=>rand(2.0,2.5),bloater:()=>.62+wave*.01,spitter:()=>.95+wave*.012,riot:()=>.72+wave*.012,giant:()=>.68+wave*.012,santa:()=>.8+wave*.008};
function spawnZombieAt(t,x,y,extra){
  const def=ZT[t],hpScale=def.boss?1:1+Math.max(0,wave-5)*.045;
  const hp=Math.round((extra&&extra.hp||def.hp)*hpScale);
  const sp=ZSPEED[t]();
  const z={id:nextEid++,t,x,y,hp,maxHp:hp,speed:Math.min(sp,t==='walker'?2.0:9),hit:0,attack:rand(0,.4),angle:0,stride:rand(0,6.28),
    flank:Math.random()<.5?1:-1,flankTime:rand(1,2.3),kx:0,ky:0,burn:0,burnDps:0,burnBy:null,cd:rand(1.2,2.6),stun:0,dead:false,
    px:x,py:y,pa:0,nx:x,ny:y,na:0,flags:0};
  if(extra)Object.assign(z,extra,{hp,maxHp:hp});
  zombies.push(z);return z;
}
function spawnZombie(){
  const gate=pick(GATES);
  const x=gate.x+rand(-.45,.45)*(gate.x===16?1:0),y=gate.y+rand(-.45,.45)*(gate.y===13?1:0);
  if(carrierQueue.length){spawnZombieAt('carrier',x,y,{loot:carrierQueue.shift()});return}
  const r=Math.random();let t='walker';
  const pSprint=wave>=3?.075:0,pCrawl=wave>=4?.09:0,pBloat=wave>=6?.06:0,pSpit=wave>=7?.07:0,pRiot=wave>=9?.05:0;
  let acc=0;
  if(r<(acc+=pSprint))t='sprinter';else if(r<(acc+=pCrawl))t='crawler';else if(r<(acc+=pBloat))t='bloater';
  else if(r<(acc+=pSpit))t='spitter';else if(r<(acc+=pRiot))t='riot';
  else if(Math.random()<Math.min(.43,.12+wave*.028))t='runner';
  spawnZombieAt(t,x,y);
}
function spawnBoss(){
  const g=pick([{x:16,y:1.35},{x:16,y:24.65},{x:1.35,y:13},{x:30.65,y:13}]);
  const t=wave%10===0?'santa':'giant',n=players.length;
  const hp=Math.round(ZT[t].hp*(1+Math.max(0,wave/5-1)*.18)*(1+.7*(n-1)));
  spawnZombieAt(t,g.x,g.y,{hp,slamCd:3.5,slamWind:0,chargeCd:7,chargeWind:0,charging:0,cvx:0,cvy:0,giftCd:3,elfCd:9,enraged:false});
  say(t==='santa'?'ZOMBIE SANTA IS COMING TO TOWN!':'GIANT INCOMING!',g.x,g.y-1.5,'#ff6464',2.8,20);
  fx(['snd','boss']);
}
function bossEnrage(z){
  if(z.t==='giant'){
    const count=Math.min(13,6+Math.floor(wave/5)*2);
    for(let i=0;i<count;i++){
      const a=TAU*i/count+rand(-.16,.16),r=rand(2.7,4.1);
      let x=clamp(z.x+Math.cos(a)*r,1.1,world.w-1.1),y=clamp(z.y+Math.sin(a)*r,1.1,world.h-1.1);
      if(collision(x,y,.3)){const g=GATES[i%4];x=g.x;y=g.y}
      spawnZombieAt(i===0&&wave>=5?'sprinter':i%3===0?'runner':'walker',x,y);
    }
    say('REINFORCEMENTS!',z.x,z.y-2.1,'#ff8b62',2);
  }else{
    z.speed*=1.35;say('HO HO HO! NAUGHTY LIST!',z.x,z.y-2.1,'#ff5a5a',2.4,20);fx(['snd','hoho',r2(z.x),r2(z.y)]);
  }
  fx(['shake',9,r2(z.x),r2(z.y)]);fx(['snd','roar',r2(z.x),r2(z.y)]);
}
function bossDeath(z){
  fx(['boom',r2(z.x),r2(z.y),3,3]);
  for(const p of players)if(p.hp>0)p.hp=p.maxHp;
  for(let i=0;i<3;i++)pickups.push({id:nextEid++,type:pick(['dmg','rapid','nade']),x:z.x+rand(-1,1),y:z.y+rand(-1,1),life:25});
  say('BOSS DOWN! FULL HEAL',z.x,z.y-2,'#9bffb5',3,20);
}
function nearestPlayer(z){
  let bestP=null,bd=1e9;
  for(const p of players){if(p.hp<=0)continue;const d=(p.x-z.x)**2+(p.y-z.y)**2;if(d<bd){bd=d;bestP=p}}
  return bestP;
}
function zombieStep(z,ax,ay,sp,dt){
  const r=ZT[z.t].r,ox=z.x,oy=z.y;
  move(z,ax*sp*dt,ay*sp*dt,r);
  if(Math.hypot(z.x-ox,z.y-oy)<.0005){move(z,-ay*sp*dt,ax*sp*dt,r);if(Math.hypot(z.x-ox,z.y-oy)<.0005)move(z,ay*sp*dt,-ax*sp*dt,r)}
}
function updateBoss(z,t,dist,dt){ // returns true when the boss is busy this frame
  if(z.t==='giant'){
    z.slamCd=Math.max(0,z.slamCd-dt);z.chargeCd=Math.max(0,z.chargeCd-dt);
    if(z.slamWind>0){
      z.slamWind-=dt;
      if(z.slamWind<=0){
        z.slamCd=7.5;fx(['slam',r2(z.x),r2(z.y),3.15]);say('GROUND SLAM!',z.x,z.y-1.9,'#ffae6e',1.4);
        for(const p of players){
          const d=Math.hypot(p.x-z.x,p.y-z.y);
          if(d<3.15&&p.hp>0&&p.knockdown<=0&&p.dashT<=0){knockPlayer(p,z.x,z.y,1.2,1.05);p.invuln=0;hurtPlayer(p,12);p.invuln=1.1;say('KNOCKED DOWN!',p.x,p.y-1.2,'#ffdb8a',1.2)}
        }
      }
      return true;
    }
    if(z.chargeWind>0){
      z.chargeWind-=dt;
      if(z.chargeWind<=0){z.charging=.95;z.cvx=Math.cos(z.angle)*9.5;z.cvy=Math.sin(z.angle)*9.5;fx(['snd','roar',r2(z.x),r2(z.y)])}
      return true;
    }
    if(z.charging>0){
      z.charging-=dt;const ox=z.x,oy=z.y;
      move(z,z.cvx*dt,z.cvy*dt,.57);
      if(Math.hypot(z.x-ox,z.y-oy)<Math.hypot(z.cvx,z.cvy)*dt*.5){z.charging=0;z.stun=.9;fx(['shake',10,r2(z.x),r2(z.y)]);fx(['snd','thump',r2(z.x),r2(z.y)])}
      for(const p of players)if(p.hp>0&&p.dashT<=0&&Math.hypot(p.x-z.x,p.y-z.y)<1.15&&p.knockdown<=0){knockPlayer(p,z.x,z.y,1.6,.9);p.invuln=0;hurtPlayer(p,18);p.invuln=.9}
      return true;
    }
    if(dist>=1.12&&dist<=3.05&&z.slamCd<=0){z.slamWind=.85;fx(['tele',0,r2(z.x),r2(z.y),3.15,.85]);say('WATCH OUT!',z.x,z.y-2,'#ffd06a',.9);return true}
    if(dist>4.5&&dist<11&&z.chargeCd<=0&&los(z.x,z.y,t.x,t.y)){z.chargeCd=z.enraged?6:9;z.chargeWind=.75;fx(['tele',1,r2(z.x),r2(z.y),r2(z.angle),.75]);say('CHARGE!',z.x,z.y-2,'#ffd06a',.9);return true}
  }else{
    z.giftCd-=dt;z.elfCd-=dt;
    if(z.giftCd<=0){
      z.giftCd=z.enraged?2.9:4.6;const alive=players.filter(p=>p.hp>0),n=(z.enraged?5:3)+Math.min(2,alive.length-1);
      for(let i=0;i<n;i++){
        const p=pick(alive),tx=clamp(p.x+rand(-1.9,1.9),1,world.w-1),ty=clamp(p.y+rand(-1.9,1.9),1,world.h-1),dur=1.15+i*.14;
        lobs.push({k:1,x0:z.x,y0:z.y,tx,ty,t:0,dur,o:null});fx(['tele',2,r2(tx),r2(ty),1.5,dur]);
      }
      fx(['snd','bell',r2(z.x),r2(z.y)]);
    }
    if(z.elfCd<=0){
      z.elfCd=z.enraged?9:13;
      for(let i=0;i<5;i++){
        const a=TAU*i/5;let x=z.x+Math.cos(a)*1.4,y=z.y+Math.sin(a)*1.4;if(collision(x,y,.25)){x=z.x;y=z.y}
        spawnZombieAt('crawler',x,y,{elf:true});
      }
      say("SANTA'S LITTLE HELPERS!",z.x,z.y-2,'#8dff9f',1.6);fx(['snd','hoho',r2(z.x),r2(z.y)]);
    }
  }
  return false;
}
function updateZombies(dt){
  const door=officeDoor;
  for(const z of zombies){
    if(z.dead)continue;
    const def=ZT[z.t];
    z.hit=Math.max(0,z.hit-dt);z.attack-=dt;
    if(z.burn>0){z.burn-=dt;damageZombie(z,z.burnDps*dt,z.burnBy,{quiet:true});if(z.dead)continue}
    if(z.kx||z.ky){move(z,z.kx*dt,z.ky*dt,def.r);const k=Math.exp(-9*dt);z.kx*=k;z.ky*=k;if(Math.abs(z.kx)+Math.abs(z.ky)<.05)z.kx=z.ky=0}
    if(z.stun>0){z.stun-=dt;continue}
    const t=nearestPlayer(z);if(!t)continue;
    const vx=t.x-z.x,vy=t.y-z.y,dist=Math.hypot(vx,vy);
    if(!(z.charging>0))z.angle=Math.atan2(vy,vx);
    if(def.boss&&updateBoss(z,t,dist,dt))continue;
    let hold=false;
    if(z.t==='spitter'){
      z.cd-=dt;
      const clear=dist<8.5&&los(z.x,z.y,t.x,t.y);
      if(clear&&dist>2.6)hold=dist<6.5;
      if(clear&&z.cd<=0){
        z.cd=2.5;const a=Math.atan2(vy,vx)+rand(-.07,.07);
        eprojs.push({x:z.x,y:z.y,vx:Math.cos(a)*6.5,vy:Math.sin(a)*6.5,life:1.7});fx(['snd','spit',r2(z.x),r2(z.y)]);
      }
    }
    if(dist>.5&&!hold){
      let [ax,ay]=navDirection(z,t);
      if(z.t==='sprinter'){
        z.flankTime-=dt;
        if(z.flankTime>0&&dist>2.2){const fx2=ax*.85-ay*z.flank*.35,fy2=ay*.85+ax*z.flank*.35,m=Math.hypot(fx2,fy2)||1;if(!collision(z.x+fx2/m*.6,z.y+fy2/m*.6,.27)){ax=fx2/m;ay=fy2/m}}
      }
      zombieStep(z,ax,ay,z.speed*(z.burn>0&&!def.boss?.85:1),dt);z.stride+=z.speed*dt*5;
    }
    if(dist<def.reach&&z.attack<=0){z.attack=.8;if(hurtPlayer(t,def.dmg))fx(['shake',6,r2(t.x),r2(t.y)])}
    else if(door.solid&&z.attack<=0){ // break the office door down
      const cx=clamp(z.x,door.x,door.x+door.w),cy=clamp(z.y,door.y,door.y+door.h);
      if((z.x-cx)**2+(z.y-cy)**2<(def.r+.22)**2){
        z.attack=.8;door.hp-=def.boss?60:8;fx(['snd','door',r2(door.x),r2(door.y+.7)]);
        if(door.hp<=0){door.solid=false;door.broken=18;rebuildBlocks();fx(['snd','breach',r2(door.x),r2(door.y+.7)]);say('DOOR BREACHED!',door.x+.5,door.y+.4,'#ff8b62',2);fx(['shake',8,r2(door.x),r2(door.y)])}
      }
    }
  }
  // soft separation so the horde spreads out instead of stacking into one sprite
  const n=zombies.length;
  for(let i=0;i<n;i++){
    const a=zombies[i];if(a.dead||a.charging>0)continue;const ra=ZT[a.t].r;
    for(let j=i+1;j<n;j++){
      const b=zombies[j];if(b.dead)continue;
      const dx=b.x-a.x,dy=b.y-a.y,min=(ra+ZT[b.t].r)*.9;
      if(dx>min||dx<-min||dy>min||dy<-min)continue;
      const d2=dx*dx+dy*dy;if(d2>=min*min)continue;
      const d=Math.sqrt(d2)||.001,push=(min-d)*.5*Math.min(1,dt*14),px=dx/d*push,py=dy/d*push;
      const ba=ZT[a.t].boss,bb=ZT[b.t].boss;
      if(!ba)move(a,-px*(bb?2:1),-py*(bb?2:1),ra);
      if(!bb)move(b,px*(ba?2:1),py*(ba?2:1),ZT[b.t].r);
    }
  }
}

// ---------------------------------------------------------------- projectiles
function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.life-=dt;
    const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/.17));let gone=false;
    for(let k=0;k<steps&&!gone;k++){
      b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;
      if(bulletCollision(b.x,b.y,.07)){gone=true;if(b.k===2)boomQueue.push({x:b.x-b.vx*.02,y:b.y-b.vy*.02,r:GUNS[3].boom,dmg:b.dmg,o:b.o,t:0,kind:0});else if(b.k!==1)fx(['spark',r2(b.x),r2(b.y)]);break}
      for(const br of barrels){
        if(br.alive&&Math.abs(b.x-br.x-.25)<.34&&Math.abs(b.y-br.y-.25)<.34){
          br.hp-=b.dmg;if(br.hp<=0)blowBarrel(br,b.o);else if(b.k!==1)fx(['spark',r2(b.x),r2(b.y)]);
          if(b.k===2){boomQueue.push({x:b.x,y:b.y,r:GUNS[3].boom,dmg:b.dmg,o:b.o,t:0,kind:0});gone=true}else if(b.k!==1&&b.k!==3)gone=true;
          break;
        }
      }
      if(gone)break;
      for(let j=0;j<zombies.length;j++){
        const z=zombies[j];if(z.dead)continue;
        const hr=ZT[z.t].hit+(b.k===1?.22:0),dx=z.x-b.x,dy=z.y-b.y;
        if(dx>hr||dx<-hr||dy>hr||dy<-hr||dx*dx+dy*dy>hr*hr||b.hit.includes(z.id))continue;
        b.hit.push(z.id);
        if(b.k===2){boomQueue.push({x:b.x,y:b.y,r:GUNS[3].boom,dmg:b.dmg,o:b.o,t:0,kind:0});gone=true;break}
        if(b.k===1){z.burn=2.6;z.burnDps=Math.max(z.burnDps,16*(b.dmg/GUNS[4].dmg));z.burnBy=b.o;damageZombie(z,b.dmg,b.o,{quiet:true});continue}
        fx(['blood',r2(z.x),r2(z.y),z.hp-b.dmg<=0?1:0]);
        damageZombie(z,b.dmg,b.o,{dir:[b.vx,b.vy],kb:GUNS[b.w].kb,canCrit:true});
        if(--b.pen<=0){gone=true;break}
      }
    }
    if(gone||b.life<=0)bullets.splice(i,1);
  }
}
function updateHostile(dt){
  for(let i=eprojs.length-1;i>=0;i--){
    const e=eprojs[i];e.life-=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;
    let done=e.life<=0||bulletCollision(e.x,e.y,.1);
    if(!done)for(const p of players)if(p.hp>0&&p.dashT<=0&&Math.hypot(p.x-e.x,p.y-e.y)<.42){hurtPlayer(p,9);done=true;break}
    if(done){
      eprojs.splice(i,1);
      if(hazards.length<26)hazards.push({k:0,x:clamp(e.x,.6,world.w-.6),y:clamp(e.y,.6,world.h-.6),r:.85,life:3.5,tick:0});
      fx(['snd','acid',r2(e.x),r2(e.y)]);
    }
  }
  for(let i=lobs.length-1;i>=0;i--){
    const l=lobs[i];l.t+=dt;if(l.t<l.dur)continue;
    lobs.splice(i,1);
    if(l.k===0){const o=playerById(l.o);boomQueue.push({x:l.tx,y:l.ty,r:2.5,dmg:240*(o?dmgMul(o):1),o:l.o,t:0,kind:0})}
    else boomQueue.push({x:l.tx,y:l.ty,r:1.5,dmg:0,o:null,t:0,hurt:20,kind:4});
  }
  for(let i=hazards.length-1;i>=0;i--){
    const h=hazards[i];h.life-=dt;h.tick-=dt;
    if(h.life<=0){hazards.splice(i,1);continue}
    if(h.tick>0)continue;h.tick=.25;
    for(const p of players)if(p.hp>0&&Math.hypot(p.x-h.x,p.y-h.y)<h.r)hurtPlayer(p,h.k===0?1.6:2.2,{pure:true});
    if(h.k===1)for(const z of zombies)if(!z.dead&&Math.hypot(z.x-h.x,z.y-h.y)<h.r+.2){z.burn=1.2;z.burnDps=Math.max(z.burnDps,30);z.burnBy=h.o}
  }
  for(let i=boomQueue.length-1;i>=0;i--){const b=boomQueue[i];b.t-=dt;if(b.t<=0){boomQueue.splice(i,1);explode(b)}}
}

// ---------------------------------------------------------------- players
function updatePlayers(dt){
  buffs.dmg=Math.max(0,buffs.dmg-dt);buffs.rapid=Math.max(0,buffs.rapid-dt);
  for(const p of players){
    p.cool=Math.max(0,p.cool-dt);p.invuln=Math.max(0,p.invuln-dt);p.knockdown=Math.max(0,p.knockdown-dt);
    p.shoutTimer=Math.max(0,p.shoutTimer-dt);p.nadeCd=Math.max(0,p.nadeCd-dt);
    if(p.comboT>0){p.comboT-=dt;if(p.comboT<=0)p.combo=0}
    if(p===me)localMove(p,dt);else{p.dashCd=Math.max(0,p.dashCd-dt);p.dashT=Math.max(0,p.dashT-dt)}
    if(p.hp<=0)continue;
    if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(p.reload<=0)p.ammo[p.weapon]=clipOf(p,p.weapon)}
    if(p.input.fire)tryShoot(p);
    if(pk(p,'regen')&&time-p.lastHit>4&&p.hp<p.maxHp)p.hp=Math.min(p.maxHp,p.hp+pk(p,'regen')*1.5*dt);
  }
  if(isMulti()){
    for(const down of players){
      if(down.hp>0){down.downed=false;down.reviveProgress=0;continue}
      let helper=null;
      for(const r of players){if(r!==down&&r.hp>0&&r.input.revive&&Math.hypot(r.x-down.x,r.y-down.y)<1.45){helper=r;break}}
      down.reviveProgress=helper?down.reviveProgress+dt:Math.max(0,down.reviveProgress-dt*2);
      if(down.reviveProgress>=REVIVE_TIME)revivePlayer(down,.4);
    }
  }
}
function revivePlayer(p,frac){
  p.hp=Math.round(p.maxHp*frac);p.downed=false;p.invuln=2;p.reviveProgress=0;p.damageVoicePlayed=false;
  fx(['revive',p.id]);say('REVIVED!',p.x,p.y-1.2,'#7fffc1',1.5);
}
function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){
    const k=pickups[i];
    if(k.life!=null){k.life-=dt;if(k.life<=0){pickups.splice(i,1);continue}}
    const p=players.find(a=>a.hp>0&&Math.hypot(a.x-k.x,a.y-k.y)<.72);
    if(!p)continue;
    if(k.type[0]==='w'){
      const n=Number(k.type[1]);teamOwned|=1<<n;
      for(const q of players)q.ammo[n]=clipOf(q,n);
      changeGun(p,n);p.cool=.1;
      say((isMulti()?'TEAM UNLOCK: ':'')+GUNS[n].name+(isMulti()?'':' ACQUIRED!'),p.x,p.y-1.3,'#ffe18b',2);fx(['snd','weapon']);
    }else if(k.type==='medkit'||k.type==='medsmall'){
      if(p.hp>=p.maxHp)continue;
      const heal=Math.min(p.maxHp-p.hp,k.type==='medkit'?p.maxHp:30);p.hp+=heal;p.damageVoicePlayed=p.hp<=p.maxHp*.5;
      say('+'+Math.round(heal)+' HP',p.x,p.y-1.3,'#7cf0a3',1.5);fx(['snd','pickup',r2(k.x),r2(k.y)]);
    }else if(k.type==='nade'){p.grenades=Math.min(9,p.grenades+2);say('+2 GRENADES',p.x,p.y-1.3,'#cfe58a',1.4);fx(['snd','pickup',r2(k.x),r2(k.y)])}
    else if(k.type==='dmg'){buffs.dmg=12;say('DOUBLE DAMAGE!',p.x,p.y-1.4,'#ff9d5c',2,20);fx(['snd','power'])}
    else if(k.type==='rapid'){buffs.rapid=10;say('RAPID FIRE!',p.x,p.y-1.4,'#7fd8ff',2,20);fx(['snd','power'])}
    else if(k.type==='nuke'){
      say('NUKE!',p.x,p.y-1.6,'#fff3a0',2.4,26);fx(['nuke']);
      for(const z of zombies){if(z.dead)continue;if(ZT[z.t].boss)damageZombie(z,z.maxHp*.12,p.id,{quiet:true});else if(z.t!=='carrier')killZombie(z,p,{nuke:true})}
    }
    pickups.splice(i,1);
  }
}

// ---------------------------------------------------------------- perks
function makeOffer(p){
  const pool=PERK_IDS.filter(k=>pk(p,k)<PERKS[k].max),o=[];
  while(o.length<3&&pool.length)o.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  p.offer=o.length?o:null;
}
function choosePerk(p,i){
  if(!p||!p.offer||!p.offer[i])return;
  const k=p.offer[i];p.offer=null;p.perks[k]=pk(p,k)+1;
  if(k==='hp'){p.maxHp+=25;if(p.hp>0)p.hp=Math.min(p.maxHp,p.hp+25)}
  if(k==='nade')p.grenades=Math.min(9,p.grenades+2);
  if(k==='mag')for(let w=0;w<GUNS.length;w++)if(p.reload<=0||w!==p.weapon)p.ammo[w]=clipOf(p,w);
  fx(['perk',p.id,k]);
  if(intermission>3&&players.every(q=>!q.offer||q.gone))intermission=3;
}

// ---------------------------------------------------------------- interactables
const nearDoor=p=>Math.hypot(p.x-2.35,p.y-21.35)<2.1;
const nearRadio=p=>Math.hypot(p.x-RADIO_X,p.y-RADIO_Y)<RADIO_REACH;
function interact(p){
  if(!p||p.hp<=0)return;
  const d=officeDoor;
  if(nearDoor(p)){
    if(d.solid){d.solid=false;rebuildBlocks();fx(['snd','door',r2(d.x),r2(d.y+.7)])}
    else if(d.broken>0)say('DOOR IS BROKEN',p.x,p.y-1,'#ffe3a0',1);
    else{
      const touching=e=>e.x>d.x-.42&&e.x<d.x+d.w+.42&&e.y>d.y-.42&&e.y<d.y+d.h+.42;
      if(players.some(touching)||zombies.some(touching)){say('DOOR BLOCKED',p.x,p.y-1,'#ffe3a0',1);return}
      d.solid=true;rebuildBlocks();fx(['snd','door',r2(d.x),r2(d.y+.7)]);
    }
    navTimer=0;
  }else if(nearRadio(p)){radioOn=!radioOn;fx(['snd','click'])}
}

// ---------------------------------------------------------------- waves
function nextWave(){
  wave++;
  const n=players.length,boss=wave%5===0;
  for(const p of players){
    if(p.offer)choosePerk(p,0);
    if(p.hp>0)p.ammo[p.weapon]=clipOf(p,p.weapon),p.reload=0;
    if(pk(p,'nade'))p.grenades=Math.min(9,p.grenades+pk(p,'nade'));
  }
  for(let i=1;i<GUNS.length;i++){
    if(owned(i))continue;
    if(wave===GUNS[i].unlock)carrierQueue.push(i);
    else if(wave>GUNS[i].unlock+1&&!pickups.some(k=>k.type==='w'+i)&&!zombies.some(z=>z.loot===i))teamOwned|=1<<i;
  }
  for(const b of barrels){ // restock barrels where nobody is standing
    if(b.alive)continue;
    if(players.some(p=>Math.hypot(p.x-b.x-.25,p.y-b.y-.25)<1)||zombies.some(z=>Math.hypot(z.x-b.x-.25,z.y-b.y-.25)<1))continue;
    b.alive=b.solid=true;b.hp=40;
  }
  officeDoor.hp=120;rebuildBlocks();
  waveSize=spawnLeft=Math.round((12+wave*8)*(boss?1.35:1)*(1+.6*(n-1)));
  spawnTimer=.25;intermission=0;
  if(boss)spawnBoss();
  fx(['wave',wave,boss?1:0]);
}
function dropRoundAid(){
  // Alternate end-of-round supplies between AR AUTO (north-west) and Nick's Office (south-west).
  const inOffice=wave%2===0;
  const spots=inOffice?[[4.0,20.2],[5.5,20.2],[7.6,20.2]]:[[3.3,4.0],[5.5,3.7],[6.4,4.7]];
  let count=0;
  for(const p of players){const missing=p.maxHp-p.hp;if(missing>=12)count+=(players.length===1&&missing>55)?2:1}
  count=Math.min(3,count);if(!count)return;
  for(let i=0;i<count;i++){const [x,y]=spots[(wave+i)%spots.length];if(!pickups.some(k=>k.x===x&&k.y===y))pickups.push({id:nextEid++,type:'medkit',x,y})}
  const lead=players.find(p=>p.hp>0)||players[0];
  say('FIRST AID: '+(inOffice?"NICK'S OFFICE":'AR AUTO'),lead.x,lead.y-2,'#9bffb5',2.4);
}
function waveCleared(){
  if(isMulti())for(const p of players)if(p.hp<=0)revivePlayer(p,.5);
  dropRoundAid();
  intermission=INTERMISSION;
  for(const p of players)makeOffer(p);
  const bonus=wave*50;teamScore+=bonus;for(const p of players)p.score+=Math.round(bonus/players.length);
  fx(['clear',wave,wave%5===0?1:0]);
}

// ---------------------------------------------------------------- main tick
function update(dt){
  time+=dt;
  if(intermission>0){intermission-=dt;if(intermission<=0)nextWave()}
  if(spawnLeft>0&&zombies.length<170){
    spawnTimer-=dt;
    if(spawnTimer<=0){spawnZombie();spawnLeft--;spawnTimer=Math.max(.085,.34-wave*.013)/(1+.35*(players.length-1))}
  }
  navTimer-=dt;if(navTimer<=0){rebuildNav();navTimer=.25}
  if(officeDoor.broken>0)officeDoor.broken-=dt;
  updatePlayers(dt);
  updateBullets(dt);
  updateZombies(dt);
  updateHostile(dt);
  updatePickups(dt);
  if(zombies.some(z=>z.dead))zombies=zombies.filter(z=>!z.dead);
  if(spawnLeft===0&&zombies.length===0&&intermission<=0&&wave>0)waveCleared();
  if(players.length&&players.every(p=>p.hp<=0))endGame();
}
