'use strict';
// Mall of the Dead: static file server + WebSocket room relay.
// The host's browser runs the game; this server only keeps rooms and forwards
// messages, so it is cheap to run on any Node host that supports WebSockets.
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib'),os=require('os');
const {WebSocketServer,WebSocket}=require('ws');

const PORT=process.env.PORT||3000;
const CHAR_COUNT=8,MAX_PLAYERS=8,MAX_ROOMS=400,MAX_MSG_PER_SEC=150;
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)
const INDEX=path.join(__dirname,'index.html');
const rooms=new Map();

// ---- static page, gzipped once and cached until the file changes
let page=null;
function loadPage(){
  const st=fs.statSync(INDEX);
  if(page&&page.mtime===st.mtimeMs)return page;
  const raw=fs.readFileSync(INDEX);
  page={mtime:st.mtimeMs,raw,gz:zlib.gzipSync(raw,{level:6}),etag:'"'+st.size.toString(36)+'-'+Math.floor(st.mtimeMs).toString(36)+'"'};
  return page;
}
const server=http.createServer((req,res)=>{
  let p;try{p=new URL(req.url,'http://localhost').pathname}catch(e){res.writeHead(400);return res.end('Bad request')}
  if(p==='/healthz'){
    let players=0;for(const r of rooms.values())players+=r.members.length;
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({ok:true,rooms:rooms.size,players}));
  }
  if(p!=='/'&&p!=='/index.html'){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found')}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
  let pg;try{pg=loadPage()}catch(e){res.writeHead(500);return res.end('index.html is missing')}
  const head={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','ETag':pg.etag,'X-Content-Type-Options':'nosniff','Vary':'Accept-Encoding'};
  if(req.headers['if-none-match']===pg.etag){res.writeHead(304,head);return res.end()}
  const gz=/\bgzip\b/.test(req.headers['accept-encoding']||'');
  if(gz)head['Content-Encoding']='gzip';
  const body=gz?pg.gz:pg.raw;head['Content-Length']=body.length;
  res.writeHead(200,head);res.end(req.method==='HEAD'?undefined:body);
});

// ---- rooms
const wss=new WebSocketServer({server,maxPayload:512*1024,perMessageDeflate:{threshold:1024,zlibDeflateOptions:{level:3}}});
const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
const broadcast=(room,data,except)=>{const s=JSON.stringify(data);for(const m of room.members)if(m.ws!==except&&m.ws.readyState===WebSocket.OPEN)m.ws.send(s)};
const publicMember=m=>({id:m.id,name:m.name,character:m.character,ready:m.ready});
const cleanName=n=>String(n==null?'':n).replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,16)||'Survivor';
function lobby(room){
  broadcast(room,{t:'lobby',code:room.code,host:room.members[0]?room.members[0].id:null,started:room.started,members:room.members.map(publicMember)});
}
function newCode(){
  let code;
  do{code='';for(let i=0;i<5;i++)code+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]}while(rooms.has(code));
  return code;
}
function detach(ws){
  const room=ws.room;if(!room)return;ws.room=null;
  const wasHost=room.members[0]&&room.members[0].ws===ws;
  room.members=room.members.filter(m=>m.ws!==ws);
  if(!room.members.length){rooms.delete(room.code);return}
  if(room.started)broadcast(room,{t:'depart',id:ws.pid});
  if(wasHost)broadcast(room,{t:'host',host:room.members[0].id}); // next player takes over the simulation
  lobby(room);
}

let nextId=1;
wss.on('connection',ws=>{
  ws.pid=String(nextId++);ws.isAlive=true;ws.count=0;ws.room=null;
  ws.on('pong',()=>{ws.isAlive=true});
  ws.on('close',()=>detach(ws));
  ws.on('error',()=>detach(ws));
  ws.on('message',raw=>{
    if(++ws.count>MAX_MSG_PER_SEC){ws.close(1008,'Too many messages');return}
    let msg;try{msg=JSON.parse(raw)}catch(e){return}
    if(!msg||typeof msg!=='object'||typeof msg.t!=='string')return;

    if(msg.t==='ping'){send(ws,{t:'pong',ts:msg.ts});return}

    if(msg.t==='create'||msg.t==='join'){
      let room;
      if(msg.t==='create'){
        if(rooms.size>=MAX_ROOMS)return send(ws,{t:'error',message:'Server is full, try again later'});
        detach(ws);
        room={code:newCode(),members:[],started:false,wave:1};rooms.set(room.code,room);
      }else{
        room=rooms.get(String(msg.code||'').trim().toUpperCase());
        if(!room)return send(ws,{t:'error',message:'Room not found'});
        if(room===ws.room)return;
        if(room.members.length>=MAX_PLAYERS)return send(ws,{t:'error',message:'Room is full'});
        detach(ws);
        if(!rooms.has(room.code))rooms.set(room.code,room);
      }
      const used=new Set(room.members.map(m=>m.character));
      const want=Number(msg.character);
      const character=Number.isInteger(want)&&want>=0&&want<CHAR_COUNT&&!used.has(want)?want:Array.from({length:CHAR_COUNT},(_,i)=>i).find(i=>!used.has(i));
      const member={ws,id:ws.pid,name:cleanName(msg.name),character,ready:false};
      room.members.push(member);ws.room=room;
      send(ws,{t:'joined',id:ws.pid,code:room.code});
      if(room.started){ // drop-in: join a run that is already going
        send(ws,{t:'begin',late:true,host:room.members[0].id,members:room.members.map(publicMember),wave:room.wave,map:room.map});
        broadcast(room,{t:'arrive',member:publicMember(member)},ws);
      }
      lobby(room);
      return;
    }

    const room=ws.room;if(!room)return;
    const member=room.members.find(m=>m.ws===ws);if(!member)return;
    const host=room.members[0],isHost=host===member;

    if(msg.t==='leave'){detach(ws);return}
    if(!room.started){
      if(msg.t==='select'){
        const c=Number(msg.character);
        if(Number.isInteger(c)&&c>=0&&c<CHAR_COUNT&&!room.members.some(m=>m!==member&&m.character===c)){member.character=c;lobby(room)}
        else send(ws,{t:'error',message:'Character already taken'});
      }else if(msg.t==='ready'){member.ready=!!msg.ready;lobby(room)}
      else if(msg.t==='start'&&isHost&&room.members.every(m=>m.ready||m===member)){
        room.started=true;room.map=msg.map==='metro'?'metro':'mall';room.wave=Math.max(1,Math.min(100,Math.floor(Number(msg.wave))||1));
        broadcast(room,{t:'begin',host:member.id,members:room.members.map(publicMember),wave:room.wave,map:room.map});
        lobby(room);
      }
      return;
    }
    // ---- in-game relay
    if(msg.t==='input'&&!isHost){if(Array.isArray(msg.input)&&msg.input.length<=8)send(host.ws,{t:'input',id:member.id,input:msg.input})}
    else if(msg.t==='action'&&!isHost){if(msg.action&&typeof msg.action==='object'&&raw.length<400)send(host.ws,{t:'action',id:member.id,action:msg.action})}
    else if(msg.t==='snapshot'&&isHost){if(msg.snapshot&&typeof msg.snapshot==='object')broadcast(room,{t:'snapshot',snapshot:msg.snapshot},ws)}
    else if(msg.t==='reset'&&isHost){
      room.started=false;for(const m of room.members)m.ready=false;
      broadcast(room,{t:'reset'});lobby(room);
    }
  });
});

// rate-limit window + dead connection sweep
setInterval(()=>{for(const ws of wss.clients)ws.count=0},1000).unref();
setInterval(()=>{
  for(const ws of wss.clients){
    if(!ws.isAlive){ws.terminate();continue}
    ws.isAlive=false;try{ws.ping()}catch(e){}
  }
},20000).unref();

server.listen(PORT,()=>{
  console.log('Mall of the Dead online: http://localhost:'+PORT);
  for(const list of Object.values(os.networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal)console.log('  same Wi-Fi / LAN:  http://'+n.address+':'+PORT);
});
