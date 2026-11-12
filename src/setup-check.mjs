import {spawn} from 'node:child_process';
import {homedir} from 'node:os';
import {resolveCodex} from './codex-reader.mjs';

// Query only the official local service. Reduce its response to status enums;
// never expose account details, raw errors, stderr or executable paths.
export async function checkSetup({spawnFn=spawn,codexPath=resolveCodex(),nodeVersion=process.versions.node,timeoutMs=12000,now=()=>Date.now()}={}) {
 const result={schemaVersion:1,source:'setup-check',checkedAt:new Date(now()).toISOString(),node:Number(nodeVersion.split('.')[0])>=20?'ok':'unsupported',codex:'unknown',login:'unknown'};
 if(result.node!=='ok')return {...result,errorCode:'NODE_UNSUPPORTED'};
 if(!codexPath)return {...result,codex:'missing',errorCode:'CODEX_NOT_FOUND'};
 return new Promise(resolve=>{
  let child,done=false,buffer='',phase='initialize',timer;
  const finish=extra=>{if(done)return;done=true;clearTimeout(timer);buffer='';try{child?.stdin.end();child?.kill('SIGTERM');}catch{}resolve({...result,...extra});};
  const fail=errorCode=>finish({errorCode});
  try{child=spawnFn(codexPath,['app-server','--listen','stdio://','-c','analytics.enabled=false'],{stdio:['pipe','pipe','pipe'],cwd:homedir(),env:process.env});}catch{return fail('READ_FAILED');}
  timer=setTimeout(()=>fail('TIMEOUT'),timeoutMs);
  child.on('error',e=>finish(e.code==='ENOENT'?{codex:'missing',errorCode:'CODEX_NOT_FOUND'}:{errorCode:'READ_FAILED'}));
  child.on('exit',()=>fail('SERVER_EXITED'));
  child.stderr.on('data',()=>{});
  child.stdin.on('error',()=>fail('SERVER_EXITED'));
  const send=m=>{if(!done)child.stdin.write(JSON.stringify(m)+'\n');};
  child.stdout.on('data',chunk=>{
   if(done)return;
   buffer+=chunk.toString();if(buffer.length>2*1024*1024)return fail('INVALID_RESPONSE');
   let i;while((i=buffer.indexOf('\n'))!==-1){
    const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!line.trim())continue;
    let m;try{m=JSON.parse(line);}catch{return fail('INVALID_RESPONSE');}
    if(m?.id===1&&phase==='initialize'){
     if(m.error||!m.result||typeof m.result!=='object')return fail('READ_FAILED');
     result.codex='ok';phase='account';send({method:'initialized',params:{}});
     send({id:2,method:'account/read',params:{refreshToken:false}});
    }else if(m?.id===2&&phase==='account'){
     if(m.error)return fail('ACCOUNT_UNAVAILABLE');
     const r=m.result;if(!r||!Object.hasOwn(r,'account')||typeof r.requiresOpenaiAuth!=='boolean')return fail('INVALID_RESPONSE');
     if(r.account===null)return finish({login:r.requiresOpenaiAuth?'signed_out':'unsupported'});
     if(!r.account||typeof r.account.type!=='string')return fail('INVALID_RESPONSE');
     if(r.account.type==='chatgpt')return finish({login:'chatgpt'});
     if(['apiKey','amazonBedrock'].includes(r.account.type))return finish({login:'unsupported'});
     return fail('INVALID_RESPONSE');
    }
   }
  });
  send({id:1,method:'initialize',params:{clientInfo:{name:'quota_rings_setup',version:'0.3.5'}}});
 });
}
