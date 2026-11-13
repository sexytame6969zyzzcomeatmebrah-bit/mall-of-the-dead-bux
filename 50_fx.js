// ============================================================================
//  effects: particles, floating text, telegraphs, corpses, the persistent
//  floor canvas (blood and scorch marks stay for the whole run) and playFx(),
//  the single entry point for everything the simulation wants shown or heard.
// ============================================================================
let particles=[],texts=[],rings=[],flashes=[],corpses=[],beams=[],shake=0,hurtFlash=0,nukeFlash=0,banner=null,fxFromNet=false;
function clearFx(){particles=[];texts=[];rings=[];flashes=[];corpses=[];beams=[];shake=0;hurtFlash=0;nukeFlash=0;banner=null}
function addP(p){if(particles.length<650)particles.push(p)}
function addShake(a,x,y){
  if(!settings.shake)return;
  if(x!=null&&me)a*=clamp(1.15-Math.hypot(x-me.x,y-me.y)/14,0,1);
  shake=Math.min(16,Math.max(shake,a));
}
function burst(x,y,n,colors,speed,life,size,z=.5,g=6){
  for(let i=0;i<n;i++){const a=rand(0,TAU),v=rand(.3,speed);addP({x,y,z,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:rand(.5,3),g,life:rand(life*.5,life),max:life,color:pick(colors),size:rand(size*.5,size),k:0})}
}
function fireBurst(x,y,n,r){
  for(let i=0;i<n;i++){const a=rand(0,TAU),d=rand(0,r);addP({x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,z:rand(.1,.5),vx:rand(-.6,.6),vy:rand(-.6,.6),vz:rand(.8,2.6),g:-1,life:rand(.25,.7),max:.7,color:pick(['#ffd35a','#ff9a3c','#ff5a2a']),size:rand(7,16),k:1})}
}
function smoke(x,y,n,r){
  for(let i=0;i<n;i++){const a=rand(0,TAU),d=rand(0,r);addP({x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,z:.4,vx:rand(-.4,.4),vy:rand(-.4,.4),vz:rand(.6,1.5),g:-.3,life:rand(.7,1.5),max:1.5,color:'#2b2f36',size:rand(12,26),k:2})}
}

// ---------------------------------------------------------------- floor canvas
const FM=4,FX0=(world.h+2*FM)*TILE,FY0=2*FM*TILE*ISOY,FWID=(world.w+world.h+4*FM)*TILE,FHEI=(world.w+world.h+4*FM)*TILE*ISOY;
const FS=COARSE?1:1.25;
let floorCv=null,fctx=null;
const fproj=(x,y)=>({x:(x-y)*TILE+FX0,y:(x+y)*TILE*ISOY+FY0});
function fpoly(pts,fill,stroke){
  fctx.beginPath();const a=fproj(pts[0][0],pts[0][1]);fctx.moveTo(a.x,a.y);
  for(let i=1;i<pts.length;i++){const q=fproj(pts[i][0],pts[i][1]);fctx.lineTo(q.x,q.y)}
  fctx.closePath();if(fill){fctx.fillStyle=fill;fctx.fill()}if(stroke){fctx.strokeStyle=stroke;fctx.lineWidth=1;fctx.stroke()}
}
function buildFloor(){
  if(!floorCv){floorCv=document.createElement('canvas');floorCv.width=Math.ceil(FWID*FS);floorCv.height=Math.ceil(FHEI*FS);fctx=floorCv.getContext('2d')}
  fctx.setTransform(FS,0,0,FS,0,0);fctx.clearRect(0,0,FWID,FHEI);
  // snowy car park outside
  fpoly([[-FM,-FM],[world.w+FM,-FM],[world.w+FM,world.h+FM],[-FM,world.h+FM]],'#b9c7d6');
  for(let i=0;i<900;i++){const x=rand(-FM,world.w+FM),y=rand(-FM,world.h+FM);if(x>0&&y>0&&x<world.w&&y<world.h)continue;const q=fproj(x,y);fctx.fillStyle=Math.random()<.5?'#d7e2ec':'#a3b3c4';fctx.fillRect(q.x,q.y,rand(2,7),rand(1,3))}
  // trampled slush leading to each gate
  for(const [x0,y0,x1,y1] of [[12.4,-FM,19.6,.3],[12.4,world.h-.3,19.6,world.h+FM],[-FM,10.4,.3,15.6],[world.w-.3,10.4,world.w+FM,15.6]])fpoly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'#8e9bab');
  // tiles
  for(let y=0;y<world.h;y++)for(let x=0;x<world.w;x++){
    const edge=x===0||y===0||x===world.w-1||y===world.h-1,odd=(x+y)%2;
    let c=edge?'#78868c':odd?'#b4b7ad':'#c2c3b8';
    if(!edge){
      if(x>=2&&x<9&&y>=19&&y<24)c=odd?'#5d6b7b':'#566474';                     // office carpet
      else if(x<8&&y>=6&&y<18)c=odd?'#bfae96':'#c9b9a2';                       // food court
      else if(Math.hypot(x+.5-16,y+.5-12)<6.4)c=odd?'#c3c2b4':'#d2d1c4';       // atrium
    }
    fpoly([[x,y],[x+1,y],[x+1,y+1],[x,y+1]],c,'#9a9a9840');
  }
  // atrium ring and red carpet runners from the gates
  fctx.save();fctx.globalAlpha=.55;
  for(const [x0,y0,x1,y1] of [[15,1,17,10.1],[15,13,17,25],[1,12,14,14],[22.6,12,31,14]]){
    fpoly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'#9c2b34');
  }
  fctx.restore();
  fctx.save();const c0=fproj(16,12);fctx.translate(c0.x,c0.y);fctx.scale(1,ISOY);fctx.strokeStyle='#b9944f88';fctx.lineWidth=5;fctx.beginPath();fctx.arc(0,0,6.4*TILE*1.414,0,TAU);fctx.stroke();fctx.restore();
  // entrance mats
  for(const [x0,y0,x1,y1] of [[13,.8,19,1.6],[13,24.4,19,25.2],[.8,10.8,1.6,15.2],[30.4,10.8,31.2,15.2]])fpoly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'#3b4650cc','#20282f');
  // subtle grime
  fctx.globalAlpha=.05;for(let i=0;i<260;i++){const q=fproj(rand(1,world.w-1),rand(1,world.h-1));fctx.fillStyle='#000';fctx.beginPath();fctx.ellipse(q.x,q.y,rand(8,34),rand(4,14),0,0,TAU);fctx.fill()}
  fctx.globalAlpha=1;
}
function stamp(x,y,r,color,alpha){
  if(!fctx||x<0||y<0||x>world.w||y>world.h)return;
  const q=fproj(x,y);fctx.globalAlpha=alpha;fctx.fillStyle=color;fctx.beginPath();fctx.ellipse(q.x,q.y,r*TILE*1.3,r*TILE*.62,rand(-.4,.4),0,TAU);fctx.fill();fctx.globalAlpha=1;
}
function stampBlood(x,y,n,spread,big){
  for(let i=0;i<n;i++){const a=rand(0,TAU),r=rand(.03,spread);stamp(x+Math.cos(a)*r,y+Math.sin(a)*r,rand(.04,big),Math.random()<.4?'#5e1016':'#7d1a21',rand(.35,.75))}
}
const Z_BODY=['#718c67','#bd6558','#16191d','#e02f38','#5d7a4b','#8a9a3c','#9fb23e','#2c3e55','#4c273d','#b81f2a'];
function stampCorpse(c){
  if(!fctx)return;
  const i=ZT[c.t].i,q=fproj(c.x,c.y),s={giant:1.8,santa:1.7,crawler:.65,bloater:1.3}[c.t]||1;
  fctx.save();fctx.translate(q.x,q.y);fctx.rotate(c.rot);fctx.scale(s,s*.62);
  fctx.globalAlpha=.9;fctx.fillStyle=shade(c.elf?'#2e8b4a':Z_BODY[i],-25);fctx.beginPath();fctx.roundRect(-11,-7,22,14,5);fctx.fill();
  fctx.fillStyle='#27343c';fctx.fillRect(-21,-6,11,5);fctx.fillRect(-21,1,11,5);
  fctx.fillStyle=i>=8?'#8f8f7a':'#93a391';fctx.beginPath();fctx.arc(15,0,7,0,TAU);fctx.fill();
  fctx.restore();fctx.globalAlpha=1;
}

// ---------------------------------------------------------------- playFx
function playFx(ev){
  switch(ev[0]){
    case 'shot':{
      if(fxFromNet&&ev[1]===netId)break;
      const [,pid,w,x,y,a]=ev,g=GUNS[w],p=playerById(pid),mx=x+Math.cos(a)*.85,my=y+Math.sin(a)*.85;
      if(p)p.flash=.06;
      flashes.push({x:mx,y:my,z:.6,r:g.flame?1.7:g.rail?3.6:2.7,life:.07,max:.07,c:g.flame?'#ff9a3c':g.rail?'#8fe9ff':'#ffd79a'});
      if(!g.flame&&!g.rail&&!g.boom){const sa=a+Math.PI/2*(Math.random()<.5?1:-1);addP({x,y,z:.62,vx:Math.cos(sa)*rand(.8,1.6),vy:Math.sin(sa)*rand(.8,1.6),vz:rand(1.6,2.6),g:9,life:.55,max:.55,color:w===2?'#c0392b':'#d8b45a',size:w===2?4:3,k:0})}
      if(g.rail){const h=raycast(mx,my,a,40);beams.push({x0:mx,y0:my,x1:h.x,y1:h.y,life:.28,max:.28})}
      if(g.boom)smoke(mx,my,2,.1);
      sfx('gun'+w,x,y);
      if(p===me){addShake(w===2?4.5:w===5?6:w===3?3.5:w===4?.6:1.6);if(COARSE&&navigator.vibrate&&w!==4&&w!==1&&w!==0)navigator.vibrate(12)}
      break}
    case 'txt':texts.push({text:ev[1],x:ev[2],y:ev[3],z:1.5,life:ev[5],max:ev[5],color:ev[4],size:ev[6]||18});break;
    case 'dmg':
      if(texts.length<60)texts.push({text:String(ev[3]),x:ev[1]+rand(-.25,.25),y:ev[2]+rand(-.25,.25),z:1.25,life:.55,max:.55,color:ev[4]?'#ffe14d':'#ffffff',size:ev[4]?18:11,small:true});
      break;
    case 'blood':{
      const dead=ev[3];burst(ev[1],ev[2],dead?9:4,['#8f151c','#cf3038','#cf3038'],dead?4.4:3,.45,5);
      stampBlood(ev[1],ev[2],dead?4:1,dead?.5:.28,dead?.17:.1);sfx('hit',ev[1],ev[2]);break}
    case 'die':{
      const t=ZNAMES[ev[1]],boss=ZT[t].boss;
      corpses.push({t,x:ev[2],y:ev[3],angle:ev[4],seed:ev[5],elf:ev[6],life:.38,max:.38,rot:rand(0,TAU)});
      burst(ev[2],ev[3],boss?40:8,t==='bloater'?['#9fbf3a','#6d8a22','#cf3038']:['#8f151c','#cf3038'],boss?7:4,.5,boss?8:5);
      stampBlood(ev[2],ev[3],boss?16:5,boss?1.6:.55,boss?.3:.19);sfx('squish',ev[2],ev[3]);break}
    case 'boom':{
      const [,x,y,r,kind]=ev,green=kind===1,gift=kind===4;
      flashes.push({x,y,z:.5,r:r*3.2,life:.22,max:.22,c:green?'#c8ff7a':'#ffc56a'});
      rings.push({k:9,x,y,r,life:.32,max:.32,c:green?'#c8ff7a':'#ffb061'});
      if(green){burst(x,y,26,['#9fbf3a','#6d8a22','#b8d64a','#cf3038'],6,.6,7);stamp(x,y,r*.5,'#56701c',.5)}
      else if(gift){burst(x,y,22,['#ff5a5a','#5ad1ff','#ffe14d','#7dff8a','#ffffff'],6,.7,5);fireBurst(x,y,6,r*.4);stamp(x,y,r*.45,'#1b1b1e',.4)}
      else{fireBurst(x,y,kind===3?34:16,r*.55);smoke(x,y,kind===3?12:6,r*.5);burst(x,y,12,['#ffd35a','#ff9a3c','#6b6b6b'],7,.5,4);stamp(x,y,r*.4,'#141416',.38)}
      addShake(kind===3?16:r*4.2,x,y);sfx(green?'squish':'boom',x,y);if(green)sfx('boom',x,y);
      if(COARSE&&navigator.vibrate&&me&&Math.hypot(x-me.x,y-me.y)<6)navigator.vibrate(30);
      break}
    case 'spark':burst(ev[1],ev[2],3,['#ffe9a0','#fff','#c9c9c9'],3,.22,3,.55,4);break;
    case 'clang':burst(ev[1],ev[2],4,['#cfe9ff','#fff'],4,.25,3,.7,4);sfx('clang',ev[1],ev[2]);break;
    case 'snd':sfx(ev[1],ev[2],ev[3]);break;
    case 'voice':{const p=playerById(ev[1]);if(p){charVoice(p,ev[2]);if(ev[2]==='streak')p.shoutTimer=1.5}break}
    case 'shake':addShake(ev[1],ev[2],ev[3]);break;
    case 'hurt':{
      const p=playerById(ev[1]);if(!p)break;p.hurtT=.18;burst(p.x,p.y,3,['#cf3038','#8f151c'],2.5,.35,4,.8);
      if(p===me){hurtFlash=Math.min(.6,hurtFlash+.22+ev[2]*.012);sfx('hurt');if(COARSE&&navigator.vibrate)navigator.vibrate(25)}
      break}
    case 'down':sfx('down');break;
    case 'revive':{const p=playerById(ev[1]);sfx('revive');if(p)rings.push({k:9,x:p.x,y:p.y,r:1.6,life:.6,max:.6,c:'#7fffc1'});break}
    case 'dash':{if(fxFromNet&&ev[1]===netId)break;const p=playerById(ev[1]);if(p){sfx('dash',p.x,p.y);burst(p.x,p.y,7,['#ffffff','#cfe9ff'],2,.3,4,.3,0)}break}
    case 'perk':{const p=playerById(ev[1]);if(p){texts.push({text:PERKS[ev[2]].i+' '+PERKS[ev[2]].n.toUpperCase(),x:p.x,y:p.y,z:2.1,life:1.6,max:1.6,color:'#9fe3ff',size:14});if(p===me)sfx('perk')}break}
    case 'wave':banner={text:(ev[2]?'BOSS WAVE ':'WAVE ')+ev[1],sub:ev[2]?(ev[1]%10===0?'ZOMBIE SANTA':'THE GIANT'):'',life:2.6,max:2.6,color:ev[2]?'#ff7777':'#ffd475'};sfx(ev[2]?'boss':'wave');break;
    case 'clear':banner={text:ev[2]?'BOSS DEFEATED':'WAVE '+ev[1]+' CLEARED',sub:'CHOOSE A PERK',life:3.2,max:3.2,color:'#9bffb5'};sfx('clear');break;
    case 'slam':rings.push({k:9,x:ev[1],y:ev[2],r:ev[3],life:.48,max:.48,c:'#ff8248'});burst(ev[1],ev[2],20,['#b9b9a8','#8f8f84'],6,.5,5,.1,3);addShake(13,ev[1],ev[2]);sfx('thump',ev[1],ev[2]);break;
    case 'tele':rings.push({k:ev[1],x:ev[2],y:ev[3],r:ev[4],life:ev[5],max:ev[5],c:'#ffbd66'});break;
    case 'nuke':nukeFlash=1;sfx('nuke');addShake(15);break;
  }
}

function fxUpdate(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=p.g*dt;
    if(p.z<0){p.z=0;p.vz*=-.35;p.vx*=.5;p.vy*=.5;if(p.k===0&&p.color[1]==='c'&&Math.random()<.15)stamp(p.x,p.y,.05,'#7d1a21',.5)}
  }
  for(let i=texts.length-1;i>=0;i--){const t=texts[i];t.life-=dt;t.z+=dt*(t.small?1.3:.75);if(t.life<=0)texts.splice(i,1)}
  for(let i=rings.length-1;i>=0;i--){rings[i].life-=dt;if(rings[i].life<=0)rings.splice(i,1)}
  for(let i=flashes.length-1;i>=0;i--){flashes[i].life-=dt;if(flashes[i].life<=0)flashes.splice(i,1)}
  for(let i=beams.length-1;i>=0;i--){beams[i].life-=dt;if(beams[i].life<=0)beams.splice(i,1)}
  for(let i=corpses.length-1;i>=0;i--){const c=corpses[i];c.life-=dt;if(c.life<=0){stampCorpse(c);corpses.splice(i,1)}}
  if(banner){banner.life-=dt;if(banner.life<=0)banner=null}
  shake=Math.max(0,shake-dt*26);hurtFlash=Math.max(0,hurtFlash-dt*1.4);nukeFlash=Math.max(0,nukeFlash-dt*1.2);
  for(const p of players){p.flash=Math.max(0,p.flash-dt);p.hurtT=Math.max(0,p.hurtT-dt)}
  // ambient emitters
  if(state==='playing'||state==='over'){
    for(const z of zombies){
      const burning=isClient()?(z.flags&2):z.burn>0;
      if(burning&&Math.random()<dt*14)addP({x:z.x+rand(-.2,.2),y:z.y+rand(-.2,.2),z:rand(.3,.9),vx:0,vy:0,vz:rand(1,2),g:-1,life:.4,max:.4,color:pick(['#ffd35a','#ff9a3c']),size:rand(6,11),k:1});
    }
    for(const h of hazards){
      if(h.k===1&&Math.random()<dt*26)fireBurst(h.x,h.y,1,h.r);
      else if(h.k===0&&Math.random()<dt*5)addP({x:h.x+rand(-h.r,h.r)*.6,y:h.y+rand(-h.r,h.r)*.6,z:0,vx:0,vy:0,vz:rand(.4,.9),g:0,life:.5,max:.5,color:'#b8f24a',size:rand(3,5),k:1});
    }
    for(const b of bullets)if(b.k===2&&Math.random()<dt*50)smoke(b.x,b.y,1,.05);
    // reload clicks for the local survivor, driven by progress so they work for guests too
    if(me&&me.reload>0&&me.reloadTotal>0){
      const pr=1-me.reload/me.reloadTotal;
      if(me.reloadStage<1){me.reloadStage=1;sfx('rel0')}
      if(me.reloadStage<2&&pr>=.28){me.reloadStage=2;sfx('rel1')}
      if(me.reloadStage<3&&pr>=.69){me.reloadStage=3;sfx('rel2')}
    }else if(me&&me.reloadStage>0){if(me.reloadStage>=3)sfx('rel3');me.reloadStage=0}
  }
}
