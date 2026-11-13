// ============================================================================
//  audio: synthesized SFX (no external assets), the original voice clips,
//  horde ambience and the tech-counter radio, all positional.
// ============================================================================
const AU={ctx:null,master:null,dry:null,verb:null,noise:null,bufs:{},last:{},muted:false};
const VOICE_CLIPS=['damage','streak','ajStreak','tyroneStreak','tyroneDamage','ajDamage','terryDamage','terryStreak'];
const CHAR_VOICE=[{damage:'damage',streak:'streak'},{damage:'tyroneDamage',streak:'tyroneStreak'},{damage:'terryDamage',streak:'terryStreak'},{damage:'ajDamage',streak:'ajStreak'}];
function masterVol(){return AU.muted?0:settings.vol*.6}
function initAudio(){
  try{
    if(!AU.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const c=AU.ctx=new AC();
      const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=5;comp.connect(c.destination);
      AU.master=c.createGain();AU.master.gain.value=masterVol();AU.master.connect(comp);
      AU.dry=c.createGain();AU.dry.gain.value=.94;AU.dry.connect(AU.master);
      const wet=c.createGain();wet.gain.value=.16;wet.connect(AU.master);
      // A lightweight delay-based indoor echo avoids expensive impulse convolution on iOS.
      AU.verb=c.createDelay(.4);AU.verb.delayTime.value=.105;
      const fb=c.createGain();fb.gain.value=.18;AU.verb.connect(wet);AU.verb.connect(fb);fb.connect(AU.verb);
      AU.noise=c.createBuffer(1,Math.floor(c.sampleRate*.6),c.sampleRate);
      const d=AU.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      decodeVoices();
    }
    if(AU.ctx.state!=='running')AU.ctx.resume().catch(()=>{});
  }catch(e){}
}
const aOK=()=>!!AU.ctx&&AU.ctx.state==='running';
function decodeVoices(){
  for(const name of VOICE_CLIPS){
    const uri=ASSETS[name];if(!uri||AU.bufs[name])continue;
    try{
      const bytes=Uint8Array.from(atob(uri.split(',')[1]),c=>c.charCodeAt(0));
      const p=AU.ctx.decodeAudioData(bytes.buffer,b=>{AU.bufs[name]=b},()=>{});
      if(p&&p.catch)p.catch(()=>{});
    }catch(e){}
  }
}
function aOut(node,echo,pan){
  if(pan&&AU.ctx.createStereoPanner){const p=AU.ctx.createStereoPanner();p.pan.value=pan;node.connect(p);node=p}
  node.connect(AU.dry);if(echo)node.connect(AU.verb);
}
function aNoise(at,dur,vol,hp,lp,echo=true,pan=0){
  const c=AU.ctx,n=c.createBufferSource(),h=c.createBiquadFilter(),l=c.createBiquadFilter(),g=c.createGain();
  n.buffer=AU.noise;h.type='highpass';h.frequency.value=hp;l.type='lowpass';l.frequency.value=lp;
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),at+.002);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
  n.connect(h);h.connect(l);l.connect(g);aOut(g,echo,pan);n.start(at,Math.random()*.3);n.stop(at+dur+.01);
}
function aTone(at,f0,f1,dur,vol,type='triangle',echo=false,pan=0){
  const c=AU.ctx,o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(Math.max(1,f0),at);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),at+dur);
  g.gain.setValueAtTime(Math.max(.0002,vol),at);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
  o.connect(g);aOut(g,echo,pan);o.start(at);o.stop(at+dur+.01);
}
// name -> (time, volume, pan, arg)
const SFX={
  gun0(t,v,p){aNoise(t,.075,.55*v,170,6500,true,p);aNoise(t+.006,.16,.15*v,60,1800,true,p);aTone(t,160,62,.10,.19*v,'sawtooth',true,p)},
  gun1(t,v,p){aNoise(t,.075,.70*v,95,4600,true,p);aNoise(t+.006,.23,.24*v,60,1250,true,p);aTone(t,105,40,.14,.28*v,'sawtooth',true,p)},
  gun2(t,v,p){aNoise(t,.17,1.15*v,65,5900,true,p);aNoise(t+.018,.23,.75*v,45,2300,true,p);aTone(t,105,27,.26,.55*v,'sawtooth',true,p);aNoise(t+.12,.13,.24*v,90,1600,true,p);aNoise(t+.23,.14,.15*v,100,1200,true,p)},
  gun3(t,v,p){aTone(t,210,48,.2,.5*v,'sine',true,p);aNoise(t,.12,.5*v,120,1500,true,p);aNoise(t+.03,.2,.2*v,300,3000,true,p)},
  gun4(t,v,p){aNoise(t,.16,.17*v,500,3600,false,p);aNoise(t,.2,.12*v,60,500,false,p)},
  gun5(t,v,p){aTone(t,2400,160,.28,.3*v,'sawtooth',true,p);aTone(t,900,60,.35,.4*v,'square',true,p);aNoise(t,.2,.5*v,900,9000,true,p)},
  boom(t,v,p){aNoise(t,.5,1.3*v,30,1400,true,p);aNoise(t,.14,.9*v,400,7000,true,p);aTone(t,120,22,.55,.9*v,'sine',true,p)},
  thump(t,v,p){aTone(t,90,30,.3,.8*v,'sine',true,p);aNoise(t,.2,.5*v,40,600,true,p)},
  squish(t,v,p){aNoise(t,.11,.3*v,200,1500,false,p);aTone(t,180,60,.1,.12*v,'sine',false,p)},
  hit(t,v,p){aNoise(t,.04,.16*v,700,3200,false,p)},
  clang(t,v,p){aTone(t,1900,1500,.12,.14*v,'square',true,p);aTone(t,2700,2300,.16,.08*v,'triangle',true,p)},
  spit(t,v,p){aNoise(t,.16,.3*v,900,4200,false,p);aTone(t,520,190,.16,.1*v,'sine',false,p)},
  acid(t,v,p){aNoise(t,.3,.18*v,2000,9000,false,p)},
  hurt(t,v){aTone(t,220,80,.16,.3*v,'sawtooth');aNoise(t,.1,.35*v,200,2400,false)},
  down(t,v){aTone(t,300,60,.7,.35*v,'sawtooth',true);aTone(t+.1,200,40,.7,.25*v,'square',true)},
  revive(t,v){[523,659,784,1047].forEach((f,i)=>aTone(t+i*.09,f,f,.22,.16*v,'triangle',true))},
  pickup(t,v){aTone(t,660,990,.09,.16*v,'triangle');aTone(t+.08,990,1320,.14,.16*v,'triangle',true)},
  weapon(t,v){aNoise(t,.06,.35*v,500,6000,true);[392,523,659,784].forEach((f,i)=>aTone(t+.05+i*.07,f,f,.2,.15*v,'square',true))},
  power(t,v){[440,554,659,880,1108].forEach((f,i)=>aTone(t+i*.05,f,f*1.01,.25,.13*v,'sawtooth',true))},
  perk(t,v){[523,784,1047].forEach((f,i)=>aTone(t+i*.07,f,f,.3,.14*v,'triangle',true))},
  click(t,v){aTone(t,900,600,.04,.1*v,'square')},
  empty(t,v){aTone(t,1400,900,.03,.08*v,'square')},
  dash(t,v,p){aNoise(t,.2,.3*v,300,2600,false,p)},
  throw(t,v,p){aNoise(t,.14,.2*v,600,3000,false,p)},
  wave(t,v){aTone(t,110,110,.9,.3*v,'sawtooth',true);aTone(t,165,165,.9,.22*v,'sawtooth',true);aTone(t+.25,220,220,.8,.2*v,'square',true)},
  boss(t,v){aTone(t,70,38,1.5,.6*v,'sawtooth',true);aTone(t,73,36,1.5,.4*v,'square',true);aNoise(t,1.2,.5*v,40,700,true)},
  clear(t,v){[392,494,587,784].forEach((f,i)=>aTone(t+i*.11,f,f,.4,.15*v,'triangle',true))},
  roar(t,v,p){aTone(t,130,45,.9,.55*v,'sawtooth',true,p);aNoise(t,.8,.5*v,80,1200,true,p)},
  hoho(t,v,p){[196,165,131].forEach((f,i)=>aTone(t+i*.24,f,f*.86,.2,.5*v,'sawtooth',true,p))},
  bell(t,v,p){[1568,2093,2637].forEach((f,i)=>aTone(t+i*.05,f,f,.5,.07*v,'sine',true,p))},
  door(t,v,p){aNoise(t,.09,.5*v,90,900,true,p);aTone(t,95,60,.1,.3*v,'square',false,p)},
  breach(t,v,p){aNoise(t,.4,.9*v,60,2400,true,p);aTone(t,160,40,.3,.5*v,'sawtooth',true,p)},
  heart(t,v){aTone(t,58,40,.13,.7*v,'sine');aTone(t+.17,52,36,.15,.5*v,'sine')},
  rel0(t,v){aNoise(t,.052,.18*v,420,4400,false);aTone(t,460,230,.052,.055*v,'square')},
  rel1(t,v){aNoise(t,.045,.25*v,650,6500,false);aTone(t,800,310,.045,.075*v,'triangle')},
  rel2(t,v){aNoise(t,.072,.30*v,320,4200,true);aTone(t,330,140,.085,.09*v,'square')},
  rel3(t,v){aNoise(t,.065,.40*v,600,7000,true);aTone(t,1100,440,.075,.10*v,'triangle')},
  nuke(t,v){aNoise(t,1.4,1.2*v,20,900,true);aTone(t,200,18,1.5,.9*v,'sine',true);aTone(t,1800,200,.5,.2*v,'sawtooth',true)}
};
const SFX_GAP={gun0:.03,gun1:.03,gun2:.05,gun4:.07,hit:.04,squish:.045,boom:.05,clang:.06,acid:.2,door:.08,spit:.1};
function sfx(name,x,y){
  if(!aOK()||!SFX[name])return;
  const now=AU.ctx.currentTime,gap=SFX_GAP[name]||0;
  if(gap&&AU.last[name]&&now-AU.last[name]<gap)return;
  AU.last[name]=now;
  let v=1,pan=0;
  if(x!=null&&me){
    const d=Math.hypot(x-me.x,y-me.y);if(d>30)return;
    v=clamp(1.12-d/19,.1,1);pan=clamp(((x-y)-(me.x-me.y))/13,-.8,.8);
  }
  try{SFX[name](now,v,pan)}catch(e){}
}
function playVoice(name,vol=1){
  if(aOK()&&AU.bufs[name]){
    try{const s=AU.ctx.createBufferSource(),g=AU.ctx.createGain();s.buffer=AU.bufs[name];g.gain.value=vol;s.connect(g);g.connect(AU.master);s.start();return}catch(e){}
  }
  if(AU.muted||!ASSETS[name])return;
  try{const el=new Audio(ASSETS[name]);el.volume=clamp(vol*settings.vol,0,1);const p=el.play();if(p&&p.catch)p.catch(()=>{})}catch(e){}
}
function charVoice(p,kind){
  const map=CHAR_VOICE[p.character]||CHAR_VOICE[0];let vol=kind==='damage'?.8:.95;
  if(p!==me&&me){vol*=clamp(1.1-Math.hypot(p.x-me.x,p.y-me.y)/16,.15,.8)}
  playVoice(map[kind],vol);
}

// ---- tech counter radio (the original recording), filtered like a small speaker and positional
const RADIO_X=8.65,RADIO_Y=2.65,RADIO_REACH=2.15;
let techRadio=null,radioGain=null,radioWired=false;
function radioVolume(){
  if(!me)return 0;
  const d=Math.hypot(me.x-RADIO_X,me.y-RADIO_Y);
  return clamp(.07-d*.0035,.012,.07)*(AU.muted?0:settings.vol/.8);
}
function wireRadio(){
  if(radioWired||!ASSETS.radio)return;radioWired=true;
  techRadio=new Audio(ASSETS.radio);techRadio.loop=true;techRadio.preload='none';techRadio.volume=.03;
  try{
    if(!AU.ctx)return;
    const c=AU.ctx,src=c.createMediaElementSource(techRadio);
    const high=c.createBiquadFilter();high.type='highpass';high.frequency.value=430;
    const low=c.createBiquadFilter();low.type='lowpass';low.frequency.value=2900;
    const drive=c.createWaveShaper(),curve=new Float32Array(2048);
    for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*2.2)/Math.tanh(2.2)}
    drive.curve=curve;drive.oversample='2x';
    radioGain=c.createGain();radioGain.gain.value=.03;techRadio.volume=1;
    src.connect(high);high.connect(low);low.connect(drive);drive.connect(radioGain);radioGain.connect(c.destination);
  }catch(e){radioGain=null;techRadio.volume=.03}
}
function syncRadio(){
  const want=radioOn&&state==='playing';
  if(want){
    if(!techRadio){initAudio();wireRadio()}
    if(!techRadio)return;
    if(techRadio.paused){const p=techRadio.play();if(p&&p.catch)p.catch(()=>{})}
    const v=radioVolume();if(radioGain)radioGain.gain.value=v;else techRadio.volume=clamp(v,0,1);
  }else if(techRadio&&!techRadio.paused)techRadio.pause();
}

// ---- one quiet looping horde bed rather than a source per zombie
let horde=null,hordeLevel=0,hordeUnlocked=false;
function updateHorde(dt){
  if(!horde){if(!ASSETS.horde)return;horde=new Audio(ASSETS.horde);horde.loop=true;horde.preload='auto';horde.volume=0}
  const count=state==='playing'?zombies.length:0;
  const target=count===0?0:Math.min(.10,.006+Math.sqrt(Math.max(0,count-1))*.016);
  hordeLevel+=(target-hordeLevel)*Math.min(1,dt*(count?2.2:7));
  horde.volume=clamp(hordeLevel*(AU.muted?0:settings.vol/.8),0,.14);
  if(count===0&&hordeLevel<.004){if(!horde.paused){horde.pause()}hordeLevel=0}
  else if(hordeUnlocked&&horde.paused){const p=horde.play();if(p&&p.catch)p.catch(()=>{})}
}
function unlockAudio(){
  hordeUnlocked=true;initAudio();
  if(AU.ctx){try{const b=AU.ctx.createBuffer(1,1,AU.ctx.sampleRate),s=AU.ctx.createBufferSource();s.buffer=b;s.connect(AU.ctx.destination);s.start(0)}catch(e){}}
}
function setMuted(m){AU.muted=m;if(AU.master)AU.master.gain.value=masterVol();$('muteBtn').textContent=m?'🔇':'🔊'}
let heartT=0;
function updateHeart(dt){
  if(state!=='playing'||!me||me.hp<=0||me.hp>me.maxHp*.3){heartT=0;return}
  heartT-=dt;if(heartT<=0){heartT=.55+me.hp/me.maxHp;sfx('heart')}
}
