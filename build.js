#!/usr/bin/env node
// Bundles src/*.js, src/style.css and assets/*.mp3 into the single-file index.html.
'use strict';
const fs=require('fs'),path=require('path');
const root=__dirname,src=path.join(root,'src'),assetsDir=path.join(root,'assets');
const js=fs.readdirSync(src).filter(f=>f.endsWith('.js')).sort().map(f=>'// ---- '+f+'\n'+fs.readFileSync(path.join(src,f),'utf8').replace(/^'use strict';\n/,'')).join('\n');
const css=fs.readFileSync(path.join(src,'style.css'),'utf8');
const assets={};
for(const f of fs.readdirSync(assetsDir).filter(f=>f.endsWith('.mp3')).sort())assets[path.basename(f,'.mp3')]='data:audio/mpeg;base64,'+fs.readFileSync(path.join(assetsDir,f)).toString('base64');
let html=fs.readFileSync(path.join(src,'template.html'),'utf8');
html=html.replace('/*__CSS__*/',()=>css).replace('/*__ASSETS__*/',()=>JSON.stringify(assets)).replace('/*__JS__*/',()=>"'use strict';\n"+js);
const out=path.join(root,process.argv[2]||'index.html');
fs.writeFileSync(out,html);
console.log('built',path.relative(root,out),(html.length/1048576).toFixed(2)+' MB');
