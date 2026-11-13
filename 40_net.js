// ============================================================================
//  online co-op. The host's browser runs the simulation. Guests:
//   - move their own survivor locally (zero input lag) and report position
//   - interpolate everyone else between 20 Hz snapshots
//   - replay the host's effect events so sound and gore match
//  If the host leaves, the next player takes over the simulation in place.
// ============================================================================
let net=null,netId=null,netHost=false,netPlaying=false,netMembers=[],netCode='',netPing=0,hostId=null;
let netSnapTimer=0,netInputTimer=0,netPingTimer=0,snapDur=.05,lastSnapAt=0,snapSeq=0,rejoinCode='';
const zMap=new Map();
const isClient=()=>netPlaying&&!netHost;

function netSend(msg){if(net&&net.readyState===1)net.send(JSON.stringify(msg))}
function netConnect(cb){
  if(location.protocol==='file:'){setStatus('Online play needs the server. Run "npm start", then open http://localhost:3000');return}
  if(net&&net.readyState===1){cb();return}
  if(net){try{net.onclose=null;net.close()}catch(e){}}
  setStatus('Connecting…');
  const ws=net=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host);
  ws.onopen=()=>{setStatus('Connected');cb()};
  ws.onerror=()=>setStatus('Connection error. Is the server running?');
  ws.onclose=()=>{if(net!==ws)return;net=null;onNetClosed()};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(err){return}try{handleNet(m)}catch(err){console.error(err)}};
}
function netLeave(){
  const ws=net;net=null;if(ws){try{ws.onclose=null;ws.close()}catch(e){}}
  netPlaying=false;netHost=false;netId=null;netMembers=[];netCode='';zMap.clear();
  try{history.replaceState(null,'',location.pathname)}catch(e){}
}
function onNetClosed(){
  const wasPlaying=netPlaying;rejoinCode=netCode;
  netPlaying=false;netHost=false;netId=null;netMembers=[];zMap.clear();
  if(wasPlaying&&(state==='playing'||state==='over')){state='menu';showDrop()}
  else{setStatus('Disconnected from server');if(curScreen==='scrLobby')showScreen('scrMain')}
}

function handleNet(msg){
  switch(msg.t){
    case 'error':setStatus(msg.message);toast(msg.message);break;
    case 'joined':netId=msg.id;netCode=msg.code;try{history.replaceState(null,'','?room='+netCode)}catch(e){}break;
    case 'lobby':
      netMembers=msg.members||[];hostId=msg.host;netCode=msg.code;
      if(!netPlaying){netHost=hostId===netId;lobbyDraw();if(curScreen!=='scrLobby'&&state==='menu')showScreen('scrLobby')}
      break;
    case 'begin':beginNet(msg);break;
    case 'arrive':
      if(netPlaying)toast((msg.member.name||'Survivor')+' joined the fight');
      if(netPlaying&&netHost&&!playerById(msg.member.id)){
        const p=makePlayer(msg.member.id,msg.member.character,msg.member.name,players.length);
        const lead=players.find(q=>q.hp>0)||me;p.x=lead.x;p.y=lead.y;p.invuln=3;p.tp=1;players.push(p);
      }
      break;
    case 'depart':
      if(netPlaying){
        const p=playerById(msg.id);
        if(p&&p!==me){toast(p.name+' left');p.gone=true;players=players.filter(q=>q!==p)}
      }
      break;
    case 'host':
      hostId=msg.host;
      if(netPlaying&&msg.host===netId&&!netHost)becomeHost();
      else if(!netPlaying)netHost=hostId===netId;
      break;
    case 'input':if(netHost&&netPlaying)applyInput(msg.id,msg.input);break;
    case 'action':if(netHost&&netPlaying&&msg.action&&typeof msg.action==='object')applyAction(playerById(msg.id),msg.action);break;
    case 'snapshot':if(netPlaying&&!netHost&&msg.snapshot)applySnap(msg.snapshot);break;
    case 'reset':netPlaying=false;state='menu';netHost=hostId===netId;zMap.clear();showScreen('scrLobby');lobbyDraw();break;
    case 'pong':netPing=Math.round(performance.now()-msg.ts);break;
  }
}

function beginNet(msg){
  netPlaying=true;hostId=msg.host;netHost=msg.host===netId;netMembers=msg.members;
  $('waveTest').value=msg.wave||1;
  reset();zMap.clear();lastSnapAt=performance.now();snapDur=.05;
  players=[];me=null;
  msg.members.forEach((m,i)=>{const p=makePlayer(m.id,m.character,m.name,i);players.push(p);if(m.id===netId)me=p});
  if(!me){me=makePlayer(netId,0,settings.name,players.length);players.push(me)}
  if(!netHost)me.tp=-1; // adopt whatever position the host assigns first
  enterGame();
}

// ---------------------------------------------------------------- host side
function applyInput(id,inp){
  const p=playerById(id);if(!p||!Array.isArray(inp))return;
  const x=+inp[0],y=+inp[1],a=+inp[2];
  p.input.fire=!!inp[3];p.input.revive=!!inp[4];
  if(Number.isFinite(a))p.angle=a;
  if(p.hp>0&&p.knockdown<=0&&inp[5]===p.tp&&Number.isFinite(x)&&Number.isFinite(y)){
    const d=Math.hypot(x-p.x,y-p.y);
    if(d>3.2||collision(x,y,.2))p.tp++;       // impossible move: snap the guest back
    else{if(d>.002){p.stride+=d*5.2;p.moving=true;p.mt=.14}p.x=x;p.y=y}
  }
}
function applyAction(p,a){
  if(!p||state!=='playing')return;
  switch(a.k){
    case 'reload':startReload(p);break;
    case 'swap':swapGun(p,a.d===-1?-1:1);break;
    case 'gun':changeGun(p,a.n|0);break;
    case 'interact':interact(p);break;
    case 'perk':choosePerk(p,a.i|0);break;
    case 'nade':if(Number.isFinite(+a.x)&&Number.isFinite(+a.y))throwNade(p,+a.x,+a.y);break;
    case 'dash':
      if(p===me)tryDash(p,+a.x||0,+a.y||0);
      else if(p.hp>0&&p.dashCd<=.25){p.dashCd=DASH_CD*Math.pow(.7,pk(p,'dash'));p.dashT=DASH_TIME;p.invuln=Math.max(p.invuln,.32);fx(['dash',p.id])}
      break;
  }
}
function zFlags(z){
  return (z.hit>0?1:0)|(z.burn>0?2:0)|((z.slamWind>0||z.chargeWind>0)?4:0)|(z.charging>0?8:0)|(z.enraged?16:0)|(z.elf?32:0)|(z.stun>0?64:0)|((z.loot||0)<<8);
}
function packSnap(){
  let mask=0;for(const b of barrels)if(b.alive)mask|=1<<b.idx;
  const s={t:r2(time),w:wave,k:kills,sc:teamScore,sl:spawnLeft,ws:waveSize,im:r2(intermission),st:state==='over'?1:0,ow:teamOwned,
    bf:[r2(buffs.dmg),r2(buffs.rapid)],d:officeDoor.solid?1:0,r:radioOn?1:0,br:mask,
    P:players.map(p=>[p.id,r2(p.x),r2(p.y),r2(p.angle),Math.ceil(p.hp),p.maxHp,p.weapon,p.ammo[p.weapon],r2(p.reload),r2(p.reloadTotal),r2(p.knockdown),
      p.hp<=0?1:0,r2(p.reviveProgress),p.grenades,p.kills,p.score,p.combo,p.perks,p.offer,p.tp,r2(p.dashCd),p.character,p.shoutTimer>0?1:0,p.invuln>0?1:0,p.name]),
    Z:zombies.map(z=>[z.id,ZT[z.t].i,r2(z.x),r2(z.y),r2(z.angle),Math.ceil(z.hp),z.maxHp,zFlags(z)]),
    B:bullets.map(b=>[r2(b.x),r2(b.y),r2(b.vx),r2(b.vy),r2(b.life),b.k]),
    E:eprojs.map(e=>[r2(e.x),r2(e.y),r2(e.vx),r2(e.vy)]),
    L:lobs.map(l=>[l.k,r2(l.x0),r2(l.y0),r2(l.tx),r2(l.ty),r2(l.t),r2(l.dur)]),
    H:hazards.map(h=>[h.k,r2(h.x),r2(h.y),h.r,r2(h.life)]),
    K:pickups.map(k=>[k.id,k.type,r2(k.x),r2(k.y),k.life==null?-1:r2(k.life)]),
    ev:outEvents};
  outEvents=[];return s;
}
function hostNet(dt){
  for(const p of players)if(p!==me&&p.mt>0){p.mt-=dt;if(p.mt<=0)p.moving=false}
  netSnapTimer-=dt;
  if(netSnapTimer<=0){
    netSnapTimer=.05;
    if(players.length>1)netSend({t:'snapshot',snapshot:packSnap()});else outEvents=[];
  }
}
function sendFinalSnap(){if(netPlaying&&netHost)netSend({t:'snapshot',snapshot:packSnap()})}

// ---------------------------------------------------------------- guest side
function applySnap(s){
  const now=performance.now(),gap=(now-lastSnapAt)/1000;lastSnapAt=now;
  snapDur=clamp(snapDur*.85+gap*.15,.035,.2);snapSeq++;
  wave=s.w;kills=s.k;teamScore=s.sc;spawnLeft=s.sl;waveSize=s.ws;intermission=s.im;time=s.t;teamOwned=s.ow;
  buffs.dmg=s.bf[0];buffs.rapid=s.bf[1];radioOn=!!s.r;
  let dirty=false;
  if(officeDoor.solid!==!!s.d){officeDoor.solid=!!s.d;dirty=true}
  for(const b of barrels){const alive=!!(s.br>>b.idx&1);if(b.alive!==alive){b.alive=b.solid=alive;dirty=true}}
  if(dirty)rebuildBlocks();
  // players
  const seen=new Set();
  for(const a of s.P){
    let p=playerById(a[0]);
    if(!p){p=makePlayer(a[0],a[21],a[24],players.length);p.x=p.px=p.nx=a[1];p.y=p.py=p.ny=a[2];players.push(p)}
    seen.add(a[0]);
    if(p===me){if(a[19]!==p.tp){p.x=a[1];p.y=a[2];p.tp=a[19];p.dashT=0}}
    else{p.px=p.x;p.py=p.y;p.pa=p.angle;p.nx=a[1];p.ny=a[2];p.na=a[3];p.dashCd=a[20]}
    p.hp=a[4];p.maxHp=a[5];
    if(p.weapon!==a[6]){p.weapon=a[6];p.reloadStage=0}
    p.ammo[a[6]]=a[7];p.reload=a[8];p.reloadTotal=a[9];p.knockdown=a[10];p.downed=!!a[11];p.reviveProgress=a[12];
    p.grenades=a[13];p.kills=a[14];p.score=a[15];p.combo=a[16];p.perks=a[17]||{};p.offer=a[18];
    p.character=a[21];p.shoutTimer=a[22]?1:0;p.invuln=a[23]?.2:0;p.name=a[24];
  }
  players=players.filter(p=>p===me||seen.has(p.id));
  // zombies
  for(const a of s.Z){
    let z=zMap.get(a[0]);
    if(!z){z={id:a[0],t:ZNAMES[a[1]],x:a[2],y:a[3],angle:a[4],stride:rand(0,6.28),hit:0,dead:false};zMap.set(z.id,z);zombies.push(z)}
    z.px=z.x;z.py=z.y;z.pa=z.angle;z.nx=a[2];z.ny=a[3];z.na=a[4];z.hp=a[5];z.maxHp=a[6];z.flags=a[7];z.seen=snapSeq;
  }
  zombies=zombies.filter(z=>z.seen===snapSeq||(zMap.delete(z.id),false));
  bullets=s.B.map(a=>({x:a[0],y:a[1],vx:a[2],vy:a[3],life:a[4],k:a[5]}));
  eprojs=s.E.map(a=>({x:a[0],y:a[1],vx:a[2],vy:a[3],life:1}));
  lobs=s.L.map(a=>({k:a[0],x0:a[1],y0:a[2],tx:a[3],ty:a[4],t:a[5],dur:a[6]}));
  hazards=s.H.map(a=>({k:a[0],x:a[1],y:a[2],r:a[3],life:a[4]}));
  pickups=s.K.map(a=>({id:a[0],type:a[1],x:a[2],y:a[3],life:a[4]<0?null:a[4]}));
  fxFromNet=true;try{for(const e of s.ev)playFx(e)}finally{fxFromNet=false}
  if(s.st===1&&state==='playing')endGame();
}
function clientFrame(dt){
  readInput();
  time+=dt;if(intermission>0)intermission=Math.max(0,intermission-dt);
  localMove(me,dt);
  // cosmetic gun prediction so your own shots feel instant
  me.pcool-=dt;
  if(me.input.fire&&me.hp>0&&me.knockdown<=0&&me.reload<=0&&me.ammo[me.weapon]>0&&me.pcool<=0){
    me.pcool=GUNS[me.weapon].rate*rateMul(me);playFx(['shot',me.id,me.weapon,me.x,me.y,me.angle]);
  }
  const a=clamp((performance.now()-lastSnapAt)/1000/snapDur,0,1);
  for(const p of players){
    if(p===me)continue;
    const ox=p.x,oy=p.y;p.x=lerp(p.px,p.nx,a);p.y=lerp(p.py,p.ny,a);p.angle=angLerp(p.pa,p.na,a);
    const d=Math.hypot(p.x-ox,p.y-oy);p.moving=d>.0008;p.stride+=d*5.2;
  }
  for(const z of zombies){
    const ox=z.x,oy=z.y;z.x=lerp(z.px,z.nx,a);z.y=lerp(z.py,z.ny,a);z.angle=angLerp(z.pa,z.na,a);
    z.stride+=Math.hypot(z.x-ox,z.y-oy)*5;
  }
  for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||bulletCollision(b.x,b.y,.07))bullets.splice(i,1)}
  for(const e of eprojs){e.x+=e.vx*dt;e.y+=e.vy*dt}
  for(const l of lobs)l.t=Math.min(l.dur,l.t+dt);
  for(const h of hazards)h.life-=dt;
  netInputTimer-=dt;
  if(netInputTimer<=0){
    netInputTimer=1/30;
    netSend({t:'input',input:[r2(me.x),r2(me.y),r2(me.angle),me.input.fire?1:0,me.input.revive?1:0,me.tp]});
  }
}
function netTick(dt){
  if(!net)return;
  netPingTimer-=dt;if(netPingTimer<=0){netPingTimer=2;netSend({t:'ping',ts:performance.now()})}
}

// ---------------------------------------------------------------- host migration
function becomeHost(){
  netHost=true;outEvents=[];boomQueue=[];bullets=[];
  for(const p of players){p.input={dx:0,dy:0,fire:false,revive:false};p.cool=0;p.mt=0;if(p!==me){p.x=p.nx;p.y=p.ny}}
  let maxId=0;
  for(const z of zombies){
    const f=z.flags||0;maxId=Math.max(maxId,z.id);z.x=z.nx;z.y=z.ny;
    Object.assign(z,{speed:Math.min(ZSPEED[z.t](),z.t==='walker'?2:9),attack:.5,flank:1,flankTime:0,kx:0,ky:0,burn:f&2?1.5:0,burnDps:16,burnBy:null,cd:2,stun:0,dead:false,
      enraged:!!(f&16),elf:!!(f&32),loot:f>>8&7,slamCd:4,slamWind:0,chargeCd:7,chargeWind:0,charging:0,cvx:0,cvy:0,giftCd:3,elfCd:9});
    if(z.enraged&&z.t==='santa')z.speed*=1.35;
  }
  for(const e of eprojs)e.life=1.2;
  for(const h of hazards){h.tick=0;h.o=null}
  for(const l of lobs)l.o=null;
  for(const k of pickups)maxId=Math.max(maxId,k.id);
  nextEid=maxId+1;zMap.clear();
  carrierQueue=[];
  for(let i=1;i<GUNS.length;i++)if(!owned(i)&&wave===GUNS[i].unlock&&spawnLeft>0&&!zombies.some(z=>z.loot===i)&&!pickups.some(k=>k.type==='w'+i))carrierQueue.push(i);
  officeDoor.hp=120;officeDoor.broken=0;walkDirty=true;navTimer=0;netSnapTimer=0;
  toast('Host left. You are hosting now, the fight goes on.');
}
