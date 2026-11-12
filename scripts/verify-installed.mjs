import {spawn} from 'node:child_process';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const path=process.argv[2];if(!path)throw new Error('Pass installed plugin path');
const version=JSON.parse(readFileSync(path+'/.codex-plugin/plugin.json','utf8')).version;
const child=spawn('/bin/sh',[path+'/launch.sh'],{stdio:['pipe','pipe','pipe']});
child.stdout.setEncoding('utf8');
let buffer='',id=0;const pending=new Map();
child.stderr.on('data',()=>{});child.stdout.on('data',c=>{buffer+=c;let i;while((i=buffer.indexOf('\n'))>=0){const m=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}});
const rpc=(method,params)=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(new Error('Timed out '+method)),25000);pending.set(n,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n')});
try{
 const init=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'quota-install-test',version:'0.1.0'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 assert.ok(init.serverInfo.icons?.[0]?.src?.startsWith('data:image/png;base64,'));assert.deepEqual(Buffer.from(init.serverInfo.icons[0].src.split(',')[1],'base64'),readFileSync(path+'/assets/icon-v0.3.0.png'));
 const tools=await rpc('tools/list',{});assert.equal(tools.tools.length,4);
 const read=tools.tools.find(t=>t.name==='read_quota');const demo=tools.tools.find(t=>t.name==='demo_quota');
 assert.deepEqual(read._meta['openai/ui'].entrypoints,[{type:'global'}]);assert.equal(read.title,'额度时间环');assert.equal(demo._meta['openai/ui'],undefined);
 const uri=read._meta.ui.resourceUri;assert.ok(uri.startsWith('ui://quota-rings/panel-v'+version+'-'));assert.match(uri,/-[a-f0-9]{12}\.html$/);assert.equal(read._meta['openai/outputTemplate'],uri);const ui=await rpc('resources/read',{uri});assert.match(ui.contents[0].text,/id="nested-rings"/);assert.ok(ui.contents[0].text.includes('>v'+version+'</span>'));assert.match(ui.contents[0].text,/quota-value/);assert.deepEqual(ui.contents[0]._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);assert.equal(ui.contents[0].text,readFileSync(path+'/ui.html','utf8'));
 const setup=await rpc('tools/call',{name:'check_setup',arguments:{}});assert.equal(setup.structuredContent.source,'setup-check');assert.equal(setup.structuredContent.login,'chatgpt');
 const signal=await rpc('tools/call',{name:'read_reset_signal',arguments:{}});assert.equal(signal.structuredContent.source,'reset-signal');assert.ok(!('buckets'in signal.structuredContent));
 const live=await rpc('tools/call',{name:'read_quota',arguments:{forceRefresh:true}});assert.ok(!live.structuredContent.error,JSON.stringify(live.structuredContent.error));
 console.log(JSON.stringify({installedPath:path,protocol:init.protocolVersion,entrypointServerIcon:true,resourceUri:uri,tools:tools.tools.map(x=>x.name),sidebar:{title:read.title,entrypoints:read._meta['openai/ui'].entrypoints},displayModes:ui.contents[0]._meta['openai/ui'].availableDisplayModes,resourceMime:ui.contents[0].mimeType,setup:setup.structuredContent,live:live.structuredContent,signal:signal.structuredContent},null,2));
}finally{child.stdin.end();child.kill('SIGTERM');for(const p of pending.values())clearTimeout(p.timer);}
