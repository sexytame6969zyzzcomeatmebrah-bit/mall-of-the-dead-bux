// ============================================================================
//  UI: menus, lobby, HUD, input (keyboard + mouse, touch, gamepad), main loop
// ============================================================================
let curScreen='scrMain',chosenCharacter=clamp(store.get('char',0)|0,0,3),aimSrc=COARSE?'touch':'mouse',botOn=QUERY.get('bot')==='1';
const overlayOpen=()=>$('overlay').style.display!=='none';
const escapeHTML=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const myName=()=>($('playerName').value.trim()||'Survivor').slice(0,16);
function showScreen(id){
  curScreen=id;for(const el of document.querySelectorAll('.scr'))el.classList.toggle('on',el.id===id);
  $('overlay').style.display='flex';
  const inGame=state==='playing'||state==='paused';
  $('hud').style.display=inGame?'block':'none';$('touch').classList.toggle('on',false);
}
function hideOverlay(){$('overlay').style.display='none';$('hud').style.display='block';$('touch').classList.toggle('on',true)}
function setStatus(t){$('mainStatus').textContent=t;$('netStatus').textContent=t}
let toastT=0;
function toast(t){const el=$('toast');el.textContent=t;el.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>el.style.display='none',2800)}
function bestLine(){return best.wave?`BEST RUN · wave ${best.wave} · ${best.score.toLocaleString()} pts · ${best.kills} kills`:'No runs yet. Go make a mess.'}

function buildChars(root,selected,onPick,taken){
  root.innerHTML='';
  characters.forEach((c,i)=>{
    const b=document.createElement('button');b.type='button';b.className='charChoice'+(i===selected?' selected':'');
    const cv=document.createElement('canvas');cv.width=90;cv.height=90;b.appendChild(cv);
    const s=document.createElement('span');s.textContent=c.name;b.appendChild(s);
    if(taken&&taken(i))b.disabled=true;
    b.onclick=()=>{sfx('click');onPick(i)};root.appendChild(b);drawCharacterPreview(cv,c);
  });
}
function mainChars(){buildChars($('characters'),chosenCharacter,i=>{chosenCharacter=i;store.set('char',i);mainChars()})}

// ---------------------------------------------------------------- flow
function enterGame(){
  hideOverlay();mmBg=null;hudKey={};
  const help=$('help');help.classList.add('on');clearTimeout(enterGame.t);enterGame.t=setTimeout(()=>help.classList.remove('on'),15000);
}
function startSolo(){
  unlockAudio();if(net)netLeave();
  settings.name=myName();saveSettings();
  reset();me=makePlayer('solo',chosenCharacter,settings.name,0);players=[me];
  enterGame();
}
function fmtTime(s){s=Math.floor(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function endGame(){
  if(state==='over')return;
  state='over';sendFinalSnap();
  const record=teamScore>best.score||wave>best.wave;
  best.score=Math.max(best.score,teamScore);best.wave=Math.max(best.wave,wave);best.kills=Math.max(best.kills,kills);store.set('best',best);
  let html=`<div class="grid"><div><b>${wave}</b>WAVE</div><div><b>${kills}</b>KILLS</div><div><b>${teamScore.toLocaleString()}</b>SCORE</div><div><b>${fmtTime(time)}</b>TIME</div></div>`;
  if(netPlaying){
    html+='<table><tr><th>Survivor</th><th>Kills</th><th>Score</th></tr>'+[...players].sort((a,b)=>b.score-a.score).map(p=>`<tr><td>${escapeHTML(p.name)}${p===me?' (you)':''}</td><td>${p.kills}</td><td>${p.score.toLocaleString()}</td></tr>`).join('')+'</table>';
  }
  $('overStats').innerHTML=html;$('overBest').textContent=(record?'NEW RECORD! ':'')+bestLine();
  const again=$('againBtn');
  if(!netPlaying){again.textContent='PLAY AGAIN';again.disabled=false}
  else if(netHost){again.textContent='BACK TO LOBBY';again.disabled=false}
  else{again.textContent='WAITING FOR HOST…';again.disabled=true}
  showScreen('scrOver');
}
function toMenu(){
  state='menu';players=[];me=null;zombies=[];bullets=[];eprojs=[];lobs=[];hazards=[];pickups=[];radioOn=false;
  clearFx();build();buildFloor();mmBg=null;
  $('bestLine').textContent=bestLine();setStatus('');showScreen('scrMain');
}
function showDrop(){
  $('dropDesc').textContent=rejoinCode?'Connection to the server was lost. Room '+rejoinCode+' may still be running: you can drop back in.':'Connection to the server was lost.';
  $('rejoinBtn').style.display=rejoinCode?'block':'none';showScreen('scrDrop');
}
function togglePause(){
  if(state==='playing'&&!overlayOpen()){
    if(netPlaying){$('pauseTitle').textContent='MENU';$('pauseDesc').textContent='Co-op never pauses. The horde is still coming.'}
    else{state='paused';$('pauseTitle').textContent='PAUSED';$('pauseDesc').textContent='Take a break. Your survival run is waiting.'}
    showScreen('scrPause');
  }else if(curScreen==='scrPause'||(curScreen==='scrSettings'&&settingsBack==='scrPause')){
    if(state==='paused')state='playing';
    if(state==='playing')hideOverlay();
  }
}

// ---------------------------------------------------------------- lobby
function lobbyDraw(){
  const mine=netMembers.find(m=>m.id===netId);
  $('roomCode').textContent=netCode||'';
  $('roomRoster').innerHTML=netMembers.map(m=>`<div class="r"><span>${m.id===hostId?'👑 ':''}${escapeHTML(m.name)}${m.id===netId?' (you)':''} · ${characters[m.character].name}</span><span class="${m.ready||m.id===hostId?'ok':'wait'}">${m.id===hostId?'HOST':m.ready?'✔ READY':'○ NOT READY'}</span></div>`).join('');
  buildChars($('onlineCharacters'),mine?mine.character:-1,i=>netSend({t:'select',character:i}),i=>netMembers.some(m=>m.character===i&&m.id!==netId));
  $('readyBtn').style.display=netHost?'none':'block';$('readyBtn').textContent=mine&&mine.ready?'NOT READY':'READY UP';
  const allReady=netMembers.every(m=>m.ready||m.id===hostId);
  $('hostStart').style.display=netHost?'block':'none';$('hostStart').disabled=!allReady;
  $('hostStart').textContent=netMembers.length<2?'START (ALONE)':allReady?'START CO-OP':'WAITING FOR READY…';
  $('netStatus').textContent=netHost?'Share the code or invite link. Up to 4 survivors.':'Waiting for the host to start.';
}
function joinRoom(code){
  code=String(code||'').trim().toUpperCase();if(code.length<4){setStatus('Enter the room code');return}
  unlockAudio();settings.name=myName();saveSettings();
  netConnect(()=>netSend({t:'join',code,name:settings.name,character:chosenCharacter}));
}

// ---------------------------------------------------------------- actions
function doAct(k,data){
  if(!me||state!=='playing')return;
  const a=Object.assign({k},data);
  if(isClient())netSend({t:'action',action:a});else applyAction(me,a);
}
function doDash(){
  if(!me||state!=='playing'||overlayOpen())return;
  const [wx,wy]=stickToWorld(me.input.dx,me.input.dy);
  if(tryDash(me,wx,wy)&&isClient())netSend({t:'action',action:{k:'dash'}});
}
function doNade(){
  if(!me||state!=='playing'||me.grenades<=0)return;
  let x,y;
  if(aimSrc==='mouse'){const q=unproject(mouse.x,mouse.y);x=q.x;y=q.y}
  else{let d=5.5;const z=aimTarget(me.angle,.35,8);if(z)d=Math.hypot(z.x-me.x,z.y-me.y);x=me.x+Math.cos(me.angle)*d;y=me.y+Math.sin(me.angle)*d}
  doAct('nade',{x:r2(x),y:r2(y)});
}

// ---------------------------------------------------------------- input
const keys={},mouse={x:innerWidth/2,y:innerHeight/2,down:false};
const tMove={id:null,ox:0,oy:0,x:0,y:0},tAim={id:null,ox:0,oy:0,x:0,y:0,fire:false};
const pad={lx:0,ly:0,rx:0,ry:0,aim:false,fire:false,use:false,prev:[]};
let actHeld=false;
function aimTarget(a,cone,range){
  let bestZ=null,bv=1e9;
  for(const z of zombies){
    const dx=z.x-me.x,dy=z.y-me.y,d=Math.hypot(dx,dy);if(d>range||d<.2)continue;
    const diff=Math.abs(((Math.atan2(dy,dx)-a+Math.PI*3)%TAU)-Math.PI);if(diff>cone)continue;
    const v=diff+d*.012;if(v<bv){bv=v;bestZ=z}
  }
  return bestZ;
}
function nearestVisible(range){
  const c=[];for(const z of zombies){const d=(z.x-me.x)**2+(z.y-me.y)**2;if(d<range*range)c.push([d,z])}
  c.sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<Math.min(8,c.length);i++)if(los(me.x,me.y,c[i][1].x,c[i][1].y))return c[i][1];
  return null;
}
const botField=new Float32Array(NW*NH);let botKey='';
function botNav(t){ // tiny BFS so the autopilot can walk around furniture to a pickup
  const key=t.id+':'+blocks.length;if(key===botKey)return;botKey=key;
  if(walkDirty)rebuildNav();botField.fill(1e7);const q=[clamp(Math.floor(t.y/NAV),0,NH-1)*NW+clamp(Math.floor(t.x/NAV),0,NW-1)];botField[q[0]]=0;
  for(let h=0;h<q.length;h++){const k=q[h],x=k%NW,d=botField[k]+1;for(const n of [x>0?k-1:-1,x<NW-1?k+1:-1,k-NW,k+NW])if(n>=0&&n<NW*NH&&walkGrid[n]&&botField[n]>d){botField[n]=d;q.push(n)}}
}
function botInput(inp){
  let n=null,bd=1e9;for(const z of zombies){const d=(z.x-me.x)**2+(z.y-me.y)**2;if(d<bd){bd=d;n=z}}
  inp.fire=false;
  if(n){me.angle=Math.atan2(n.y-me.y,n.x-me.x);inp.fire=bd<150&&los(me.x,me.y,n.x,n.y)}
  let wx=0,wy=0;
  const want=pickups.find(k=>k.type[0]==='w'||(k.type.startsWith('med')&&me.hp<me.maxHp*.7)||k.life!=null);
  if(n&&bd<9){wx=me.x-n.x+Math.sin(clock)*.6;wy=me.y-n.y+Math.cos(clock)*.6}
  else if(want){const cx=clamp(Math.floor(me.x/NAV),0,NW-1),cy=clamp(Math.floor(me.y/NAV),0,NH-1);botNav(want);let bv=botField[cy*NW+cx];wx=want.x-me.x;wy=want.y-me.y;
    for(const [dx,dy] of NAV_DIRS){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=NW||ny>=NH)continue;const v=botField[ny*NW+nx];if(v<bv){bv=v;wx=(nx+.5)*NAV-me.x;wy=(ny+.5)*NAV-me.y}}}
  else{wx=16-me.x;wy=16.5-me.y;if(Math.hypot(wx,wy)<1.5)wx=wy=0}
  const m=Math.hypot(wx,wy)||1;inp.dx=(wx-wy)/m*.75;inp.dy=(wx+wy)/m*.75;inp.revive=true;
  if(me.offer)doAct('perk',{i:0});
  if(Math.random()<.004)doAct('swap',{d:1});
  if(n&&bd<20&&Math.random()<.01)doAct('nade',{x:n.x,y:n.y});
  if(n&&bd<1.2&&Math.random()<.1)doDash();
}
function readInput(){
  const inp=me.input;
  if(me.hp<=0||(overlayOpen()&&!botOn)){inp.dx=inp.dy=0;inp.fire=false;inp.revive=false;return}
  if(botOn){botInput(inp);return}
  inp.dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+tMove.x+pad.lx;
  inp.dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+tMove.y+pad.ly;
  let fire=mouse.down||tAim.fire||pad.fire;
  inp.revive=!!keys.e||actHeld||pad.use;
  if(aimSrc==='mouse'){const q=unproject(mouse.x,mouse.y);me.angle=Math.atan2(q.y-me.y,q.x-me.x)}
  else{
    let a=null;
    if(aimSrc==='touch'&&tAim.id!==null&&Math.hypot(tAim.x,tAim.y)>.2)a=worldAngle(tAim.x,tAim.y);
    else if(aimSrc==='pad'&&pad.aim)a=worldAngle(pad.rx,pad.ry);
    if(a!=null){const z=aimTarget(a,.27,11);me.angle=z&&los(me.x,me.y,z.x,z.y)?angLerp(a,Math.atan2(z.y-me.y,z.x-me.x),.75):a}
    else{const z=nearestVisible(9);if(z){me.angle=angLerp(me.angle,Math.atan2(z.y-me.y,z.x-me.x),.3);if(settings.autofire)fire=true}}
  }
  inp.fire=fire;
}
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT'){if(e.key==='Enter'&&e.target.id==='roomEntry')joinRoom($('roomEntry').value);return}
  const k=e.key.toLowerCase();keys[k]=true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k))e.preventDefault();
  if(e.repeat)return;
  unlockAudio();
  if(k==='escape'||k==='p'){togglePause();return}
  if(k==='m'){setMuted(!AU.muted);return}
  if(state!=='playing'||!me||overlayOpen())return;
  if(aimSrc==='pad')aimSrc='mouse';
  if(k==='e')doAct('interact');
  else if(k==='r')doAct('reload');
  else if(k==='q')doAct('swap',{d:1});
  else if(k==='g')doNade();
  else if(k==='shift'||k===' ')doDash();
  else if(k.length===1&&k>='1'&&k<='6'){const n=+k-1;if(me.offer&&n<3&&me.offer[n])doAct('perk',{i:n});else doAct('gun',{n})}
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
function clearHeld(){for(const k of Object.keys(keys))keys[k]=false;mouse.down=false;actHeld=false}
addEventListener('blur',clearHeld);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeld()});

function stickEl(id,t,show){
  const el=$(id);el.style.display=show?'block':'none';
  if(show){el.style.left=t.ox+'px';el.style.top=t.oy+'px';el.firstElementChild.style.transform=`translate(${t.x*38}px,${t.y*38}px)`}
}
function stickSet(t,e){
  let x=(e.clientX-t.ox)/52,y=(e.clientY-t.oy)/52;const m=Math.hypot(x,y);
  if(m>1){x/=m;y/=m;t.ox=e.clientX-x*52;t.oy=e.clientY-y*52} // the stick follows a thumb that drifts
  t.x=x;t.y=y;
}
canvas.addEventListener('pointerdown',e=>{
  unlockAudio();
  if(e.pointerType==='mouse'){
    aimSrc='mouse';mouse.x=e.clientX;mouse.y=e.clientY;
    if(e.button===0)mouse.down=true;else if(e.button===2)doNade();
    return;
  }
  e.preventDefault();aimSrc='touch';
  const t=e.clientX<W*.45?tMove:tAim;if(t.id!==null)return;
  t.id=e.pointerId;t.ox=e.clientX;t.oy=e.clientY;t.x=t.y=0;try{canvas.setPointerCapture(e.pointerId)}catch(err){}
  stickEl(t===tMove?'stickL':'stickR',t,true);
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse'){mouse.x=e.clientX;mouse.y=e.clientY;if(aimSrc!=='mouse'&&Math.abs(e.movementX)+Math.abs(e.movementY)>2)aimSrc='mouse';return}
  const t=e.pointerId===tMove.id?tMove:e.pointerId===tAim.id?tAim:null;if(!t)return;
  stickSet(t,e);if(t===tAim)tAim.fire=Math.hypot(t.x,t.y)>.3;
  stickEl(t===tMove?'stickL':'stickR',t,true);
});
function pointerEnd(e){
  if(e.pointerType==='mouse'){if(e.button===0||e.type==='pointercancel')mouse.down=false;return}
  const t=e.pointerId===tMove.id?tMove:e.pointerId===tAim.id?tAim:null;if(!t)return;
  t.id=null;t.x=t.y=0;if(t===tAim)tAim.fire=false;stickEl(t===tMove?'stickL':'stickR',t,false);
}
addEventListener('pointerup',pointerEnd);addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(state==='playing'&&me&&!overlayOpen())doAct('swap',{d:e.deltaY>0?1:-1})},{passive:true});
function tbtn(id,down,up){
  const el=$(id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();unlockAudio();aimSrc=e.pointerType==='mouse'?aimSrc:'touch';down()});
  if(up)for(const ev of ['pointerup','pointercancel','pointerleave'])el.addEventListener(ev,up);
}
tbtn('tDash',doDash);tbtn('tNade',doNade);tbtn('tReload',()=>doAct('reload'));tbtn('tSwap',()=>doAct('swap',{d:1}));
tbtn('tAct',()=>{actHeld=true;doAct('interact')},()=>{actHeld=false});

function pollPad(){
  const gp=navigator.getGamepads?[...navigator.getGamepads()].find(g=>g&&g.connected):null;
  if(!gp){pad.lx=pad.ly=0;pad.fire=pad.use=pad.aim=false;return}
  const dz=v=>Math.abs(v)<.22?0:v,b=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed),hit=i=>b(i)&&!pad.prev[i];
  pad.lx=dz(gp.axes[0]||0);pad.ly=dz(gp.axes[1]||0);pad.rx=dz(gp.axes[2]||0);pad.ry=dz(gp.axes[3]||0);
  pad.aim=Math.hypot(pad.rx,pad.ry)>.3;pad.fire=b(7)||(gp.buttons[7]&&gp.buttons[7].value>.3);pad.use=b(1);
  if(pad.aim||pad.fire||pad.lx||pad.ly){if(aimSrc!=='pad')unlockAudio();aimSrc='pad'}
  if(state==='playing'&&me&&!overlayOpen()){
    if(hit(0))doDash();if(hit(1))doAct('interact');if(hit(2))doAct('reload');if(hit(3))doAct('swap',{d:1});if(hit(5))doNade();
    if(me.offer){if(hit(14))doAct('perk',{i:0});if(hit(12))doAct('perk',{i:1});if(hit(15))doAct('perk',{i:2})}
  }
  if(hit(9))togglePause();
  pad.prev=gp.buttons.map(x=>x.pressed);
}

// ---------------------------------------------------------------- HUD
let hudKey={},hudTimer=0;
function setHTML(id,html){if(hudKey[id]!==html){hudKey[id]=html;$(id).innerHTML=html}}
function setText(id,t){if(hudKey[id]!==t){hudKey[id]=t;$(id).textContent=t}}
function hudUpdate(){
  if(!me||state==='menu')return;
  const frac=clamp(me.hp/me.maxHp,0,1);
  $('hpFill').style.transform=$('hpGhost').style.transform=`scaleX(${frac})`;
  $('hpBar').className=frac>.5?'ok':frac>.25?'mid':'';
  setText('hpText',Math.max(0,Math.ceil(me.hp))+' / '+me.maxHp);
  const left=spawnLeft+zombies.length;
  setText('waveP','WAVE '+Math.max(1,wave)+(left&&intermission<=0?' · '+left+' LEFT':''));
  setText('scoreP','★ '+teamScore.toLocaleString()+' · '+kills+' KILLS');
  setText('comboP',me.combo>=5?'x'+(1+Math.min(4,Math.floor(me.combo/5)*.5))+' COMBO · '+me.combo:'');
  let b='';
  if(buffs.dmg>0)b+=`<span class="pill">x2 DAMAGE ${Math.ceil(buffs.dmg)}s</span>`;
  if(buffs.rapid>0)b+=`<span class="pill">RAPID FIRE ${Math.ceil(buffs.rapid)}s</span>`;
  const pe=Object.keys(me.perks);if(pe.length)b+=`<span class="pill" style="color:#cfe9ff;border-color:#7fd8ff55">${pe.map(k=>PERKS[k].i+(me.perks[k]>1?me.perks[k]:'')).join(' ')}</span>`;
  setHTML('buffs',b);
  setHTML('team',netPlaying?players.filter(p=>p!==me).map(p=>`<div class="mate${p.hp<=0?' down':''}"><i class="dot" style="background:${(characters[p.character]||characters[0]).color}"></i>${escapeHTML(p.name)}<span class="bar"><i style="width:${Math.round(clamp(p.hp/p.maxHp,0,1)*100)}%"></i></span>${p.hp<=0?'DOWN':''}</div>`).join(''):'');
  setText('pingP',netPlaying?(netHost?'HOST · ':'')+netPing+' ms':'');
  const boss=zombies.find(z=>ZT[z.t].boss);
  $('bossWrap').style.display=boss&&state==='playing'?'block':'none';
  if(boss){setText('bossName',ZT[boss.t].label);$('bossFill').style.transform=`scaleX(${clamp(boss.hp/boss.maxHp,0,1)})`}
  setHTML('slots',GUNS.map((g,i)=>`<span class="slot${owned(i)?' own':''}${i===me.weapon?' cur':''}">${i+1} ${owned(i)?g.name:'?'}</span>`).join(''));
  const clip=clipOf(me,me.weapon),am=me.ammo[me.weapon];
  setText('ammoBig',me.reload>0?'RELOADING':(COARSE?GUNS[me.weapon].name+' ':'')+am+' / '+clip);
  $('ammoBig').className=me.reload<=0&&am<=clip*.2?'low':'';
  setHTML('subInfo',`<span>💣 ${me.grenades}</span><span style="color:${me.dashCd>0?'#ffffff66':'#9fe3ff'}">DASH ${me.dashCd>0?'…':'READY'}</span>`);
  // perk draft
  const of=me.offer&&state==='playing'?me.offer.join(','):'';
  if(hudKey.offer!==of){
    hudKey.offer=of;const root=$('perks');root.innerHTML='';root.style.display=of?'flex':'none';
    if(of)me.offer.forEach((k,i)=>{
      const d=document.createElement('div');d.className='perk';const lv=pk(me,k);
      d.innerHTML=`<em>${PERKS[k].i}</em><b>${PERKS[k].n}${lv?' '+'I'.repeat(lv+1):''}</b><span>${PERKS[k].d}</span><kbd>${COARSE?'TAP':'PRESS '+(i+1)}</kbd>`;
      d.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();doAct('perk',{i})});root.appendChild(d);
    });
  }
  const canAct=me.hp>0&&(nearDoor(me)||nearRadio(me)||(netPlaying&&players.some(p=>p!==me&&p.hp<=0&&Math.hypot(p.x-me.x,p.y-me.y)<1.45)));
  $('tAct').style.display=canAct?'block':'none';
  drawMinimap();
}

// ---------------------------------------------------------------- buttons
function click(id,fn){$(id).addEventListener('click',e=>{unlockAudio();sfx('click');fn(e)})}
let settingsBack='scrMain';
click('start',startSolo);
click('createRoom',()=>{settings.name=myName();saveSettings();netConnect(()=>netSend({t:'create',name:settings.name,character:chosenCharacter}))});
click('joinRoom',()=>{$('joinBox').classList.toggle('on');if($('joinBox').classList.contains('on'))$('roomEntry').focus()});
click('connectJoin',()=>joinRoom($('roomEntry').value));
click('howBtn',()=>showScreen('scrHow'));
click('setBtn',()=>{settingsBack='scrMain';showScreen('scrSettings')});
click('pauseSet',()=>{settingsBack='scrPause';showScreen('scrSettings')});
for(const b of document.querySelectorAll('.back'))b.addEventListener('click',()=>{sfx('click');showScreen(curScreen==='scrSettings'?settingsBack:'scrMain')});
click('readyBtn',()=>{const m=netMembers.find(x=>x.id===netId);netSend({t:'ready',ready:!(m&&m.ready)})});
click('hostStart',()=>netSend({t:'start',wave:clamp(Math.floor(Number($('waveTest').value)||1),1,100)}));
click('leaveRoom',()=>{netLeave();setStatus('');showScreen('scrMain')});
click('copyLink',()=>{
  const url=location.origin+location.pathname+'?room='+netCode;
  const done=()=>toast('Invite link copied');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done,()=>window.prompt('Copy this invite link',url));
  else window.prompt('Copy this invite link',url);
});
click('resumeBtn',togglePause);
click('quitBtn',()=>{if(net)netLeave();toMenu()});
click('againBtn',()=>{if(!netPlaying)startSolo();else if(netHost)netSend({t:'reset'})});
click('overMenu',()=>{if(net)netLeave();toMenu()});
click('dropMenu',toMenu);
click('rejoinBtn',()=>{toMenu();joinRoom(rejoinCode)});
click('pause',togglePause);
click('muteBtn',()=>setMuted(!AU.muted));
click('fsBtn',()=>{
  const d=document,el=d.documentElement;
  if(d.fullscreenElement||d.webkitFullscreenElement)(d.exitFullscreen||d.webkitExitFullscreen).call(d);
  else{const r=el.requestFullscreen||el.webkitRequestFullscreen;if(r){const p=r.call(el);if(p&&p.then)p.then(()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}).catch(()=>{})}}
});
$('volRange').value=Math.round(settings.vol*100);
$('volRange').addEventListener('input',e=>{settings.vol=e.target.value/100;saveSettings();if(AU.master)AU.master.gain.value=masterVol()});
$('shakeChk').checked=settings.shake;$('shakeChk').addEventListener('change',e=>{settings.shake=e.target.checked;saveSettings()});
$('lightChk').checked=settings.light;$('lightChk').addEventListener('change',e=>{settings.light=e.target.checked;saveSettings()});
$('autoChk').checked=settings.autofire;$('autoChk').addEventListener('change',e=>{settings.autofire=e.target.checked;saveSettings()});
$('playerName').value=settings.name||'';
addEventListener('pointerdown',()=>unlockAudio(),{passive:true});

// ---------------------------------------------------------------- main loop
let last=performance.now(),fpsAcc=0,fpsN=0,slowT=0;
function step(dt){
  if(state!=='playing')return;
  if(isClient())clientFrame(dt);
  else{readInput();update(dt);if(netPlaying&&netHost&&state==='playing')hostNet(dt)}
}
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;clock+=dt;
  pollPad();step(dt);netTick(dt);
  if(state!=='paused')fxUpdate(dt);
  updateHorde(dt);updateHeart(dt);syncRadio();
  draw(dt);
  hudTimer-=dt;if(hudTimer<=0){hudTimer=.1;hudUpdate()}
  // adaptive quality: drop the resolution a notch if a phone cannot keep up
  fpsAcc+=dt;fpsN++;
  if(fpsAcc>=2){const fps=fpsN/fpsAcc;fpsAcc=0;fpsN=0;if(fps<38&&dpr>1&&state==='playing'){slowT++;if(slowT>=2){slowT=0;dprCap=Math.max(1,dpr-.5);resize()}}else slowT=0}
  requestAnimationFrame(frame);
}
// A hidden tab stops requestAnimationFrame. If this browser is hosting, keep the
// simulation alive from a worker timer so the other players are not frozen.
try{
  const w=new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),50)'],{type:'text/javascript'})));
  w.onmessage=()=>{if(document.hidden&&state==='playing'&&netPlaying&&netHost){clock+=.05;step(.05);netTick(.05);fxUpdate(.05)}};
}catch(e){}

// ---------------------------------------------------------------- boot
addEventListener('resize',resize);
if(window.visualViewport)visualViewport.addEventListener('resize',resize);
resize();build();buildFloor();mainChars();
$('ver').textContent='V41';$('bestLine').textContent=bestLine();
showScreen('scrMain');
if(location.protocol==='file:')setStatus('Solo works from this file. Online co-op needs the server (npm start).');
const inviteCode=(QUERY.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
if(inviteCode){$('roomEntry').value=inviteCode;$('joinBox').classList.add('on');setStatus('You were invited to room '+inviteCode+'. Pick a survivor and press JOIN.')}
requestAnimationFrame(frame);

// Small debug surface, also handy for automated tests: MOTD.bot(true) plays by itself.
window.MOTD={
  info:()=>({state,wave,kills,score:teamScore,zombies:zombies.length,players:players.map(p=>({id:p.id,name:p.name,hp:Math.round(p.hp),x:r2(p.x),y:r2(p.y),weapon:p.weapon,kills:p.kills,perks:p.perks})),
    netPlaying,netHost,netId,code:netCode,members:netMembers.length,ping:netPing,owned:teamOwned,intermission:r2(intermission),screen:curScreen,particles:particles.length}),
  bot:v=>{botOn=!!v},
  startSolo,
  sim(seconds){const n=Math.round(seconds*30);for(let i=0;i<n&&state==='playing';i++){clock+=1/30;step(1/30);fxUpdate(1/30)}return this.info()},
  give(type){if(me&&!isClient())pickups.push({id:nextEid++,type,x:me.x,y:me.y})},
  spawn(t,n=1){if(!isClient())for(let i=0;i<n;i++){let x,y,g=0;do{x=clamp(me.x+rand(-6,6),1,world.w-1);y=clamp(me.y+rand(-6,6),1,world.h-1)}while(g++<40&&(collision(x,y,.6)||Math.hypot(x-me.x,y-me.y)<3));spawnZombieAt(t,x,y,ZT[t].boss?{slamCd:3.5,slamWind:0,chargeCd:4,chargeWind:0,charging:0,cvx:0,cvy:0,giftCd:3,elfCd:6,enraged:false}:undefined)}},
  hurt(n){if(me&&!isClient())hurtPlayer(me,n,{pure:true})},
  me:()=>me
};
