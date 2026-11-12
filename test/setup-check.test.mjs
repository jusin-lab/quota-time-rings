import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {checkSetup} from '../src/setup-check.mjs';
function server(respond){
 const child=new EventEmitter(),requests=[];let killed=0;
 child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>killed++;
 child.stdin.on('data',chunk=>{for(const line of chunk.toString().trim().split('\n')){const m=JSON.parse(line);requests.push(m);queueMicrotask(()=>respond(m,child));}});
 return {spawnFn:()=>child,codexPath:'/synthetic/codex',nodeVersion:'20.0.0',requests,get killed(){return killed;}};
}
const write=(c,m)=>c.stdout.write(JSON.stringify(m)+'\n');
const accountServer=result=>server((m,c)=>{if(m.id===1)write(c,{id:1,result:{}});if(m.id===2)write(c,{id:2,result});});
test('setup keeps only statuses and never refreshes, signs in, or returns profile fields',async()=>{
 const f=accountServer({account:{type:'chatgpt',email:'private@example.com',id:'private-account',planType:'private-plan'},requiresOpenaiAuth:true});
 const r=await checkSetup(f);assert.equal(r.login,'chatgpt');assert.equal(r.codex,'ok');assert.deepEqual(f.requests.map(x=>x.method),['initialize','initialized','account/read']);assert.deepEqual(f.requests[2].params,{refreshToken:false});assert.ok(!JSON.stringify(r).includes('private'));assert.equal(f.killed,1);
 assert.deepEqual(Object.keys(r).sort(),['checkedAt','codex','login','node','schemaVersion','source']);
});
test('setup distinguishes sign-out, API-key/Bedrock modes and a non-OpenAI provider',async()=>{
 for(const [account,requiresOpenaiAuth,want]of [[null,true,'signed_out'],[null,false,'unsupported'],[{type:'apiKey'},true,'unsupported'],[{type:'amazonBedrock'},false,'unsupported']]){
  const r=await checkSetup(accountServer({account,requiresOpenaiAuth}));assert.equal(r.login,want);assert.equal(r.errorCode,undefined);
 }
});
test('missing runtime or executable gives actionable status without spawning',async()=>{
 const spawnFn=()=>{throw new Error('must not spawn');};
 assert.equal((await checkSetup({spawnFn,nodeVersion:'18.20.0',codexPath:'/synthetic/codex'})).errorCode,'NODE_UNSUPPORTED');
 assert.equal((await checkSetup({spawnFn,nodeVersion:'20.0.0',codexPath:null})).codex,'missing');
});
test('malformed or unknown account responses remain unknown rather than signed out',async()=>{
 for(const result of [{},{account:null},{account:{type:'unexpected'},requiresOpenaiAuth:true},{account:[],requiresOpenaiAuth:true}]){
  const r=await checkSetup(accountServer(result));assert.equal(r.login,'unknown');assert.equal(r.errorCode,'INVALID_RESPONSE');
 }
});
test('setup timeout, process exit, parse failure and server errors are redacted',async()=>{
 for(const [respond,code]of [[()=>{},'TIMEOUT'],[(m,c)=>c.emit('exit',1),'SERVER_EXITED'],[(m,c)=>c.stdout.write('private raw error\n'),'INVALID_RESPONSE'],[(m,c)=>{if(m.id===1)write(c,{id:1,result:{}});else if(m.id===2)write(c,{id:2,error:{message:'private secret'}});},'ACCOUNT_UNAVAILABLE']]){
  const r=await checkSetup({...server(respond),timeoutMs:10});assert.equal(r.errorCode,code);assert.equal(r.login,'unknown');assert.ok(!JSON.stringify(r).includes('private'));
 }
});
