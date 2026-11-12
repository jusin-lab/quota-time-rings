import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {demoSnapshot} from '../src/quota.mjs';
const html=readFileSync(new URL('../plugins/quota-rings/ui.html',import.meta.url),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
async function harness(initial){
 const listeners={},els=new Map(),requests=[];const values=demoSnapshot();values.source='codex-app-server';values.buckets[0].windows[0].usedPercent=8;
 const get=id=>{if(!els.has(id))els.set(id,{textContent:'',style:{},dataset:{},classList:{toggle(){}},add(){},replaceChildren(){},addEventListener(){}});return els.get(id);};
 let window;const parent={postMessage(m){requests.push(m);if(m.id!==undefined)queueMicrotask(()=>listeners.message({source:parent,origin:'https://chatgpt.com',data:{jsonrpc:'2.0',id:m.id,result:m.method==='ui/initialize'?{}:{structuredContent:values}}}));}};
 window={parent,location:{search:''},addEventListener:(event,fn)=>listeners[event]=fn,...(initial?{__QUOTA_INITIAL__:values}:{})};
 vm.runInNewContext(js,{window,document:{getElementById:get},Option:function(){},Intl,Date,URLSearchParams,Map,Number,Math,Promise,setTimeout,clearTimeout,setInterval(){}});
 await new Promise(r=>setImmediate(r));return {requests,els};
}
test('sidebar UI automatically reads true data after host initialization, without a prompt',async()=>{const x=await harness(false);assert.deepEqual(x.requests.filter(x=>x.method==='tools/call').map(x=>x.params.name),['check_setup','read_quota','read_reset_signal']);assert.equal(x.els.get('quota-value').textContent,'92');assert.equal(x.els.get('demo-banner').hidden,true);assert.ok(!x.requests.some(x=>/message|prompt|turn\/start/.test(x.method)))});
test('preloaded live data revalidates once on entry',async()=>{const x=await harness(true);assert.deepEqual(x.requests.filter(x=>x.method==='tools/call').map(x=>x.params.name),['check_setup','read_quota','read_reset_signal']);assert.equal(x.requests.find(x=>x.method==='tools/call'&&x.params.name==='read_quota').params.arguments.forceRefresh,true);assert.equal(x.els.get('quota-value').textContent,'92')});
