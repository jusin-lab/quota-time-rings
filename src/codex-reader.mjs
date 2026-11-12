import {spawn} from 'node:child_process';
import {accessSync,constants} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {normalizeRateLimits,safeError} from './quota.mjs';
export function resolveCodex() {
  const home=homedir();
  const candidates=[process.env.QUOTA_CODEX_BIN,...(process.env.PATH??'').split(':').filter(Boolean).map(p=>join(p,'codex')),
    join(home,'.local/bin/codex'),'/opt/homebrew/bin/codex','/usr/local/bin/codex','/Applications/ChatGPT.app/Contents/Resources/codex','/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex'];
  for(const p of candidates.filter(Boolean)) {try {accessSync(p,constants.X_OK); return p;}catch{}}
  return null;
}
export function readCodexLimits({spawnFn=spawn,codexPath=resolveCodex(),timeoutMs=18000,now=()=>Date.now()}={}) {
  if(!codexPath) return Promise.resolve(safeError('CODEX_NOT_FOUND',now()));
  return new Promise(resolve=>{
    let child,done=false,buffer='',phase='initialize',timer;
    const finish=data=>{if(done)return;done=true;clearTimeout(timer);try{child?.stdin.end();child?.kill('SIGTERM');}catch{} resolve(data);};
    const fail=code=>finish(safeError(code,now()));
    try{child=spawnFn(codexPath,['app-server','--listen','stdio://','-c','analytics.enabled=false'],{stdio:['pipe','pipe','pipe'],cwd:homedir(),env:process.env});}catch{return fail('READ_FAILED');}
    timer=setTimeout(()=>fail('TIMEOUT'),timeoutMs);
    child.on('error',e=>fail(e.code==='ENOENT'?'CODEX_NOT_FOUND':'READ_FAILED'));
    child.on('exit',()=>fail('SERVER_EXITED'));
    // Drain but never forward stderr, which may contain private configuration paths.
    child.stderr.on('data',()=>{});
    child.stdin.on('error',()=>fail('SERVER_EXITED'));
    const send=message=>{if(!done)child.stdin.write(JSON.stringify(message)+'\n');};
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString(); if(buffer.length>2*1024*1024)return fail('INVALID_RESPONSE');
      let idx;while((idx=buffer.indexOf('\n'))!==-1){
        const line=buffer.slice(0,idx);buffer=buffer.slice(idx+1);if(!line.trim())continue;
        let m;try{m=JSON.parse(line);}catch{return fail('INVALID_RESPONSE');}
        if(m.id===1&&phase==='initialize'){
          if(m.error||!m.result)return fail('READ_FAILED');phase='read';
          send({method:'initialized',params:{}});
          send({id:2,method:'account/rateLimits/read'});
        }else if(m.id===2&&phase==='read'){
          if(m.error)return fail('ACCOUNT_UNAVAILABLE');
          if(!m.result||typeof m.result!=='object')return fail('INVALID_RESPONSE');
          finish(normalizeRateLimits(m.result,now()));
        }
      }
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'quota_rings',title:'Quota Rings · read-only quota panel',version:'0.3.0'}}});
  });
}
