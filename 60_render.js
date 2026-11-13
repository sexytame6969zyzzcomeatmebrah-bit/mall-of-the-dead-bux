// ============================================================================
//  rendering: isometric world, characters, dynamic lighting, glow pass, HUD
//  overlays drawn on the canvas.
// ============================================================================
function poly(points,fill,stroke){
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}
}
function shade(hex,n){const v=parseInt(hex.slice(1,7),16);const r=clamp((v>>16)+n,0,255),g=clamp(((v>>8)&255)+n,0,255),b=clamp((v&255)+n,0,255);return `rgb(${r},${g},${b})`}
function box3(x,y,w,h,z,color,top){
  const a=project(x,y),b=project(x+w,y),c=project(x+w,y+h),d=project(x,y+h),A=project(x,y,z),B=project(x+w,y,z),C=project(x+w,y+h,z),D=project(x,y+h,z);
  poly([d,c,C,D],shade(color,-18));poly([b,c,C,B],shade(color,-30));poly([a,b,B,A],shade(color,-5));poly([a,d,D,A],shade(color,-22));poly([A,B,C,D],top||color,'#ffffff20');
}
const onScreen=(q,m=90)=>q.x>-m&&q.x<W+m&&q.y>-m&&q.y<H+m+60;
const XMAS=['#f0444a','#f6d967','#79d5ff','#7dff8a','#f6a8ef'];

// ---------------------------------------------------------------- props
const PROP_COLORS={wall:'#64717b',shopA:'#a6a0bb',shopB:'#d2a17f',shopC:'#8fb3ac',shopD:'#c0b18b',shopE:'#ad9bb6',shopF:'#a5bdc3',shopG:'#b8a89c',food:'#bd987c',bench:'#6e7982',planter:'#648b68',treeBase:'#b52e37',carPlatform:'#3b414b'};
const SHOP_NAMES={shopA:'FASHION',shopB:'TECH',shopC:'BOOKS',shopD:'GAMES',shopE:'AR AUTO',shopF:'SPORTS',shopG:'GIFTS'};
function drawProp(p){
  if(p.type==='barrel'){
    if(!p.alive)return;
    box3(p.x+.06,p.y+.06,.38,.38,.62,'#b3262c','#d9434a');
    const q=project(p.x+.25,p.y+.44,.36);ctx.fillStyle='#ffd447';ctx.fillRect(q.x-7,q.y-3,14,5);ctx.fillStyle='#1b1b1b';ctx.font='900 6px system-ui';ctx.textAlign='center';ctx.fillText('!',q.x,q.y+2);
    return;
  }
  if(p.type==='officeDoor'){
    if(p.solid){
      box3(p.x,p.y,p.w,p.h,1.12,'#674633','#c6a476');
      const h=project(p.x+.21,p.y+.94,.66);ctx.fillStyle='#efcb75';ctx.beginPath();ctx.arc(h.x,h.y,3,0,TAU);ctx.fill();
      if(p.hp<120){const q=project(p.x+.21,p.y+.7,1.4);ctx.fillStyle='#240c16';ctx.fillRect(q.x-18,q.y,36,4);ctx.fillStyle='#ffb061';ctx.fillRect(q.x-18,q.y,36*clamp(p.hp/120,0,1),4)}
    }else{const a=project(p.x+.21,p.y,.07),b=project(p.x+1.15,p.y,.07),c=project(p.x+1.15,p.y,1.12),d=project(p.x+.21,p.y,1.12);poly([a,b,c,d],p.broken>0?'#4a3225':'#674633','#c6a476')}
    return;
  }
  if(p.type==='radio'){
    const q=project(p.x,p.y,1.17);ctx.save();ctx.translate(q.x,q.y);ctx.fillStyle='#303940';ctx.strokeStyle='#c2a66c';ctx.lineWidth=2;ctx.fillRect(-15,-11,30,19);ctx.strokeRect(-15,-11,30,19);
    ctx.fillStyle=radioOn?'#b8f2c8':'#9ca7a6';ctx.fillRect(-11,-7,16,9);ctx.fillStyle='#e5c474';ctx.beginPath();ctx.arc(10,1,3,0,TAU);ctx.fill();
    ctx.strokeStyle='#c6cdd0';ctx.beginPath();ctx.moveTo(-10,-11);ctx.lineTo(-18,-29);ctx.stroke();
    if(radioOn){ctx.fillStyle='#ffe7a2';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('♪',-4+Math.sin(clock*3)*6,-26-((clock*14)%16))}
    ctx.restore();return;
  }
  if(p.type==='christmasTree'){drawChristmasTree(p);return}
  if(p.type==='bmwE30'){drawRaffleE30(p);return}
  if(p.type==='sign'){const q=project(p.x,p.y,.12);ctx.save();ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.lineWidth=2;ctx.strokeStyle='#172632';ctx.strokeText("NICK'S OFFICE",q.x,q.y);ctx.fillStyle='#e6edf2';ctx.fillText("NICK'S OFFICE",q.x,q.y);ctx.restore();return}
  const shop=p.type.startsWith('shop');
  const height=p.type==='wall'?1.45:shop?1.0:p.type==='food'?1.1:p.type==='treeBase'?.35:p.type==='carPlatform'?.19:p.type==='planter'?.62:.42;
  box3(p.x,p.y,p.w,p.h,height,PROP_COLORS[p.type]||'#8e9b9e',shop?'#e9d9ba':undefined);
  if(shop){const a=project(p.x+p.w/2,p.y+p.h,height+.05);ctx.fillStyle='#26343c';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(SHOP_NAMES[p.type],a.x,a.y-4)}
  if(p.type==='planter'){const c=project(p.x+p.w/2,p.y+p.h/2,1);ctx.fillStyle='#377b53';ctx.beginPath();ctx.ellipse(c.x,c.y,22,14,0,0,TAU);ctx.fill();ctx.fillStyle='#e8f1f6cc';ctx.beginPath();ctx.ellipse(c.x-3,c.y-5,13,6,0,0,TAU);ctx.fill()}
  if(p.type==='treeBase'){
    const q=project(p.x+p.w/2,p.y+p.h/2,.37);ctx.fillStyle='#ffe5b2';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('MERRY CHRISTMAS',q.x,q.y+5);
    // presents under the tree
    const gifts=[[.35,2.05,'#3b8fd6'],[.95,2.2,'#e0b13a'],[2.45,2.1,'#3fae5c'],[3.05,1.9,'#c44fb3'],[.4,.45,'#e0b13a'],[3.0,.4,'#3b8fd6']];
    for(const [gx,gy,col] of gifts){box3(p.x+gx,p.y+gy,.28,.28,.35+.22,col,shade(col,30));}
  }
  if(p.type==='wall'){ // fairy lights along the top edge
    const long=p.w>=p.h,len=long?p.w:p.h,n=Math.floor(len/.75);
    for(let i=0;i<=n;i++){
      const t=n?i/n:0,q=project(p.x+(long?t*p.w:p.w),p.y+(long?p.h:t*p.h),1.42+Math.sin(i*1.7)*.03);
      if(!onScreen(q,10))continue;
      const idx=(i+Math.floor(p.x*3+p.y*5))%5;ctx.globalAlpha=.55+.45*Math.sin(clock*3+i*1.3+p.x);ctx.fillStyle=XMAS[idx];ctx.beginPath();ctx.arc(q.x,q.y,2.3,0,TAU);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
}
function drawChristmasTree(p){
  const q=project(p.x,p.y,.38);ctx.save();ctx.translate(q.x,q.y);const pulse=Math.sin(clock*3);
  ctx.fillStyle='#67432d';ctx.fillRect(-7,-24,14,26);
  for(let i=0;i<4;i++){
    const y=-24-i*23,half=47-i*8;ctx.fillStyle=i%2?'#145d43':'#1c7650';ctx.beginPath();ctx.moveTo(0,y-62);ctx.lineTo(-half,y+7);ctx.lineTo(half,y+7);ctx.closePath();ctx.fill();
    ctx.fillStyle='#eef5fa55';ctx.beginPath();ctx.moveTo(0,y-62);ctx.lineTo(-half*.34,y-36);ctx.lineTo(half*.3,y-38);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#b6a35a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-half*.7,y-2);ctx.quadraticCurveTo(0,y+16,half*.7,y-2);ctx.stroke();
    for(let j=0;j<5;j++){const xx=(j-2)*half*.32,yy=y-8-(j%2)*12;ctx.fillStyle=['#f0444a','#f6d967','#79d5ff','#f6a8ef'][(i+j)%4];ctx.globalAlpha=.78+.22*Math.sin(clock*4+i*3+j*2);ctx.beginPath();ctx.arc(xx,yy,3.2,0,TAU);ctx.fill()}
  }
  ctx.globalAlpha=1;ctx.fillStyle='#ffdc68';ctx.shadowColor='#ffd663';ctx.shadowBlur=12+5*pulse;ctx.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?7:16;ctx.lineTo(Math.cos(a)*r,-168+Math.sin(a)*r)}
  ctx.closePath();ctx.fill();ctx.restore();
}
// Decorative isometric E30 coupe and a cordoned-off charity raffle stand.
function drawRaffleE30(){
  const x=18.3,y=11.1,w=4.1,h=2.55,deck=.2;
  const corners=[[x+.15,y+.15],[x+w-.15,y+.15],[x+w-.15,y+h-.15],[x+.15,y+h-.15]];
  const posts=corners.map(([px,py])=>project(px,py,deck+.9));
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(let i=0;i<4;i++){
    const a=posts[i],b=posts[(i+1)%4],mx=(a.x+b.x)/2,my=(a.y+b.y)/2+7;
    ctx.strokeStyle='#6b0d18';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mx,my,b.x,b.y);ctx.stroke();
    ctx.strokeStyle='#e24651';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y-1);ctx.quadraticCurveTo(mx,my-1,b.x,b.y-1);ctx.stroke();
  }
  const z=deck+.37,P=(a,b,c)=>project(a,b,c),roof='#262a30',glass='#354d60';
  const b=P(x+3.6,y+.65,z),c=P(x+3.6,y+1.94,z),d=P(x+.55,y+1.94,z);
  const A=P(x+.55,y+.65,z+.42),B=P(x+3.6,y+.65,z+.42),C=P(x+3.6,y+1.94,z+.42),D=P(x+.55,y+1.94,z+.42);
  poly([d,c,C,D],'#101418','#414b55');poly([b,c,C,B],'#20252b','#414b55');poly([A,B,C,D],roof,'#4d5860');
  const q1=P(x+1.25,y+.83,z+.42),q2=P(x+2.95,y+.83,z+.42),q3=P(x+2.95,y+1.76,z+.42),q4=P(x+1.25,y+1.76,z+.42);
  const r1=P(x+1.52,y+.94,z+.96),r2_=P(x+2.62,y+.94,z+.96),r3=P(x+2.62,y+1.65,z+.96),r4=P(x+1.52,y+1.65,z+.96);
  poly([q1,q2,r2_,r1],glass,'#d8e1e5');poly([q2,q3,r3,r2_],'#213847','#d8e1e5');poly([q3,q4,r4,r3],glass,'#d8e1e5');poly([r1,r2_,r3,r4],'#24282d','#64727d');
  const t1=P(x+1.58,y+1.95,z+.36),t2=P(x+2.65,y+1.95,z+.36);
  ctx.strokeStyle='#283743';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(t1.x,t1.y);ctx.lineTo(t2.x,t2.y);ctx.stroke();
  for(const xx of [x+1.12,x+3.02]){const wh=P(xx,y+1.99,deck+.18);ctx.fillStyle='#171c24';ctx.beginPath();ctx.ellipse(wh.x,wh.y,9,13,-.35,0,TAU);ctx.fill();ctx.fillStyle='#b8c1c7';ctx.beginPath();ctx.ellipse(wh.x,wh.y,4.6,7,-.35,0,TAU);ctx.fill()}
  poly([P(x+3.62,y+.63,z+.34),P(x+3.62,y+1.96,z+.34),P(x+3.62,y+1.96,z+.13),P(x+3.62,y+.63,z+.13)],'#26313a','#101820');
  for(const yy of [.80,1.01,1.60,1.81]){const hl=P(x+3.645,y+yy,z+.24);ctx.fillStyle='#d5d9cc';ctx.beginPath();ctx.ellipse(hl.x,hl.y,3.2,3.8,-.48,0,TAU);ctx.fill();ctx.fillStyle='#fff0ad';ctx.beginPath();ctx.ellipse(hl.x-.3,hl.y-.3,2.0,2.4,-.48,0,TAU);ctx.fill()}
  const grille=P(x+3.65,y+1.31,z+.23);ctx.fillStyle='#0b1015';ctx.fillRect(grille.x-4,grille.y-5,8,10);
  for(const [px,py] of corners){const foot=P(px,py,deck),top=P(px,py,deck+.94);ctx.strokeStyle='#b59a58';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(top.x,top.y);ctx.stroke();ctx.fillStyle='#f9d77e';ctx.beginPath();ctx.arc(top.x,top.y,4,0,TAU);ctx.fill()}
  const tag=P(x+2.05,y+2.65,.2);ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.fillStyle='#fff0b8';ctx.strokeStyle='#202630';ctx.lineWidth=3;ctx.strokeText('BMW E30 RAFFLE',tag.x,tag.y);ctx.fillText('BMW E30 RAFFLE',tag.x,tag.y);
  ctx.restore();
}

// ---------------------------------------------------------------- survivors
function drawScaryTerry(g,bob){
  g.strokeStyle='#244f48';g.lineWidth=2.8;g.beginPath();
  for(let i=0;i<2;i++){const y=-25+bob+i*8;g.moveTo(-9,y);g.lineTo(-4,y+4);g.lineTo(1,y);g.lineTo(6,y+4);g.lineTo(10,y)}
  g.stroke();
  g.fillStyle='#4b302b';g.beginPath();g.moveTo(-10,-46+bob);g.lineTo(-7,-56+bob);g.lineTo(0,-54+bob);g.lineTo(4,-60+bob);g.lineTo(10,-46+bob);g.closePath();g.fill();
  g.beginPath();g.ellipse(0,-46+bob,14,2.7,0,0,TAU);g.fill();
}
function drawCharacterDetails(g,c,bob){
  g.fillStyle=c.skin;
  if(c.sleeveless){g.fillRect(-13,-27+bob,5,16);g.fillRect(8,-27+bob,5,16)}else{g.fillStyle=c.shirt;g.fillRect(-13,-27+bob,5,11);g.fillRect(8,-27+bob,5,11)}
  g.fillStyle=c.skin;g.beginPath();g.arc(0,-37+bob,9,0,TAU);g.fill();
  g.fillStyle=c.hair;g.beginPath();g.ellipse(0,-42+bob,9,5,0,Math.PI,TAU);g.fill();
  if(c.beanie){g.fillStyle='#27292f';g.beginPath();g.ellipse(0,-44+bob,10,8,0,Math.PI,TAU);g.fill();g.fillStyle='#444954';g.fillRect(-10,-45+bob,20,4)}
  if(c.belly){g.fillStyle=c.shirt;g.beginPath();g.ellipse(0,-17+bob,12,9,0,0,TAU);g.fill()}
  if(c.scaryTerry)drawScaryTerry(g,bob);
}
function drawCharacterPreview(cv,c){
  const g=cv.getContext('2d');g.clearRect(0,0,cv.width,cv.height);g.save();g.translate(cv.width/2,75);const s=c.scaryTerry?1.35:1.6;g.scale(s,s);
  g.fillStyle=c.pants;g.fillRect(-7,-14,5,14);g.fillRect(2,-14,5,14);g.fillStyle=c.shirt;g.beginPath();g.roundRect(-10,-31,20,19,5);g.fill();
  g.fillStyle=c.skin;g.fillRect(-13,-27,5,16);g.fillRect(8,-27,5,16);drawCharacterDetails(g,c,0);g.restore();
}
function drawGun(w,hand,reloading,progress){
  const g=GUNS[w];
  ctx.fillStyle=hand;ctx.fillRect(3,-7,12,5);ctx.fillRect(3,4,12,5);
  if(w===3){ctx.fillStyle='#3d4a3a';ctx.fillRect(4,-6,30,12);ctx.fillStyle='#232b22';ctx.fillRect(30,-7,8,14);ctx.fillStyle='#6b7a55';ctx.fillRect(8,-6,6,12)}
  else if(w===4){ctx.fillStyle='#8a2f24';ctx.fillRect(-2,3,14,10);ctx.fillStyle='#2b2f33';ctx.fillRect(4,-4,26,8);ctx.fillStyle='#55595c';ctx.fillRect(26,-2,12,4);ctx.fillStyle='#ffb04a';ctx.fillRect(37,-2,3,4)}
  else if(w===5){ctx.fillStyle='#1c2733';ctx.fillRect(4,-4,34,8);ctx.fillStyle='#5fd9ff';ctx.fillRect(12,-1.5,34,3);ctx.fillStyle='#2f4356';ctx.fillRect(34,-5,4,10);ctx.fillRect(42,-5,4,10)}
  else{
    ctx.fillStyle=w===2?'#50301c':'#202a33';ctx.fillRect(4,-4,w===1?35:30,8);
    ctx.fillStyle=w===2?'#5e6162':'#5b666b';ctx.fillRect(w===1?30:25,-3,w===1?25:15,w===1?6:5);
    if(w===1){ctx.fillStyle='#242a2c';ctx.fillRect(37,-4,17,2);ctx.fillStyle='#4b5659';ctx.fillRect(15,4,13,13)}
    if(w===2){ctx.fillStyle='#88552d';ctx.fillRect(6,2,17,6);ctx.fillStyle='#a36b39';ctx.fillRect(8,5,11,3)}
    ctx.fillStyle='#111820';ctx.fillRect(12,3+(reloading&&progress>.25&&progress<.72?10:0),8,10);
  }
  if(reloading){ctx.fillStyle=hand;ctx.fillRect(11,6+Math.sin(progress*Math.PI)*7,9,6)}
  return g.len;
}
function drawSurvivor(p){
  const pos=project(p.x,p.y);if(!onScreen(pos))return;
  const c=characters[p.character]||characters[0],alive=p.hp>0;
  ctx.save();ctx.translate(pos.x,pos.y);
  ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(0,0,alive?13:20,alive?6:8,0,0,TAU);ctx.fill();
  if(p===me||isMulti()){ctx.strokeStyle=c.color+(p===me?'cc':'88');ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,17,8,0,0,TAU);ctx.stroke()}
  if(!alive){ctx.rotate(-1.42);ctx.translate(-2,11);ctx.globalAlpha=.8}
  else if(p.knockdown>0){ctx.rotate(-1.15);ctx.translate(0,12)}
  if(alive&&p.invuln>.4&&Math.sin(clock*30)>0)ctx.globalAlpha=.55;
  const step=p.moving&&alive?Math.sin(p.stride)*3.2:0,bob=p.moving&&alive?Math.abs(Math.cos(p.stride))*1.6:Math.sin(clock*2.2+p.slot)*.7;
  ctx.fillStyle=c.pants;ctx.fillRect(-7,-14+step,5,13-step*.4);ctx.fillRect(2,-14-step,5,13+step*.4);
  ctx.fillStyle=c.shirt;ctx.beginPath();ctx.roundRect(-10,-31+bob,20,19,5);ctx.fill();
  drawCharacterDetails(ctx,c,bob);
  if(p.hurtT>0){ctx.fillStyle='#ff000055';ctx.fillRect(-12,-48,24,48)}
  const reloading=p.reload>0&&alive,progress=reloading&&p.reloadTotal?1-p.reload/p.reloadTotal:0;
  if(alive){
    // both hands and the weapon, in the exact projected firing direction
    ctx.save();ctx.translate(0,-23+bob+(reloading?7:0));ctx.rotate(screenAngle(p.angle)+(reloading?-.85:0));
    if(p.flash>0)ctx.translate(-3,0);
    drawGun(p.weapon,c.skin,reloading,progress);ctx.restore();
  }
  ctx.restore();
  if(reloading){ctx.strokeStyle='#1c303b';ctx.lineWidth=5;ctx.beginPath();ctx.arc(pos.x,pos.y-56,14,0,TAU);ctx.stroke();ctx.strokeStyle='#f6c96b';ctx.beginPath();ctx.arc(pos.x,pos.y-56,14,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke()}
}

// ---------------------------------------------------------------- zombies
const Z_SCALE={giant:1.85,santa:1.7,crawler:.66,bloater:1.2,riot:1.1};
// Torso, clothes and head never change, so each look is drawn once into a small
// sprite. Only legs, arms and status overlays are drawn live: a full horde costs
// a fraction of what redrawing every zombie from paths would.
const zSprites={};
function zSprite(t,v,elf){
  const key=t+v+(elf?'e':'');let s=zSprites[key];if(s)return s;
  s=document.createElement('canvas');s.width=96;s.height=144;const g=s.getContext('2d');g.scale(2,2);g.translate(24,70);
  const def=ZT[t];
  g.fillStyle=elf?'#2e8b4a':Z_BODY[def.i];g.beginPath();g.roundRect(-10,-31,20,19,5);g.fill();
  if(t==='santa'){
    g.fillStyle='#f4f4ee';g.fillRect(-10,-14,20,3);g.fillRect(-2,-31,4,17);
    g.fillStyle='#17191c';g.fillRect(-10,-21,20,4);g.fillStyle='#e6c04f';g.fillRect(-3,-22,6,6);
  }else if(t==='bloater'){
    g.fillStyle='#c9d86a';for(const [bx,by,br] of [[-5,-25,3],[4,-20,3.6],[-2,-16,2.6],[6,-27,2.2]]){g.beginPath();g.arc(bx,by,br,0,TAU);g.fill()}
  }else if(!def.boss){
    // torn sleeves, uneven hems and stained cloth; four variants
    g.fillStyle=v===0?'#564b45':v===1?'#7b6553':v===2?'#4b5853':'#857665';
    g.beginPath();g.moveTo(-10,-16);g.lineTo(-8,-10);g.lineTo(-4,-14);g.lineTo(1,-9);g.lineTo(5,-15);g.lineTo(10,-11);g.lineTo(10,-17);g.closePath();g.fill();
    g.fillStyle='#392e30aa';g.beginPath();g.moveTo(-7,-26);g.lineTo(-1,-29);g.lineTo(2,-22);g.lineTo(-5,-20);g.fill();
    g.fillStyle='#bdab8b';g.fillRect(4,-20,4,5);
  }
  g.fillStyle=def.boss?'#9d9d85':t==='spitter'?'#b9c77a':'#a3b5a1';g.beginPath();g.arc(0,-37,9,0,TAU);g.fill();
  if(t==='santa'){
    g.fillStyle='#f4f4ee';g.beginPath();g.ellipse(0,-31,8,7,0,0,Math.PI);g.fill();
    g.fillStyle='#b81f2a';g.beginPath();g.moveTo(-9,-42);g.lineTo(9,-42);g.lineTo(13,-58);g.closePath();g.fill();
    g.fillStyle='#f4f4ee';g.fillRect(-10,-45,20,4);g.beginPath();g.arc(13,-58,3.4,0,TAU);g.fill();
  }else if(elf){
    g.fillStyle='#c62a2f';g.beginPath();g.moveTo(-8,-43);g.lineTo(8,-43);g.lineTo(2,-60);g.closePath();g.fill();g.fillStyle='#ffe14d';g.beginPath();g.arc(2,-60,2.6,0,TAU);g.fill();
  }else if(t==='riot'){
    g.fillStyle='#1b2836';g.beginPath();g.ellipse(0,-40,10.5,8,0,Math.PI,TAU);g.fill();g.fillStyle='#7fb7d955';g.fillRect(-9,-41,18,6);
  }else{g.fillStyle='#53654b';g.beginPath();g.ellipse(0,-42,9,5,0,Math.PI,TAU);g.fill()}
  if(t==='carrier'){ // loot crate strapped on
    g.fillStyle='#8a5a2b';g.fillRect(-9,-64,18,13);g.strokeStyle='#ffd447';g.lineWidth=1.5;g.strokeRect(-9,-64,18,13);g.fillStyle='#ffd447';g.font='900 9px system-ui';g.textAlign='center';g.fillText('★',0,-54);
  }
  g.fillStyle=t==='spitter'?'#b8f24a':'#e45450';g.fillRect(-5,-39,3,2);g.fillRect(3,-39,3,2);
  if(t==='spitter'){g.beginPath();g.arc(0,-33,2.6,0,TAU);g.fill()}
  return zSprites[key]=s;
}
const Z_ARM={giant:'#87637b',santa:'#b81f2a',runner:'#ad554c',riot:'#22303f'};
function drawZombie(z,falling){
  const pos=project(z.x,z.y);if(!onScreen(pos,120))return;
  const def=ZT[z.t],f=falling?0:(isClient()?z.flags||0:zFlags(z)),sc=Z_SCALE[z.t]||1,id=z.id||z.seed||0;
  ctx.save();ctx.translate(pos.x,pos.y);
  ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(0,0,13*sc,6*sc,0,0,TAU);ctx.fill();
  if(falling){ctx.rotate(-1.45*(1-falling.life/falling.max));ctx.globalAlpha=.5+.5*falling.life/falling.max}
  ctx.scale(sc*(z.t==='bloater'?1.3+Math.sin(clock*5+id)*.05:1),sc);
  const wind=f&4,bob=wind?-Math.abs(Math.sin(clock*18))*5:Math.sin(clock*5.2+id)*2,step=Math.sin(z.stride||0)*2.6;
  const elf=!!(z.elf||f&32);
  ctx.fillStyle=z.t==='santa'?'#7d1219':'#27343c';ctx.fillRect(-7,-14+step,5,13);ctx.fillRect(2,-14-step,5,13);
  ctx.drawImage(zSprite(z.t,id%4,elf),-24,-70+bob,48,72);
  if(!falling){
    // reaching arms, rotated to point at the survivor in screen space
    const swing=Math.sin(clock*10+(z.stride||0))*.9;
    ctx.save();ctx.translate(0,-25+bob);ctx.rotate(screenAngle(z.angle));
    ctx.strokeStyle=elf?'#2e8b4a':Z_ARM[z.t]||'#6a8061';ctx.lineWidth=7;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-5,-7);ctx.lineTo(10,-12+swing);ctx.lineTo(23,-11+swing);ctx.moveTo(-5,7);ctx.lineTo(10,12-swing);ctx.lineTo(23,11-swing);ctx.stroke();
    ctx.fillStyle=def.boss?'#a7a28b':'#aebda1';ctx.fillRect(20,-14+swing,6,6);ctx.fillRect(20,8-swing,6,6);
    if(z.t==='riot'){ctx.fillStyle='#31475e';ctx.strokeStyle='#9fc4e0';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(19,-15,6,30,3);ctx.fill();ctx.stroke()}
    if(z.t==='santa'){ctx.fillStyle='#6b4a2a';ctx.beginPath();ctx.ellipse(-12,0,9,11,0,0,TAU);ctx.fill()}
    ctx.restore();
    if(f&2){ctx.fillStyle='#ff8a2a44';ctx.fillRect(-11,-47,22,45)}
    if(f&1){ctx.fillStyle='#ffffff70';ctx.fillRect(-11,-47,22,45)}
    if(f&64){ctx.fillStyle='#ffe14d';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillText('✦ ✦',0,-52)}
    if(!def.boss&&z.maxHp>=95&&z.hp<z.maxHp){ctx.fillStyle='#240c16';ctx.fillRect(-12,-70,24,3);ctx.fillStyle='#f04760';ctx.fillRect(-12,-70,24*clamp(z.hp/z.maxHp,0,1),3)}
  }
  ctx.restore();
}

// ---------------------------------------------------------------- pickups & projectiles
const PICK_GLOW={medkit:'#56ff99',medsmall:'#56ff99',dmg:'#ff9d5c',rapid:'#7fd8ff',nuke:'#fff3a0',nade:'#cfe58a'};
function drawPickup(p){
  if(p.life!=null&&p.life<5&&Math.sin(clock*16)>.2)return;
  const q=project(p.x,p.y,.14+Math.sin(clock*3+p.id)*.06);if(!onScreen(q,30))return;
  ctx.save();ctx.translate(q.x,q.y);
  if(p.type==='medkit'||p.type==='medsmall'){const s=p.type==='medkit'?1:.68;ctx.scale(s,s);ctx.fillStyle='#f4f7ee';ctx.fillRect(-12,-10,24,20);ctx.fillStyle='#d83d49';ctx.fillRect(-3,-8,6,16);ctx.fillRect(-9,-3,18,6)}
  else if(p.type[0]==='w'){
    const n=Number(p.type[1]);ctx.rotate(-.3);ctx.fillStyle='#343a40';ctx.fillRect(-23,-4,45,8);ctx.fillStyle=['','#555c63','#9d653b','#4f6b45','#b0402f','#49c6ee'][n];ctx.fillRect(-9,3,18,8);ctx.fillStyle='#e0b36c';ctx.fillRect(12,-6,7,12);
    ctx.rotate(.3);ctx.fillStyle='#ffe18b';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillText(GUNS[n].name,0,-14);
  }else{
    ctx.fillStyle='#10202cdd';ctx.strokeStyle=PICK_GLOW[p.type];ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,12,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle=PICK_GLOW[p.type];ctx.font='900 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText({dmg:'x2',rapid:'»»',nuke:'☢',nade:'●'}[p.type],0,1);
  }
  ctx.restore();
}
function drawLob(l){
  const t=clamp(l.t/l.dur,0,1),x=lerp(l.x0,l.tx,t),y=lerp(l.y0,l.ty,t),z=.5+Math.sin(Math.PI*t)*2.4;
  const g=project(x,y),q=project(x,y,z);
  ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(g.x,g.y,7,3.5,0,0,TAU);ctx.fill();
  ctx.save();ctx.translate(q.x,q.y);ctx.rotate(clock*9);
  if(l.k===0){ctx.fillStyle='#3d5a2a';ctx.beginPath();ctx.arc(0,0,5.5,0,TAU);ctx.fill();ctx.fillStyle='#c9c9c9';ctx.fillRect(-1.5,-8,3,4)}
  else{ctx.fillStyle='#c62a2f';ctx.fillRect(-7,-7,14,14);ctx.fillStyle='#ffe14d';ctx.fillRect(-1.5,-7,3,14);ctx.fillRect(-7,-1.5,14,3)}
  ctx.restore();
}

// ---------------------------------------------------------------- lighting
let lightCv=null,lctx=null,lw=0,lh=0;
const LSCALE=1/3,lightGrads={};
function resizeLights(){
  if(!lightCv){lightCv=document.createElement('canvas');lctx=lightCv.getContext('2d')}
  lw=lightCv.width=Math.max(2,Math.ceil(W*LSCALE));lh=lightCv.height=Math.max(2,Math.ceil(H*LSCALE));
  for(const k in lightGrads)delete lightGrads[k];
}
function lightGrad(c){
  let g=lightGrads[c];
  if(!g){g=lctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,c);g.addColorStop(.45,c+'88');g.addColorStop(1,c+'00');lightGrads[c]=g}
  return g;
}
function light(x,y,z,r,c,a=1){
  const q=project(x,y,z),R=r*TILE;if(q.x<-R||q.x>W+R||q.y<-R||q.y>H+R)return;
  lctx.setTransform(R*LSCALE,0,0,R*LSCALE*.66,q.x*LSCALE,q.y*LSCALE);
  lctx.globalAlpha=a;lctx.fillStyle=lightGrad(c);lctx.beginPath();lctx.arc(0,0,1,0,TAU);lctx.fill();
}
function drawLighting(){
  const boss=zombies.some(z=>ZT[z.t].boss),pulse=boss?.5+.5*Math.sin(clock*3):0;
  lctx.setTransform(1,0,0,1,0,0);lctx.globalCompositeOperation='source-over';lctx.globalAlpha=1;
  lctx.fillStyle=state==='menu'?'rgb(120,126,150)':`rgb(${Math.round(98+pulse*30)},${Math.round(104-pulse*14)},${Math.round(132-pulse*24)})`;
  lctx.fillRect(0,0,lw,lh);lctx.globalCompositeOperation='lighter';
  for(const L of STATIC_LIGHTS){
    if(L.c==='tree'){light(L.x,L.y,L.z,L.r,'#ffe9b0',.8+.08*Math.sin(clock*2));light(L.x,L.y,L.z,3.4,XMAS[Math.floor(clock*.8)%5],.35)}
    else light(L.x,L.y,L.z,L.r,L.c,.55);
  }
  for(const p of players){
    if(p.hp<=0){light(p.x,p.y,.3,1.6,'#ff6b6b',.5+.3*Math.sin(clock*6));continue}
    light(p.x,p.y,.5,3.3,'#ffe6c2',.75);
    // flashlight cone
    const q=project(p.x,p.y,.6),a=screenAngle(p.angle),R=330*LSCALE;
    lctx.setTransform(1,0,0,1,q.x*LSCALE,q.y*LSCALE);lctx.globalAlpha=.85;
    const g=lctx.createRadialGradient(0,0,4,0,0,R);g.addColorStop(0,'#fff3d6');g.addColorStop(.6,'#fff3d655');g.addColorStop(1,'#fff3d600');
    lctx.fillStyle=g;lctx.beginPath();lctx.moveTo(0,0);lctx.arc(0,0,R,a-.44,a+.44);lctx.closePath();lctx.fill();
  }
  for(const f of flashes)light(f.x,f.y,f.z,f.r,f.c,f.life/f.max);
  for(const k of pickups)light(k.x,k.y,.2,1.5,k.type[0]==='w'?'#ffb452':PICK_GLOW[k.type]||'#ffffff',.6);
  for(const h of hazards)light(h.x,h.y,.2,h.r*2.4,h.k===1?'#ff9a3c':'#b8f24a',h.k===1?.8:.45);
  for(const b of bullets)if(b.k===1||b.k===2)light(b.x,b.y,.5,1.5,'#ff9a3c',.5);
  for(const z of zombies){const burning=isClient()?(z.flags&2):z.burn>0;if(burning)light(z.x,z.y,.5,1.5,'#ff9a3c',.5);else if(z.t==='carrier')light(z.x,z.y,1.2,1.5,'#ffd447',.6)}
  lctx.setTransform(1,0,0,1,0,0);lctx.globalAlpha=1;
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.imageSmoothingEnabled=true;ctx.drawImage(lightCv,0,0,W,H);ctx.restore();
}

// ---------------------------------------------------------------- frame
const drawList=[];
const snow=[];for(let i=0;i<70;i++)snow.push({x:Math.random(),y:Math.random(),s:rand(.6,1.6),p:rand(0,TAU)});
function draw(dt){
  // camera
  let fxp=16+Math.cos(clock*.07)*6,fyp=13+Math.sin(clock*.07)*4;
  if(me&&state!=='menu'){
    fxp=me.x;fyp=me.y;
    if(!COARSE&&me.hp>0&&aimSrc==='mouse'){fxp+=Math.cos(me.angle)*.9;fyp+=Math.sin(me.angle)*.9}
  }
  const k=1-Math.exp(-dt*9);
  cam.x+=((W/2)-(fxp-fyp)*TILE-cam.x)*k;cam.y+=((H*.48)-(fxp+fyp)*TILE*ISOY-cam.y)*k;
  cam.sx=shake>0?rand(-shake,shake):0;cam.sy=shake>0?rand(-shake,shake):0;

  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;
  ctx.fillStyle='#b9c7d6';ctx.fillRect(0,0,W,H);
  if(floorCv)ctx.drawImage(floorCv,cam.x+cam.sx-FX0,cam.y+cam.sy-FY0,FWID,FHEI);

  // ground decals: hazards and telegraphs
  for(const h of hazards){
    const q=project(h.x,h.y,.01);ctx.globalAlpha=clamp(h.life,0,1)*(h.k===0?.55:.35);ctx.fillStyle=h.k===0?'#9fdc2f':'#ff7a2a';
    ctx.beginPath();ctx.ellipse(q.x,q.y,h.r*TILE*1.35,h.r*TILE*.68,0,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;
  for(const r of rings){
    const q=project(r.x,r.y,.02),t=1-r.life/r.max;ctx.save();
    if(r.k===9){ctx.globalAlpha=1-t;ctx.strokeStyle=r.c;ctx.lineWidth=6*(1-t)+1;ctx.beginPath();ctx.ellipse(q.x,q.y,r.r*t*TILE*1.4,r.r*t*TILE*.7,0,0,TAU);ctx.stroke()}
    else if(r.k===1){ // charge lane
      const e=project(r.x+Math.cos(r.r)*9,r.y+Math.sin(r.r)*9,.02);ctx.globalAlpha=.25+.3*t;ctx.strokeStyle='#ff5a3c';ctx.lineWidth=34;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(e.x,e.y);ctx.stroke();
    }else{ // slam / gift landing zone
      ctx.fillStyle=r.k===2?'#ff3c3c':'#ffbd66';ctx.globalAlpha=.12+.2*t;ctx.beginPath();ctx.ellipse(q.x,q.y,r.r*TILE*1.4,r.r*TILE*.7,0,0,TAU);ctx.fill();
      ctx.globalAlpha=.9;ctx.strokeStyle=r.k===2?'#ff5a5a':'#ffbd66';ctx.lineWidth=2.5;ctx.stroke();
      ctx.beginPath();ctx.ellipse(q.x,q.y,r.r*t*TILE*1.4,r.r*t*TILE*.7,0,0,TAU);ctx.stroke();
    }
    ctx.restore();
  }

  // depth-sorted world
  drawList.length=0;
  for(const p of pickups)drawList.push({o:p.x+p.y,k:0,e:p});
  for(const p of props)drawList.push({o:p.renderOrder??(p.x+p.y+p.w+p.h),k:1,e:p});
  for(const z of zombies)drawList.push({o:z.x+z.y,k:2,e:z});
  for(const c of corpses)drawList.push({o:c.x+c.y-.2,k:3,e:c});
  for(const p of players)drawList.push({o:p.x+p.y+(p.hp>0?0:-.3),k:4,e:p});
  for(const l of lobs)drawList.push({o:lerp(l.x0,l.tx,l.t/l.dur)+lerp(l.y0,l.ty,l.t/l.dur)+.5,k:5,e:l});
  drawList.sort((a,b)=>a.o-b.o);
  for(const d of drawList){
    if(d.k===0)drawPickup(d.e);else if(d.k===1)drawProp(d.e);else if(d.k===2)drawZombie(d.e);
    else if(d.k===3)drawZombie(d.e,d.e);else if(d.k===4)drawSurvivor(d.e);else drawLob(d.e);
  }
  if(me&&state!=='menu')drawOccludedOutline();
  // acid globs and smoke under the lighting pass
  for(const e of eprojs){const q=project(e.x,e.y,.6);ctx.fillStyle='#9fdc2f';ctx.beginPath();ctx.arc(q.x,q.y,5,0,TAU);ctx.fill();ctx.fillStyle='#e2ff9a';ctx.beginPath();ctx.arc(q.x-1,q.y-1,2,0,TAU);ctx.fill()}
  for(const p of particles){
    if(p.k===1)continue;const q=project(p.x,p.y,p.z);const a=clamp(p.life/p.max,0,1);
    if(p.k===2){ctx.globalAlpha=a*.5;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(q.x,q.y,p.size*(1.6-a*.6),0,TAU);ctx.fill()}
    else{ctx.globalAlpha=a;ctx.fillStyle=p.color;ctx.fillRect(q.x-p.size/2,q.y-p.size/2,p.size,p.size)}
  }
  ctx.globalAlpha=1;

  if(settings.light)drawLighting();

  // ---- additive glow pass: stays bright in the dark
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  for(const b of bullets){
    const q=project(b.x,b.y,.52);if(!onScreen(q,40))continue;
    if(b.k===1){const a=clamp(b.life/.45,0,1);ctx.globalAlpha=.55*a+.15;ctx.fillStyle=a>.6?'#ffe07a':a>.3?'#ff9a3c':'#d8481f';ctx.beginPath();ctx.arc(q.x,q.y,5+(1-a)*13,0,TAU);ctx.fill();continue}
    const t=project(b.x-b.vx*.028,b.y-b.vy*.028,.52);ctx.globalAlpha=1;
    ctx.strokeStyle=b.k===2?'#ffb061':b.k===3?'#8fe9ff':'#ffec95';ctx.lineWidth=b.k===2?5:b.k===3?4:2.4;
    ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  }
  for(const b of beams){
    const a=project(b.x0,b.y0,.55),e=project(b.x1,b.y1,.55),t=b.life/b.max;ctx.globalAlpha=t;
    ctx.strokeStyle='#5fd9ff';ctx.lineWidth=9*t;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(e.x,e.y);ctx.stroke();
    ctx.strokeStyle='#ffffff';ctx.lineWidth=2.5*t;ctx.stroke();
  }
  for(const p of particles){
    if(p.k!==1)continue;const q=project(p.x,p.y,p.z),a=clamp(p.life/p.max,0,1);
    ctx.globalAlpha=a*.7;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(q.x,q.y,p.size*(.4+a*.6),0,TAU);ctx.fill();
  }
  for(const p of players){ // muzzle flash
    if(p.flash<=0||p.hp<=0||GUNS[p.weapon].flame)continue;
    const base=project(p.x,p.y),a=screenAngle(p.angle),L=GUNS[p.weapon].len+8,mx=base.x+Math.cos(a)*L,my=base.y-23+Math.sin(a)*L;
    ctx.globalAlpha=1;ctx.fillStyle=p.weapon===5?'#bff3ff':'#fff1b8';ctx.beginPath();ctx.arc(mx,my,p.weapon===2?13:8,0,TAU);ctx.fill();
    ctx.globalAlpha=.6;ctx.fillStyle='#ffb347';ctx.beginPath();ctx.arc(mx+Math.cos(a)*8,my+Math.sin(a)*8,p.weapon===2?9:5,0,TAU);ctx.fill();
  }
  if(settings.light){ // eyes in the dark
    ctx.globalAlpha=.9;
    for(const z of zombies){
      const q=project(z.x,z.y);if(!onScreen(q,20))continue;const sc=Z_SCALE[z.t]||1;
      ctx.fillStyle=z.t==='spitter'?'#b8f24a':'#ff4a44';ctx.fillRect(q.x-5*sc,q.y-39*sc,3*sc,2*sc);ctx.fillRect(q.x+3*sc,q.y-39*sc,3*sc,2*sc);
    }
  }
  if(me&&me.hp>0&&state==='playing'&&!COARSE&&aimSrc==='mouse'){ // laser sight
    const base=project(me.x,me.y),a=screenAngle(me.angle),hit=raycast(me.x,me.y,me.angle,8),e=project(hit.x,hit.y);
    const sx=base.x+Math.cos(a)*40,sy=base.y-23+Math.sin(a)*40;
    const g=ctx.createLinearGradient(sx,sy,e.x,e.y-23);g.addColorStop(0,'#ff3b3b66');g.addColorStop(1,'#ff3b3b00');
    ctx.globalAlpha=1;ctx.strokeStyle=g;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(e.x,e.y-23);ctx.stroke();
  }
  ctx.restore();

  drawWorldText();
  drawScreenFx(dt);
}
function drawOccludedOutline(){
  const feet=project(me.x,me.y,0),head=project(me.x,me.y,1.35);let hidden=false;
  for(const p of props){
    if(p.type!=='wall'&&!p.type.startsWith('shop'))continue;
    if(p.x+p.y+p.w+p.h<=me.x+me.y+.05)continue;
    const z=p.type==='wall'?1.45:1.0;
    const a=project(p.x,p.y+p.h),b=project(p.x+p.w,p.y),top=project(p.x,p.y,z),bot=project(p.x+p.w,p.y+p.h);
    if(feet.x>a.x-8&&feet.x<b.x+8&&feet.y>top.y&&head.y<bot.y){hidden=true;break}
  }
  if(!hidden)return;
  ctx.save();ctx.translate(feet.x,feet.y);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowColor='#51f4ff';ctx.shadowBlur=15;ctx.strokeStyle='#60efff';ctx.lineWidth=3.8;
  ctx.beginPath();ctx.moveTo(-8,-13);ctx.lineTo(-10,-30);ctx.lineTo(-7,-35);ctx.arc(0,-38,10,Math.PI*1.12,Math.PI*1.9);ctx.lineTo(10,-30);ctx.lineTo(9,-13);ctx.lineTo(6,0);ctx.lineTo(1,0);ctx.lineTo(0,-13);ctx.lineTo(-2,0);ctx.lineTo(-8,0);ctx.closePath();ctx.stroke();
  ctx.shadowBlur=0;ctx.globalAlpha=.16;ctx.fillStyle='#60efff';ctx.fill();ctx.restore();
}
function label(text,x,y,size,color,stroke='#101820'){
  ctx.font='900 '+size+'px system-ui';ctx.lineWidth=Math.max(3,size/5);ctx.strokeStyle=stroke;ctx.lineJoin='round';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);
}
function drawWorldText(){
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(const t of texts){
    const q=project(t.x,t.y,t.z);ctx.globalAlpha=clamp(t.life/(t.max*.5),0,1);
    if(t.small){ctx.font='900 '+t.size+'px system-ui';ctx.fillStyle=t.color;ctx.fillText(t.text,q.x,q.y)}else label(t.text,q.x,q.y,t.size,t.color);
  }
  ctx.globalAlpha=1;
  if(state!=='playing'&&state!=='over')return;
  for(const p of players){
    const q=project(p.x,p.y);if(!onScreen(q))continue;
    if(isMulti()&&p!==me){
      label(p.name,q.x,q.y-66,11,(characters[p.character]||characters[0]).color);
      if(p.hp>0){ctx.fillStyle='#0b1420cc';ctx.fillRect(q.x-17,q.y-62,34,4);ctx.fillStyle=p.hp>p.maxHp*.5?'#63e6a2':p.hp>p.maxHp*.25?'#ffd166':'#ff6b6b';ctx.fillRect(q.x-17,q.y-62,34*clamp(p.hp/p.maxHp,0,1),4)}
    }
    if(p.shoutTimer>0&&p.hp>0)label('GET SOME!',q.x,q.y-80,13,'#ffeb8a');
    if(p.hp<=0&&isMulti()){
      const pr=clamp(p.reviveProgress/REVIVE_TIME,0,1);
      ctx.strokeStyle='#0b1420cc';ctx.lineWidth=6;ctx.beginPath();ctx.arc(q.x,q.y-34,15,0,TAU);ctx.stroke();
      ctx.strokeStyle='#7fffc1';ctx.beginPath();ctx.arc(q.x,q.y-34,15,-Math.PI/2,-Math.PI/2+TAU*pr);ctx.stroke();
      label('✚',q.x,q.y-29,15,'#ff8a8a');
      if(me&&p!==me&&me.hp>0&&Math.hypot(me.x-p.x,me.y-p.y)<1.45)label((COARSE?'HOLD USE':'HOLD E')+' TO REVIVE '+p.name,q.x,q.y-60,13,'#7fffc1');
    }
  }
  if(me&&me.hp>0&&state==='playing'){
    if(nearRadio(me)){const q=project(RADIO_X,RADIO_Y,.9);label((COARSE?'USE':'E')+(radioOn?': STOP RADIO':': PLAY RADIO'),q.x,q.y-30,14,'#ffe7a2')}
    if(nearDoor(me)){const q=project(2.2,21.35,1.5);label((COARSE?'USE':'E')+(officeDoor.solid?': OPEN DOOR':officeDoor.broken>0?': DOOR BROKEN':': CLOSE DOOR'),q.x,q.y-25,14,'#ffe7a2')}
  }
}
function arrow(x,y,color,txt){
  const q=project(x,y,.5);if(q.x>30&&q.x<W-30&&q.y>60&&q.y<H-40)return;
  const cx=W/2,cy=H/2,a=Math.atan2(q.y-cy,q.x-cx),rx=W/2-34,ry=H/2-64;
  const t=Math.min(Math.abs(rx/Math.cos(a)),Math.abs(ry/Math.sin(a))),px=cx+Math.cos(a)*t,py=cy+Math.sin(a)*t;
  ctx.save();ctx.translate(px,py);ctx.rotate(a);ctx.fillStyle=color;ctx.globalAlpha=.9;ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-9);ctx.lineTo(-3,0);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();ctx.restore();
  if(txt){ctx.textAlign='center';label(txt,px-Math.cos(a)*26,py-Math.sin(a)*26+4,10,color)}
}
function drawScreenFx(dt){
  // snow drifting in through the broken skylight
  ctx.fillStyle='#ffffff';
  for(const s of snow){
    s.y+=dt*.045*s.s;s.x+=Math.sin(clock*.6+s.p)*dt*.012;if(s.y>1){s.y=0;s.x=Math.random()}
    const x=((s.x*W+cam.x*.25*s.s)%W+W)%W,y=((s.y*H+cam.y*.25*s.s)%H+H)%H;
    ctx.globalAlpha=.25+.3*s.s/1.6;ctx.beginPath();ctx.arc(x,y,s.s*1.3,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;
  const v=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.25,W/2,H/2,Math.max(W,H)*.72);v.addColorStop(0,'#0000');v.addColorStop(1,'#040a12b0');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
  if(me&&state==='playing'){
    const low=me.hp>0&&me.hp<=me.maxHp*.3?.25+.15*Math.sin(clock*6):0,a=Math.max(hurtFlash,low);
    if(a>0){const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.42,W/2,H/2,Math.max(W,H)*.72);g.addColorStop(0,'#ff000000');g.addColorStop(1,`rgba(255,20,30,${clamp(a,0,.55)})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
    if(me.hp<=0&&isMulti()){ctx.fillStyle='#200a0a88';ctx.fillRect(0,0,W,H);ctx.textAlign='center';label('YOU ARE DOWN',W/2,H*.4,Math.min(34,W/11),'#ff8a8a');label('A teammate can revive you. You get back up when the wave is cleared.',W/2,H*.4+26,Math.min(14,W/30),'#ffd9d9')}
  }
  if(nukeFlash>0){ctx.fillStyle=`rgba(255,250,220,${nukeFlash*.85})`;ctx.fillRect(0,0,W,H)}
  if(state!=='playing')return;
  // off-screen pointers
  for(const k of pickups)if(k.type[0]==='w')arrow(k.x,k.y,'#ffd447',GUNS[Number(k.type[1])].name);else if(k.type==='medkit'&&me&&me.hp<me.maxHp*.6)arrow(k.x,k.y,'#63e6a2','AID');
  for(const p of players)if(p!==me&&p.hp<=0)arrow(p.x,p.y,'#ff8a8a',p.name);
  if(spawnLeft===0&&zombies.length<=4)for(const z of zombies)arrow(z.x,z.y,'#ff5a5a');
  for(const z of zombies)if(ZT[z.t].boss)arrow(z.x,z.y,'#ff5a5a','BOSS');else if(z.t==='carrier')arrow(z.x,z.y,'#ffd447','LOOT');
  // banner
  ctx.textAlign='center';
  if(banner){
    const t=banner.life/banner.max,a=clamp(Math.min(t*4,(1-t)*6),0,1),s=Math.min(46,W/9)*(1+.25*Math.max(0,1-(1-t)*8));
    ctx.globalAlpha=a;label(banner.text,W/2,H*.22,s,banner.color,'#000a');
    if(banner.sub)label(banner.sub,W/2,H*.22+s*.62,Math.min(16,W/26),'#ffffff','#000a');
    ctx.globalAlpha=1;
  }else if(intermission>0&&wave===startWave-1)label('GET READY',W/2,H*.22,Math.min(40,W/10),'#ffe3a2','#000a');
  else if(intermission>0)label('NEXT WAVE IN '+Math.ceil(intermission),W/2,H*.2,Math.min(18,W/22),'#ffe3a2','#000a');
}

// ---------------------------------------------------------------- minimap
let mmBg=null;
const MMS=2.75,mmp=(x,y)=>[88+(x-y)*MMS,6+(x+y)*MMS*.56];
function drawMinimap(){
  const cv=$('minimap'),g=cv.getContext('2d');
  if(!mmBg){
    mmBg=document.createElement('canvas');mmBg.width=cv.width;mmBg.height=cv.height;const b=mmBg.getContext('2d');
    const P=(pts,fill)=>{b.beginPath();pts.forEach(([x,y],i)=>{const [mx,my]=mmp(x,y);i?b.lineTo(mx,my):b.moveTo(mx,my)});b.closePath();b.fillStyle=fill;b.fill()};
    P([[0,0],[world.w,0],[world.w,world.h],[0,world.h]],'#3a4753cc');
    for(const p of props){if(!p.solid||p.type==='barrel'||p.type==='officeDoor')continue;P([[p.x,p.y],[p.x+p.w,p.y],[p.x+p.w,p.y+p.h],[p.x,p.y+p.h]],p.type==='wall'?'#aab6c0':p.type==='treeBase'?'#b52e37':'#7b8793')}
  }
  g.clearRect(0,0,cv.width,cv.height);g.drawImage(mmBg,0,0);
  const dot=(x,y,c,r)=>{const [mx,my]=mmp(x,y);g.fillStyle=c;g.beginPath();g.arc(mx,my,r,0,TAU);g.fill()};
  if(officeDoor.solid)dot(officeDoor.x+.2,officeDoor.y+.7,'#c6a476',1.6);
  for(const k of pickups)dot(k.x,k.y,k.type[0]==='w'?'#ffd447':k.type.startsWith('med')?'#63e6a2':'#7fd8ff',1.8);
  for(const z of zombies){const b=ZT[z.t].boss;dot(z.x,z.y,b?'#ff2e4d':z.t==='carrier'?'#ffd447':'#ff6b5f',b?4:1.5)}
  for(const p of players)dot(p.x,p.y,p.hp>0?(characters[p.character]||characters[0]).color:'#ff8a8a',p===me?3.2:2.6);
  if(me){const [mx,my]=mmp(me.x,me.y);g.strokeStyle='#fff';g.lineWidth=1;g.beginPath();g.arc(mx,my,4.6,0,TAU);g.stroke()}
}
