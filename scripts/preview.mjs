// Optional developer preview. Loopback-only, same-origin, no CORS, no telemetry.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {readCodexLimits} from '../src/codex-reader.mjs';
import {demoSnapshot} from '../src/quota.mjs';
import {createResetSignalReader} from '../src/reset-provider.mjs';
import {createQuotaCache} from '../src/quota-cache.mjs';
export async function startPreview({port=0,live=false}={}) {
 const token=randomBytes(24).toString('hex');
 const read=createQuotaCache(readCodexLimits);
 const readResetSignal=createResetSignalReader();
 const server=createServer(async(req,res)=>{
  const host=`127.0.0.1:${server.address().port}`;
  if(req.headers.host!==host){res.writeHead(403).end();return;}
  const url=new URL(req.url,`http://${host}`);
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET'&&url.pathname==='/') {
   let html=await readFile(new URL('../plugins/quota-rings/ui.html',import.meta.url),'utf8');
   const seed=live?null:demoSnapshot();
   const script=`<script>window.__QUOTA_INITIAL__=${JSON.stringify(seed).replace(/</g,'\\u003c')};window.__QUOTA_CALL_TOOL__=async function(name,args={}){const r=await fetch('/read',{method:'POST',headers:{'Content-Type':'application/json','X-Quota-Key':'${token}'},body:JSON.stringify({name,args})});if(!r.ok)throw new Error('本地预览读取失败');return r.json()};</script>`;
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html.replace('<script>',script+'<script>'));return;
  }
  if(req.method==='POST'&&url.pathname==='/read') {
   if(req.headers['x-quota-key']!==token || req.headers.origin!==`http://${host}`){res.writeHead(403).end();return;}
   let raw='';for await(const c of req){raw+=c;if(raw.length>1024){res.writeHead(413).end();return;}}
   let body;try{body=JSON.parse(raw);}catch{res.writeHead(400).end();return;}
   if(!['read_quota','demo_quota','read_reset_signal'].includes(body.name)){res.writeHead(400).end();return;}
   if(body.name==='read_quota'&&!live){res.writeHead(409).end();return;}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body.name==='read_reset_signal'?await readResetSignal({forceRefresh:body.args?.forceRefresh===true}):body.name==='demo_quota'?demoSnapshot():await read({forceRefresh:body.args?.forceRefresh===true})));return;
  }
  res.writeHead(404).end();
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {server,url:`http://127.0.0.1:${server.address().port}/`};
}
if(import.meta.url===`file://${process.argv[1]}`){const{url}=await startPreview({port:Number(process.env.PORT||54321),live:process.argv.includes('--live')});console.log(`${url} (${process.argv.includes('--live')?'live local Codex':'explicit demo'})`);}
