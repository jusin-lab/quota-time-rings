import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../plugins/quota-rings/ui.html',import.meta.url),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const script=source.replace(/\n\}\)\(\);\s*$/,'\nwindow.__test={dictionaries,supported,explicitTimestamp,get nextQuotaRunAt(){return nextQuotaRunAt;},get lastQuotaSuccessAt(){return lastQuotaSuccessAt;}};\n})();');
const NOW=Date.parse('2026-11-11T10:00:00Z'),DAY=86400000,WEEK=7*DAY;
const iso=x=>new Date(x).toISOString();
const quota=(now=NOW,override={})=>({schemaVersion:1,source:'codex-app-server',fetchedAt:iso(now),buckets:[{id:'main',name:'Codex',windows:[{kind:'primary',usedPercent:8,windowDurationMins:300,resetsAt:(now+150*60000)/1000}]}],...override});
const signal=(prediction={},override={})=>({schemaVersion:1,source:'reset-signal',checkedAt:iso(NOW),status:'hint',verification:'primary',retrieval:'ok',staleAfterMs:DAY,signal:{publishedAt:'2026-11-11T06:57:08Z',originalUrl:'https://x.com/example/status/123',evidenceUrl:'https://example.org/archive/123',attribution:'Tibo (Thibault Sottiaux)',evidenceKind:'primary',summary:{en:'Thursday, hour not specified.','zh-CN':'周四，但小时未说明。','zh-TW':'週四，但小時未說明。'},prediction:{earliestAt:null,latestAt:null,timeZone:null,timeBasis:'unspecified',assumption:'No published time zone.',...prediction}},...override});
const noSignal=()=>({schemaVersion:1,source:'reset-signal',checkedAt:iso(NOW),status:'unknown',verification:'unavailable',retrieval:'not-configured',staleAfterMs:DAY,signal:null,error:{code:'NOT_CONFIGURED'}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(config={}){
 let now=NOW,intersectionCallback=null;
 const listeners={},docListeners={},els=new Map(),requests=[],intervals=[],held=[],storage=new Map(Object.entries(config.storage||{}));
 const get=id=>{if(!els.has(id)){const attrs={},events={},classes=new Set();els.set(id,{id,textContent:'',style:{},dataset:{},hidden:new RegExp('<[^>]+id="'+id+'"[^>]*\\bhidden\\b').test(html),disabled:false,value:'',children:[],attrs,events,classes,classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}},setAttribute(name,value){attrs[name]=String(value)},removeAttribute(name){delete attrs[name]},add(o){this.children.push(o)},replaceChildren(){this.children=[]},addEventListener(event,fn){events[event]=fn},focus(){this.focused=true;document.activeElement=this},contains(target){return target===this}});}return els.get(id);};
 const document={getElementById:get,documentElement:{lang:'en'},title:'',visibilityState:config.hidden?'hidden':'visible',addEventListener:(name,fn)=>docListeners[name]=fn};
 const parent={postMessage(message){requests.push(message);if(message.id===undefined)return;const reply=value=>queueMicrotask(()=>listeners.message({source:parent,origin:'https://chatgpt.com',data:{jsonrpc:'2.0',id:message.id,result:value}}));if(message.method==='ui/initialize'){if(config.holdInitialize)held.push({message,reply});else reply({hostContext:{locale:config.hostLocale}});return;}const tool=message.params.name;if(config.hold?.includes(tool)){held.push({message,reply});return;}let result=config.respond?.(tool,message.params.arguments,now);if(result===undefined)result=tool==='read_reset_signal'?(config.signal||noSignal()):tool==='demo_quota'?{...quota(now),source:'demo'}:quota(now);reply({structuredContent:result});}};
 const window={IntersectionObserver:class{constructor(callback){intersectionCallback=callback;}observe(){}},parent,location:{search:config.search||''},navigator:{languages:config.languages||['en-US'],language:config.language},localStorage:{getItem:key=>{if(config.storageThrows)throw new Error('Storage unavailable');return storage.get(key)??null;},setItem:(key,value)=>{if(config.storageThrows)throw new Error('Storage unavailable');storage.set(key,value);},removeItem:key=>storage.delete(key)},openai:config.openai||{},addEventListener:(name,fn)=>listeners[name]=fn,...(config.initial?{__QUOTA_INITIAL__:config.initial}:{}),...(config.initialSignal?{__RESET_SIGNAL_INITIAL__:config.initialSignal}:{})};
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const viewerIntl=Object.create(Intl);viewerIntl.DateTimeFormat=function(locales,options={}){return new Intl.DateTimeFormat(locales,{...(config.timeZone?{timeZone:config.timeZone}:{}),...options});};
 vm.runInNewContext(script,{window,document,Option:function(text,value){this.text=text;this.value=value;},Intl:viewerIntl,Date:ClockDate,URL,URLSearchParams,Map,Set,Number,Math,Promise,Object,setTimeout(){return 1;},clearTimeout(){},setInterval:fn=>intervals.push(fn)});
 await flush();
 return {window,document,els,get,requests,storage,held,tools:name=>requests.filter(x=>x.method==='tools/call'&&(!name||x.params.name===name)),async tick(ms){now+=ms;for(const fn of intervals)fn();await flush();},async advance(ms){now+=ms;await flush();},async click(id){get(id).events.click?.({target:get(id)});await flush();},async change(id,value){get(id).value=value;get(id).events.change?.({target:get(id)});await flush();},async event(name,detail){listeners[name]?.({detail});await flush();},async docEvent(name,event){docListeners[name]?.(event);await flush();},async intersect(value){intersectionCallback?.([{target:get('main'),isIntersecting:value}]);await flush();},async visible(value){document.visibilityState=value?'visible':'hidden';docListeners.visibilitychange?.({});await flush();},async notify(value,origin='https://chatgpt.com',source=parent){listeners.message({source,origin,data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:value}}});await flush();},async connect(){const i=held.findIndex(x=>x.message.method==='ui/initialize');assert.ok(i>=0);held.splice(i,1)[0].reply({hostContext:{locale:config.hostLocale}});await flush();},async release(tool,value){const i=held.findIndex(x=>x.message.params.name===tool);assert.ok(i>=0);held.splice(i,1)[0].reply({structuredContent:value});await flush();}};
}
test('host locale wins; regional Chinese and all seven complete dictionaries resolve',async()=>{
 const h=await harness({hostLocale:'zh-Hant-HK',openai:{locale:'ja-JP'},languages:['fr-FR']});
 assert.equal(h.document.documentElement.lang,'zh-TW');assert.equal(h.get('refresh').attrs['aria-label'],'重新整理額度');
 const dicts=h.window.__test.dictionaries,keys=Object.keys(dicts.en).sort();
 assert.equal(Object.keys(dicts).length,7);for(const [locale,dict]of Object.entries(dicts)){assert.deepEqual(Object.keys(dict).sort(),keys,locale);for(const value of Object.values(dict))assert.ok(typeof value==='string'&&value.length);}
 for(const [raw,want]of [['zh-Hans','zh-CN'],['zh-SG','zh-CN'],['zh_MO','zh-TW'],['en-GB','en'],['ja-JP','ja'],['fr-CA','fr'],['es-MX','es'],['de-AT','de']])assert.equal(h.window.__test.supported(raw),want);
});
test('auto locale falls through openai, browser preferences, then English; override persists',async()=>{
 assert.equal((await harness({openai:{locale:'ja-JP'},languages:['es-MX']})).document.documentElement.lang,'ja');
 const h=await harness({hostLocale:'xx',languages:['xx','fr-CA']});assert.equal(h.document.documentElement.lang,'fr');
 await h.change('language','de');assert.equal(h.document.documentElement.lang,'de');assert.equal(h.storage.get('quota-rings-language'),'de');
 await h.event('openai:set_globals',{globals:{locale:'zh-CN'}});assert.equal(h.document.documentElement.lang,'de');
 await h.change('language','auto');assert.equal(h.document.documentElement.lang,'zh-CN');
 assert.equal((await harness({languages:['ko-KR']})).document.documentElement.lang,'en');
 assert.equal((await harness({hostLocale:'de-DE',storage:{'quota-rings-language':'es'}})).document.documentElement.lang,'es');
});
test('panel entry refreshes preloaded quota exactly once, forces read and never sends a prompt',async()=>{
 const h=await harness({initial:quota(NOW-DAY)});assert.deepEqual(h.tools().map(x=>x.params.name),['read_quota','read_reset_signal']);
 assert.equal(h.tools('read_quota')[0].params.arguments.forceRefresh,true);assert.equal(h.get('quota-value').textContent,'92');
 await h.event('pageshow');await h.visible(true);assert.equal(h.tools('read_quota').length,1);
 assert.ok(!h.requests.some(x=>/prompt|message|turn\/start/.test(x.method)));
});
test('visible polling defaults to 60 seconds, stops hidden, resumes fresh without duplicate lifecycle calls',async()=>{
 const h=await harness();await h.tick(59999);assert.equal(h.tools('read_quota').length,1);await h.tick(1);assert.equal(h.tools('read_quota').length,2);assert.equal(h.tools('read_quota')[1].params.arguments.forceRefresh,false);
 await h.visible(false);await h.tick(600000);assert.equal(h.tools('read_quota').length,2);
 await h.visible(true);await h.event('pageshow');assert.equal(h.tools('read_quota').length,3);assert.equal(h.tools('read_quota')[2].params.arguments.forceRefresh,true);
 assert.equal(h.tools('read_reset_signal').length,2,'source revalidates on visible re-entry');
});
test('five-minute/off controls persist; off still refreshes on entry and manual request',async()=>{
 const h=await harness();await h.change('auto-refresh','300');await h.tick(299999);assert.equal(h.tools('read_quota').length,1);await h.tick(1);assert.equal(h.tools('read_quota').length,2);
 await h.change('auto-refresh','off');await h.tick(DAY);assert.equal(h.tools('read_quota').length,2);assert.equal(h.storage.get('quota-rings-auto-refresh'),'off');
 await h.visible(false);await h.visible(true);assert.equal(h.tools('read_quota').length,3);
 await h.click('refresh');assert.equal(h.tools('read_quota').length,4);assert.equal(h.tools('read_quota').at(-1).params.arguments.forceRefresh,true);
});
test('slow signal never blocks quota, and busy quota calls never overlap',async()=>{
 const h=await harness({hold:['read_reset_signal']});assert.equal(h.get('quota-value').textContent,'92');assert.equal(h.get('refresh').disabled,false);assert.equal(h.get('signal-refresh').disabled,true);
 await h.click('refresh');assert.equal(h.tools('read_quota').length,2);assert.equal(h.tools('read_reset_signal').length,1);
 const q=await harness({hold:['read_quota']});await q.click('refresh');await q.tick(60000);await q.visible(false);await q.visible(true);assert.equal(q.tools('read_quota').length,1);
 await q.release('read_quota',quota());assert.equal(q.get('quota-value').textContent,'92');assert.equal(q.get('refresh').disabled,false);
});
test('structured quota failure preserves last good value and timestamp and localizes error codes',async()=>{
 let fail=false;const h=await harness({hostLocale:'es',respond:name=>name==='read_quota'&&fail?quota(NOW,{buckets:[],error:{code:'ACCOUNT_UNAVAILABLE',message:'秘密错误内容'}}):undefined});
 const fetched=h.get('fetched').textContent;fail=true;await h.click('refresh');assert.equal(h.get('quota-value').textContent,'92');assert.equal(h.get('fetched').textContent,fetched);assert.equal(h.get('status').dataset.state,'stale');assert.match(h.get('error').textContent,/Codex no devolvió/);assert.ok(!h.get('error').textContent.includes('秘密'));
 await h.change('language','de');assert.match(h.get('error').textContent,/Codex lieferte kein/);
 const first=await harness({respond:name=>name==='read_quota'?quota(NOW,{buckets:[],error:{code:'CODEX_NOT_FOUND',message:'raw'}}):undefined});assert.equal(first.get('quota-value').textContent,'—');assert.match(first.get('error').textContent,/not found/);
});
test('timezone-unknown Tibo hint is not zero and is not mislabeled as retrieval failure',async()=>{
 const h=await harness({signal:signal({}, {error:{code:'NO_RELIABLE_SIGNAL'}})});
 assert.equal(h.get('prediction-value').textContent,'—');assert.equal(h.get('prediction-unit').textContent,'');assert.ok(h.get('prediction-gauge').classes.has('unknown'));assert.equal(h.get('prediction-arc').style.strokeDashoffset,String(100));
 assert.match(h.get('signal-state').textContent,/Time unconfirmed.*Unconfirmed hint/);assert.ok(!h.get('signal-state').textContent.includes('failed'));assert.match(h.get('signal-zone').textContent,/Unspecified/);assert.match(h.get('signal-explanation').textContent,/weekday alone/);assert.equal(h.get('signal-error').textContent,'');
 assert.match(h.get('signal-disclaimer').textContent,/15-minute cache/);assert.equal(h.get('signal-verification').textContent,'Primary source checked');
});
test('prediction interval uses seven days, not quota period, and never invents a midpoint',async()=>{
 const h=await harness({signal:signal({earliestAt:iso(NOW+2*DAY),latestAt:iso(NOW+3*DAY),timeZone:'UTC',timeBasis:'explicit-source'})});assert.equal(h.get('prediction-value').textContent,'29–43');assert.equal(h.get('time-value').textContent,'50');
 assert.ok(Math.abs(Number(h.get('prediction-arc').style.strokeDashoffset)-100*(1-2/7))<1e-8);assert.ok(Math.abs(Number(h.get('prediction-range-arc').style.strokeDashoffset)-100*(1-3/7))<1e-8);
 assert.match(h.get('prediction-gauge').attrs['aria-label'],/29% – 43%/);assert.equal(h.get('signal-zone').textContent,'UTC');assert.match(h.get('signal-window').textContent,/Your time zone:/);
});
test('floating times, invalid dates, missing endpoints and reversed ranges remain unknown',async()=>{
 const pairs=[['2026-11-12T12:00:00','2026-11-13T12:00:00'],['2026-02-30T12:00:00Z','2026-12-13T12:00:00Z'],[iso(NOW+3*DAY),iso(NOW+2*DAY)],[null,iso(NOW+2*DAY)],['Thursday','Thursday']];
 for(const [earliestAt,latestAt]of pairs){const h=await harness({signal:signal({earliestAt,latestAt,timeZone:'UTC',timeBasis:'explicit-source'})});assert.equal(h.get('prediction-value').textContent,'—');}
 const h=await harness();const parse=h.window.__test.explicitTimestamp;
 assert.equal(parse('2026-11-12T12:00:00+08:00'),Date.parse('2026-11-12T04:00:00Z'));assert.equal(parse('2026-11-12T25:00:00Z'),null);assert.equal(parse('2026-11-12T12:00:00+99:00'),null);assert.equal(parse(null),null);
});
test('expired and open windows stay distinct without asserting replenishment',async()=>{
 const expired=await harness({signal:signal({earliestAt:iso(NOW-2*DAY),latestAt:iso(NOW-DAY),timeZone:'UTC',timeBasis:'explicit-source'})});assert.equal(expired.get('prediction-value').textContent,'—');assert.match(expired.get('signal-state').textContent,/window ended/);assert.match(expired.get('signal-explanation').textContent,/No reset is inferred/);
 const open=await harness({signal:signal({earliestAt:iso(NOW-DAY),latestAt:iso(NOW+DAY),timeZone:'UTC',timeBasis:'explicit-source'})});assert.equal(open.get('prediction-value').textContent,'0–14');assert.match(open.get('signal-state').textContent,/Within possible window/);
 const point=await harness({signal:signal({earliestAt:iso(NOW+DAY),latestAt:iso(NOW+DAY),timeZone:'UTC',timeBasis:'explicit-source'})});assert.equal(point.get('prediction-value').textContent,'14');
});
test('URLs only allow safe HTTPS and source strings cannot inject HTML',async()=>{
 const payload=signal();payload.signal.summary.en='<img src=x onerror=alert(1)>';payload.signal.prediction.assumption='<script>bad()</script>';
 for(const bad of ['javascript:alert(1)','http://example.com','data:text/html,hi','https://user:secret@example.com','https://example.com/\nfoo']){payload.signal.originalUrl=bad;const h=await harness({signal:payload});assert.equal(h.get('original-link').hidden,true);assert.equal(h.get('original-link').attrs.href,undefined);assert.equal(h.get('signal-summary').textContent,'<img src=x onerror=alert(1)>');assert.equal(h.get('signal-assumption').textContent,'<script>bad()</script>');}
 const h=await harness({signal:signal()});assert.equal(h.get('original-link').attrs.href,'https://x.com/example/status/123');assert.equal(h.get('evidence-link').hidden,false);assert.ok(!/\.innerHTML|document\.write|\beval\(/.test(source));assert.match(html,/rel="noopener noreferrer"/);
});
test('signal retrieval failure and no signal are distinguishable and independent of quota',async()=>{
 const failure=await harness({signal:signal({}, {retrieval:'error',signal:null,verification:'unavailable',error:{code:'SOURCE_UNAVAILABLE'}})});assert.match(failure.get('signal-state').textContent,/failed/);assert.equal(failure.get('quota-value').textContent,'92');assert.equal(failure.get('error').textContent,'');assert.equal(failure.get('status').dataset.state,'fresh');
 const absent=await harness({signal:signal({}, {status:'unknown',signal:null,error:{code:'NO_RELIABLE_SIGNAL'}})});assert.match(absent.get('signal-state').textContent,/No reliable signal/);assert.equal(absent.get('signal-error').textContent,'');
 await failure.click('signal-refresh');assert.equal(failure.tools('read_reset_signal').length,2);assert.equal(failure.tools('read_quota').length,1);
});
test('demo is explicit; autoplay cannot switch it to live or use a hypothetical source as evidence',async()=>{
 const h=await harness({search:'?demo'});assert.equal(h.get('demo-banner').hidden,true);assert.equal(h.get('quota-value').textContent,'92');
 await h.click('demo');assert.equal(h.get('demo-banner').hidden,false);assert.equal(h.get('prediction-value').textContent,'29–43');assert.equal(h.get('signal-state').textContent,'Hypothetical demo');assert.equal(h.get('original-link').hidden,true);assert.match(h.get('auto-note').textContent,/paused for demo/);
 const reads=h.tools('read_quota').length;await h.tick(DAY);await h.visible(false);await h.visible(true);await h.event('pageshow');assert.equal(h.tools('read_quota').length,reads);
 await h.click('refresh');assert.equal(h.get('demo-banner').hidden,true);assert.equal(h.get('quota-value').textContent,'92');assert.equal(h.tools('read_reset_signal').length,2);
});
test('saved evidence timestamps stay unchanged on reload and stale evidence is labeled',async()=>{
 const old=signal({}, {checkedAt:iso(NOW-2*DAY)}),h=await harness({signal:old});assert.match(h.get('signal-state').textContent,/needs updating/);const checked=h.get('signal-checked').textContent;await h.click('signal-refresh');assert.equal(h.get('signal-checked').textContent,checked);assert.equal(h.get('signal-checked-label').textContent,'Source last checked');
});
test('tool notifications reject unrelated sender and changed origin',async()=>{
 const h=await harness();const changed=quota(NOW,{buckets:[{id:'main',windows:[{usedPercent:99,windowDurationMins:300,resetsAt:NOW/1000+3000}]}]});
 await h.notify(changed,'https://evil.example');assert.equal(h.get('quota-value').textContent,'92');await h.notify(changed,'https://chatgpt.com',{});assert.equal(h.get('quota-value').textContent,'92');await h.notify(changed);assert.equal(h.get('quota-value').textContent,'1');
});
test('accessibility includes localized labels, live statuses, keyboard focus and reduced motion',async()=>{
 const h=await harness({hostLocale:'ja'});assert.equal(h.get('main').attrs['aria-label'],'利用枠とリセット予測');assert.match(h.get('prediction-gauge').attrs['aria-label'],/追加リセット/);assert.match(html,/prefers-reduced-motion:reduce/);assert.match(html,/button:focus-visible,select:focus-visible,a:focus-visible/);assert.match(html,/aria-live="polite"/);
});

test('explicit source timezone evidence is required, not just UTC endpoint encoding',async()=>{
 for(const details of [{timeZone:null,timeBasis:'explicit-source'},{timeZone:'Invalid/Zone',timeBasis:'explicit-source'},{timeZone:'UTC',timeBasis:'unspecified'},{timeZone:'+08:00',timeBasis:'explicit-source'}]){
  const h=await harness({signal:signal({earliestAt:iso(NOW+DAY),latestAt:iso(NOW+2*DAY),...details})});assert.equal(h.get('prediction-value').textContent,'—');assert.match(h.get('signal-zone').textContent,/Unspecified/);
 }
 const h=await harness({signal:signal({earliestAt:'2026-11-12T02:00:00-08:00',latestAt:'2026-11-13T02:00:00-08:00',timeZone:'America/Los_Angeles',timeBasis:'explicit-source'})});assert.equal(h.get('prediction-value').textContent,'14–29');assert.equal(h.get('signal-zone').textContent,'America/Los_Angeles');
});
test('unconfigured public signal snapshot is not a source failure',async()=>{
 const h=await harness();assert.match(h.get('signal-state').textContent,/No signal source is configured/);assert.equal(h.get('signal-error').textContent,'');assert.notEqual(h.get('signal-panel').dataset.state,'error');
});

test('primary duplicate evidence links are hidden and distinct supporting sources are neutral',async()=>{
 const equal=signal();equal.signal.evidenceUrl=equal.signal.originalUrl;const h=await harness({signal:equal});assert.equal(h.get('original-link').hidden,false);assert.equal(h.get('evidence-link').hidden,true);
 const distinct=await harness({signal:signal()});assert.equal(distinct.get('evidence-link').textContent,'Supporting source ↗');
});
test('live signal completing after explicit demo cannot overwrite the hypothetical demonstration',async()=>{
 const h=await harness({hold:['read_reset_signal']});await h.click('demo');await h.release('read_reset_signal',signal());assert.equal(h.get('signal-state').textContent,'Hypothetical demo');assert.equal(h.get('prediction-value').textContent,'29–43');assert.equal(h.get('signal-refresh').disabled,true);await h.click('signal-refresh');assert.equal(h.tools('read_reset_signal').length,1);
});
test('host locale keeps priority over subsequent lower-priority openai locale changes',async()=>{
 const h=await harness({hostLocale:'ja',openai:{locale:'en'}});await h.event('openai:set_globals',{globals:{locale:'zh-CN'}});assert.equal(h.document.documentElement.lang,'ja');
});
test('known source assumptions localize and minute-precision publication does not invent seconds',async()=>{
 const value=signal();value.signal.publishedPrecision='minute';value.signal.prediction.assumptionKey='noTimezone';const h=await harness({hostLocale:'es',signal:value});assert.match(h.get('signal-assumption').textContent,/La fuente no especifica/);assert.equal(h.get('signal-assumption-label').textContent,'Supuestos de tiempo');assert.ok(!h.get('signal-published').textContent.includes(':08'));
});

test('SPA-hidden panels and pagehide pause polling even when document remains visible',async()=>{
 const h=await harness();await h.intersect(false);await h.tick(180000);assert.equal(h.document.visibilityState,'visible');assert.equal(h.tools('read_quota').length,1);
 await h.intersect(true);await h.event('pageshow');assert.equal(h.tools('read_quota').length,2);assert.equal(h.tools('read_quota').at(-1).params.arguments.forceRefresh,true);
 await h.event('pagehide');await h.tick(180000);assert.equal(h.tools('read_quota').length,2);await h.intersect(false);await h.intersect(true);assert.equal(h.tools('read_quota').length,2,'pagehide stays paused even if intersection changes');
 await h.event('pageshow');assert.equal(h.tools('read_quota').length,3);
});


test('default layout is one concentric SVG, three legend rows, a small source note and hidden options',async()=>{
 const rings=html.match(/<section class="activity"[^>]*>([\s\S]*?)<\/section>/)[1];
 assert.equal((rings.match(/<svg\b/g)||[]).length,1);
 assert.equal((rings.match(/<g class="gauge/g)||[]).length,3);
 for(const [name,radius]of [['quota',144],['time',110],['prediction',76]])assert.match(rings,new RegExp('id="'+name+'-arc" cx="160" cy="160" r="'+radius+'" pathLength="100"'));
 const legend=html.match(/<div class="legend"[^>]*>([\s\S]*?)<section id="settings"/)[1];
 assert.equal((legend.match(/class="legend-row/g)||[]).length,3);
 assert.match(html,/<section id="settings"[^>]* hidden>/);
 assert.match(html,/\.unknown \.track\{[^}]*stroke-dasharray:1 2/);
 const h=await harness({hostLocale:'zh-CN',signal:signal()});
 assert.equal(h.get('settings').hidden,true);
 assert.equal(h.get('quota-title').textContent,'额度剩余');assert.equal(h.get('time-title').textContent,'自然重置');assert.equal(h.get('prediction-title').textContent,'预测重置');assert.equal(h.get('prediction-summary').textContent,'未知');
 assert.match(h.get('time-row').attrs.title,/账户自然重置/);assert.ok(!h.get('time-sub').textContent.includes('秒'));
});
test('options open from the gear and close by Escape or outside click',async()=>{
 const h=await harness();await h.click('settings-toggle');assert.equal(h.get('settings').hidden,false);assert.equal(h.get('settings-toggle').attrs['aria-expanded'],'true');
 await h.docEvent('keydown',{key:'Escape',preventDefault(){}});assert.equal(h.get('settings').hidden,true);assert.equal(h.get('settings-toggle').focused,true);
 await h.click('settings-toggle');await h.docEvent('click',{target:h.get('time-row')});assert.equal(h.get('settings').hidden,true);
});
const inference=()=>signal({earliestAt:'2026-11-12T08:00:00Z',estimatedAt:'2026-11-12T20:00:00Z',latestAt:'2026-11-13T08:00:00Z',timeZone:'America/Los_Angeles',timeBasis:'inferred',timeZoneBasis:'assumed-from-monitor-display',assumptionKey:'weekdayPacificMidpoint',assumption:'The monitor uses Pacific time. Thursday noon is an estimate with a full-day interval.'},{sourceProvider:{id:'github-tibo-monitor',name:'thsottiaux-Tibo-x-monitor',url:'https://github.com/PengZoneLab/thsottiaux-Tibo-x-monitor'},selectedSourceId:'github-tibo-monitor'});
test('authorized inference uses an estimated point and clearly discloses source and assumed timezone',async()=>{
 const h=await harness({hostLocale:'zh-CN',signal:inference()});
 assert.equal(h.get('prediction-value').textContent,'20');
 assert.ok(Math.abs(Number(h.get('prediction-arc').style.strokeDashoffset)-100*(1-34/168))<1e-8);
 assert.ok(Math.abs(Number(h.get('prediction-range-arc').style.strokeDashoffset)-100*(1-46/168))<1e-8);
 assert.equal(h.get('prediction-percent').textContent,'20%');assert.equal(h.get('prediction-percent').hidden,false);assert.match(h.get('prediction-remaining').textContent,/剩.*1天.*10小时/);assert.notEqual(h.get('prediction-summary').textContent,'未知');
 assert.match(h.get('signal-zone').textContent,/America\/Los_Angeles（假设）/);assert.match(h.get('signal-state').textContent,/预测值/);
 assert.match(h.get('prediction-reason').textContent,/美西.*星期四中午.*全天/);
 assert.equal(h.get('prediction-source').attrs.href,'https://github.com/PengZoneLab/thsottiaux-Tibo-x-monitor');
 assert.match(h.get('prediction-row').attrs['aria-label'],/预测值/);
});
test('inference rejects missing assumptions, missing estimate, points outside interval, and floating estimates',async()=>{
 for(const change of [{assumption:''},{estimatedAt:null},{estimatedAt:'2026-11-14T20:00:00Z'},{estimatedAt:'2026-11-12T20:00:00'}]){
  const value=inference();Object.assign(value.signal.prediction,change);const h=await harness({signal:value});assert.equal(h.get('prediction-value').textContent,'—');assert.equal(h.get('prediction-summary').textContent,'Unknown');
 }
});
test('source polling uses fifteen minutes, manual refresh forces read, and Off pauses both',async()=>{
 const h=await harness({signal:inference()});await h.tick(899999);assert.equal(h.tools('read_reset_signal').length,1);await h.tick(1);assert.equal(h.tools('read_reset_signal').length,2);assert.equal(h.tools('read_reset_signal').at(-1).params.arguments.forceRefresh,false);
 await h.click('signal-refresh');assert.equal(h.tools('read_reset_signal').at(-1).params.arguments.forceRefresh,true);
 await h.change('auto-refresh','off');const reads=h.tools('read_reset_signal').length;await h.tick(DAY);assert.equal(h.tools('read_reset_signal').length,reads);
});
test('failed source refresh keeps prior prediction and marks the small source note',async()=>{
 let fail=false;const h=await harness({signal:inference(),respond:name=>{if(name==='read_reset_signal'&&fail)throw new Error('not available');}});
 const value=h.get('prediction-summary').textContent;fail=true;await h.click('signal-refresh');
 assert.equal(h.get('prediction-summary').textContent,value);assert.match(h.get('prediction-update').textContent,/refresh failed/);assert.equal(h.get('prediction-note').dataset.state,'stale');
});

test('upstream stale, error and partial source states appear even with a fresh local check',async()=>{
 for(const [status,expected]of [['stale',/source needs updating/],['error',/refresh failed/]]){
  const value=inference();value.sources=[{id:'github-tibo-monitor',status,checkedAt:iso(NOW)}];value.predictions=[{sourceId:'github-tibo-monitor',sourceStale:status==='stale'}];const h=await harness({signal:value});assert.match(h.get('prediction-update').textContent,expected);assert.equal(h.get('prediction-note').dataset.state,'stale');
 }
 const partial=inference();partial.retrieval='partial';const h=await harness({signal:partial});assert.match(h.get('prediction-update').textContent,/Partial retrieval/);
});
test('weekday text follows the estimate in assumed source zone and never hardcodes a twelve-hour range',async()=>{
 const value=inference();Object.assign(value.signal.prediction,{earliestAt:'2026-11-13T08:00:00Z',estimatedAt:'2026-11-13T20:00:00Z',latestAt:'2026-11-14T08:00:00Z',weekday:'Friday'});
 const h=await harness({hostLocale:'zh-CN',signal:value});assert.match(h.get('prediction-reason').textContent,/星期五中午.*全天/);assert.ok(!h.get('prediction-reason').textContent.includes('12'));
});


test('all seven page names are localized Quota Time Rings names',async()=>{
 const names={en:'Quota Time Rings','zh-CN':'额度时间环','zh-TW':'額度時間環',ja:'利用枠・時間リング',es:'Anillos de cuota y tiempo',fr:'Anneaux de quota et de temps',de:'Kontingent- und Zeitringe'};
 for(const [hostLocale,name]of Object.entries(names)){const h=await harness({hostLocale});assert.equal(h.document.title,name);assert.equal(h.get('title').textContent,name);}
});
test('visible natural and predicted dates use viewer weekday, not the assumed Pacific weekday',async()=>{
 const value=inference(),h=await harness({hostLocale:'zh-CN',timeZone:'Asia/Shanghai',signal:value});
 assert.match(h.get('prediction-summary').textContent,/周五.*04:00/);
 assert.match(h.get('prediction-reason').textContent,/美西.*星期四中午/);
 assert.match(h.get('time-when').textContent,/周三.*20:30/);
 assert.match(h.get('time-sub').textContent,/剩.*2小时.*30分钟/);
 assert.match(h.get('reset').textContent,/2026.*11.*11.*周三/);
 assert.match(h.get('prediction-row').attrs.title,/20%/);
 assert.match(h.get('prediction-gauge').attrs['aria-label'],/20%/);
 assert.match(h.get('signal-window').textContent,/Asia\/Shanghai/);
 const la=await harness({hostLocale:'en',timeZone:'America/Los_Angeles',signal:value});assert.match(la.get('prediction-summary').textContent,/Thu/);assert.ok(!la.get('prediction-summary').textContent.includes('Fri'));
});
test('visible percentage and days-hours countdown track an inferred estimate independently of the account period',async()=>{
 const h=await harness({hostLocale:'zh-CN',signal:inference()});
 assert.equal(h.get('prediction-percent').textContent,'20%');assert.equal(h.get('time-value').textContent,'50');
 await h.change('auto-refresh','off');await h.tick(10*3600000);
 assert.equal(h.get('prediction-percent').textContent,'14%');assert.match(h.get('prediction-remaining').textContent,/剩.*1天.*0小时/);
 assert.equal(h.get('time-value').textContent,'0');assert.match(h.get('time-sub').textContent,/已到/);
 assert.match(h.get('freshness').textContent,/到期|需更新/);
});
test('known natural reset still shows weekday and countdown if the service omits the period',async()=>{
 const value=quota();value.buckets[0].windows[0].windowDurationMins=null;
 const h=await harness({timeZone:'Asia/Shanghai',hostLocale:'zh-CN',respond:name=>name==='read_quota'?value:undefined});
 assert.equal(h.get('time-value').textContent,'—');assert.equal(h.get('time-when').hidden,false);assert.match(h.get('time-when').textContent,/周三/);assert.equal(h.get('time-secondary').hidden,false);assert.match(h.get('time-sub').textContent,/2小时/);
});
test('visible unknown, interval, elapsed estimate and expired window preserve their distinct meanings',async()=>{
 const unknown=await harness({signal:signal()});assert.equal(unknown.get('prediction-summary').textContent,'Unknown');assert.equal(unknown.get('prediction-percent').hidden,true);assert.equal(unknown.get('prediction-remaining').hidden,true);
 const interval=await harness({signal:signal({earliestAt:iso(NOW+2*DAY),latestAt:iso(NOW+3*DAY),timeZone:'UTC',timeBasis:'explicit-source'}),timeZone:'UTC'});
 assert.equal(interval.get('prediction-percent').textContent,'29%–43%');assert.match(interval.get('prediction-summary').textContent,/Fri.*Sat/);assert.match(interval.get('prediction-remaining').textContent,/2 days[, ]+0 hr.*3 days[, ]+0 hr/);
 const h=await harness({signal:inference()});await h.change('auto-refresh','off');await h.tick(35*3600000);
 assert.equal(h.get('prediction-percent').textContent,'0%');assert.match(h.get('prediction-remaining').textContent,/Estimated time passed.*unconfirmed/);assert.ok(!h.get('prediction-gauge').classes.has('unknown'));
 await h.tick(12*3600000);assert.equal(h.get('prediction-percent').hidden,true);assert.match(h.get('prediction-summary').textContent,/window ended/);assert.ok(h.get('prediction-gauge').classes.has('unknown'));
});
test('legend readings can wrap without changing three-row layout or hiding source/failure details',()=>{
 assert.match(html,/\.legend-reading\{[^}]*min-width:0[^}]*flex-wrap:wrap/);assert.match(html,/\.reset-when\{[^}]*overflow-wrap:anywhere/);assert.match(html,/\.reset-countdown\{[^}]*overflow-wrap:anywhere/);
 assert.match(html,/id="prediction-note"/);assert.match(html,/id="signal-error"/);assert.match(html,/id="build-version"/);
});
test('quota countdown is driven by the exact deadline that triggers the next read',async()=>{
 const h=await harness();
 assert.equal(h.window.__test.nextQuotaRunAt,NOW+60000);assert.equal(h.get('quota-refresh-meta').attrs['data-next-run-at'],String(NOW+60000));assert.match(h.get('quota-refresh-meta').textContent,/Quota every 60 sec.*Updated.*Next in 60 sec/);
 await h.tick(1000);assert.match(h.get('quota-refresh-meta').textContent,/Next in 59 sec/);assert.equal(h.tools('read_quota').length,1);
 await h.tick(58000);assert.match(h.get('quota-refresh-meta').textContent,/Next in 1 sec/);assert.equal(h.tools('read_quota').length,1);
 await h.tick(1000);assert.equal(h.tools('read_quota').length,2);assert.equal(h.window.__test.nextQuotaRunAt,NOW+120000);assert.match(h.get('quota-refresh-meta').textContent,/Next in 60 sec/);assert.equal(h.tools('read_reset_signal').length,1);
 assert.match(html,/<p class="refresh-meta" id="quota-refresh-meta" aria-live="off"/);
});
test('five-minute scheduling starts a real 300-second deadline and Off clears it',async()=>{
 const h=await harness();await h.tick(10000);await h.change('auto-refresh','300');
 assert.equal(h.window.__test.nextQuotaRunAt,NOW+310000);assert.match(h.get('quota-refresh-meta').textContent,/every 300 sec.*Next in 300 sec/);
 await h.tick(299000);assert.equal(h.tools('read_quota').length,1);assert.match(h.get('quota-refresh-meta').textContent,/Next in 1 sec/);
 await h.tick(1000);assert.equal(h.tools('read_quota').length,2);
 await h.change('auto-refresh','off');assert.equal(h.window.__test.nextQuotaRunAt,null);assert.match(h.get('quota-refresh-meta').textContent,/auto refresh off/);assert.ok(!h.get('quota-refresh-meta').textContent.includes('Next in'));
 await h.tick(600000);assert.equal(h.tools('read_quota').length,2);
 await h.click('refresh');assert.equal(h.tools('read_quota').length,3);assert.equal(h.window.__test.nextQuotaRunAt,null);
});
test('hidden panels have no scheduled quota deadline and visibility return immediately refreshes',async()=>{
 const h=await harness();await h.tick(1000);await h.visible(false);assert.equal(h.window.__test.nextQuotaRunAt,null);assert.match(h.get('quota-refresh-meta').textContent,/refresh paused/);
 await h.tick(60000);assert.equal(h.tools('read_quota').length,1);await h.visible(true);assert.equal(h.tools('read_quota').length,2);assert.equal(h.tools('read_quota').at(-1).params.arguments.forceRefresh,true);assert.equal(h.window.__test.nextQuotaRunAt,NOW+121000);
 await h.intersect(false);assert.equal(h.window.__test.nextQuotaRunAt,null);await h.intersect(true);assert.equal(h.tools('read_quota').length,3,'quick real visibility transitions still refresh');
 await h.event('pagehide');assert.equal(h.window.__test.nextQuotaRunAt,null);await h.event('pageshow');assert.equal(h.tools('read_quota').length,4);await h.event('pageshow');assert.equal(h.tools('read_quota').length,4);
});
test('busy refresh never advertises a fake deadline, and its completion schedules the next read',async()=>{
 const h=await harness({hold:['read_quota']});assert.equal(h.window.__test.nextQuotaRunAt,null);assert.match(h.get('quota-refresh-meta').textContent,/No successful read yet.*Refreshing quota/);
 await h.tick(75000);assert.equal(h.tools('read_quota').length,1);assert.ok(!h.get('quota-refresh-meta').textContent.includes('Next in'));
 await h.release('read_quota',quota(NOW+75000));assert.equal(h.window.__test.nextQuotaRunAt,NOW+135000);assert.equal(h.window.__test.lastQuotaSuccessAt,NOW+75000);assert.match(h.get('quota-refresh-meta').textContent,/Next in 60 sec/);
});
test('failed quota reads preserve the last successful time and next deadline is a real retry',async()=>{
 let fail=false;const h=await harness({respond:name=>{if(name==='read_quota'&&fail)throw new Error('offline');}});
 assert.equal(h.window.__test.lastQuotaSuccessAt,NOW);const last=h.get('quota-refresh-meta').attrs['data-last-success-at'];fail=true;await h.tick(60000);
 assert.equal(h.get('quota-refresh-meta').attrs['data-last-success-at'],last);assert.equal(h.window.__test.lastQuotaSuccessAt,NOW);assert.equal(h.window.__test.nextQuotaRunAt,NOW+120000);assert.equal(h.get('status-hint').textContent,'Read failed');assert.match(h.get('quota-refresh-meta').textContent,/Next in 60 sec/);
 fail=false;await h.tick(60000);assert.equal(h.window.__test.lastQuotaSuccessAt,NOW+120000);assert.equal(h.get('status-hint').textContent,'Updated');
 const firstFailure=await harness({respond:name=>name==='read_quota'?quota(NOW,{buckets:[],error:{code:'READ_FAILED'}}):undefined});assert.equal(firstFailure.window.__test.lastQuotaSuccessAt,null);assert.match(firstFailure.get('quota-refresh-meta').textContent,/No successful read yet/);
});
test('single quota type and period use localized read-only values in all seven languages',async()=>{
 for(const hostLocale of ['en','zh-CN','zh-TW','ja','es','fr','de']){
  const value=quota();value.buckets[0].windows[0].windowDurationMins=10080;
  const h=await harness({hostLocale,respond:name=>name==='read_quota'?value:undefined});
  for(const id of ['bucket','window']){assert.equal(h.get(id).hidden,true);assert.equal(h.get(id).disabled,true);assert.equal(h.get(id+'-summary').hidden,false);}
  assert.equal(h.get('bucket-summary').textContent,'Codex');assert.ok(h.get('window-summary').textContent);assert.ok(!h.get('window-summary').textContent.includes('10080'));
  await h.click('settings-toggle');assert.equal(h.document.activeElement.id,'auto-refresh');assert.ok(!h.get('bucket-label').textContent.includes('额度桶'));
  await h.change('language',hostLocale==='en'?'zh-CN':'en');assert.equal(h.get('bucket-summary').textContent,'Codex');assert.equal(h.get('window').hidden,true);
 }
});
test('multiple choices survive reordered reads, locale changes and single/multiple transitions',async()=>{
 const first=quota().buckets[0],second={id:'other',name:'Other',windows:[{...first.windows[0],kind:'primary'},{...first.windows[0],kind:'secondary',windowDurationMins:10080,usedPercent:30}]};
 const h=await harness({respond:name=>name==='read_quota'?quota(NOW,{buckets:[first,second]}):undefined});
 await h.click('settings-toggle');assert.equal(h.document.activeElement.id,'bucket');assert.equal(h.get('bucket').hidden,false);assert.equal(h.get('bucket-summary').hidden,true);
 await h.change('bucket','1');assert.equal(h.get('window').hidden,false);await h.change('window','1');assert.equal(h.get('quota-value').textContent,'70');
 await h.notify(quota(NOW,{buckets:[{...second,windows:[second.windows[1],second.windows[0]]},first]}));
 assert.equal(h.get('bucket').value,'0');assert.equal(h.get('window').value,'0');assert.equal(h.get('quota-value').textContent,'70');
 await h.change('language','zh-CN');assert.equal(h.get('bucket').value,'0');assert.equal(h.get('window').value,'0');assert.equal(h.get('quota-value').textContent,'70');
 await h.notify(quota(NOW,{buckets:[{...second,windows:[second.windows[1]]}]}));assert.equal(h.get('bucket').hidden,true);assert.equal(h.get('window').hidden,true);assert.equal(h.document.activeElement.id,'auto-refresh');assert.equal(h.get('quota-value').textContent,'70');
 await h.notify(quota(NOW,{buckets:[second]}));await h.click('settings-toggle');await h.click('settings-toggle');assert.equal(h.document.activeElement.id,'window');assert.equal(h.get('window').value,'1');
});
test('zero choices and failed reads never fabricate selectable data or clear last good readings',async()=>{
 const h=await harness({hold:['read_quota']});assert.equal(h.get('bucket-summary').textContent,'Not read yet');assert.equal(h.get('bucket').children.length,0);
 await h.click('settings-toggle');assert.equal(h.document.activeElement.id,'auto-refresh');
 await h.release('read_quota',quota(NOW,{buckets:[],error:{code:'READ_FAILED'}}));
 for(const id of ['bucket','window']){assert.equal(h.get(id).hidden,true);assert.equal(h.get(id).children.length,0);assert.equal(h.get(id+'-summary').textContent,'Unknown');}
 await h.notify(quota(NOW,{buckets:[{id:'empty',name:'Empty',windows:[]}]}));assert.equal(h.get('bucket-summary').textContent,'Empty');assert.equal(h.get('window').children.length,0);
 await h.notify(quota());await h.notify(quota(NOW,{buckets:[],error:{code:'READ_FAILED'}}));assert.equal(h.get('bucket-summary').textContent,'Codex');assert.equal(h.get('quota-value').textContent,'92');assert.equal(h.get('bucket').hidden,true);
 await h.notify(quota(NOW,{buckets:[]}));assert.equal(h.get('bucket-summary').textContent,'Unknown');assert.equal(h.get('quota-value').textContent,'—');
});
test('demo cancels scheduled quota reads without pretending to update the last live reading',async()=>{
 const h=await harness();await h.tick(10000);await h.click('demo');assert.equal(h.window.__test.nextQuotaRunAt,null);assert.equal(h.window.__test.lastQuotaSuccessAt,NOW);assert.match(h.get('quota-refresh-meta').textContent,/Demo.*paused/);
 await h.click('refresh');assert.equal(h.window.__test.lastQuotaSuccessAt,NOW+10000);assert.equal(h.window.__test.nextQuotaRunAt,NOW+70000);
});

test('cold first open shows loading through connection and first read, including a preloaded error',async()=>{
 const failure=quota(NOW,{buckets:[],error:{code:'READ_FAILED'}});
 const h=await harness({hostLocale:'zh-CN',initial:failure,hold:['read_quota','read_reset_signal'],holdInitialize:true});
 assert.equal(h.get('quota-loading').hidden,false);
 assert.equal(h.get('status').dataset.state,'loading');
 assert.equal(h.get('error').textContent,'');
 assert.equal(h.tools().length,0);
 await h.connect();
 assert.equal(h.get('quota-loading').hidden,false);
 assert.equal(h.get('status-hint').textContent,'加载中…');
 assert.equal(h.get('prediction-summary').textContent,'加载中…');
 assert.equal(h.get('error').textContent,'');
 await h.release('read_quota',quota());
 assert.equal(h.get('quota-loading').hidden,true);
 assert.equal(h.get('quota-value').textContent,'92');
 assert.equal(h.get('account-rings').attrs['aria-busy'],'false');
});
test('reopening restores cached quota and prediction before connecting, then replaces them with fresh data',async()=>{
 const first=await harness({signal:signal({earliestAt:iso(NOW+DAY),latestAt:iso(NOW+2*DAY),timeZone:'UTC',timeBasis:'explicit-source'})});
 const stored=Object.fromEntries(first.storage);
 const h=await harness({storage:stored,holdInitialize:true,hold:['read_quota','read_reset_signal']});
 assert.equal(h.tools().length,0);
 assert.equal(h.get('quota-value').textContent,'92');
 assert.equal(h.get('quota-loading').hidden,true);
 assert.match(h.get('status-hint').textContent,/Cached/);
 assert.equal(h.get('prediction-value').textContent,first.get('prediction-value').textContent);
 assert.equal(h.window.__test.lastQuotaSuccessAt,NOW);
 await h.connect();
 assert.equal(h.tools('read_quota').length,1);
 assert.equal(h.tools('read_quota')[0].params.arguments.forceRefresh,true);
 const fresh=quota(NOW+1000,{buckets:[{id:'main',windows:[{kind:'primary',usedPercent:25,windowDurationMins:300,resetsAt:NOW/1000+9000}]}]});
 await h.release('read_quota',fresh);
 assert.equal(h.get('quota-value').textContent,'75');
 assert.doesNotMatch(h.get('status-hint').textContent,/Cached/);
 assert.equal(JSON.parse(h.storage.get('quota-rings-quota-v1')).fetchedAt,fresh.fetchedAt);
});
test('failed refresh retains cached readings and timestamps, and a retry shows loading without a stale error',async()=>{
 const cached=quota(NOW-600000),raw=JSON.stringify(cached);
 const h=await harness({storage:{'quota-rings-quota-v1':raw},hold:['read_quota']});
 await h.release('read_quota',quota(NOW,{buckets:[],error:{code:'READ_FAILED'}}));
 assert.equal(h.get('quota-value').textContent,'92');
 assert.equal(h.window.__test.lastQuotaSuccessAt,NOW-600000);
 assert.equal(h.storage.get('quota-rings-quota-v1'),raw);
 assert.match(h.get('status-hint').textContent,/Read failed.*Cached/);
 assert.equal(h.get('quota-loading').hidden,true);
 await h.click('refresh');
 assert.equal(h.get('error').textContent,'');
 assert.match(h.get('status-hint').textContent,/Cached.*updating/);
 await h.release('read_quota',quota());
 assert.equal(h.get('status').dataset.state,'fresh');
});
test('cold failure is reported only after completion and loading returns during retry',async()=>{
 const h=await harness({hold:['read_quota']});
 await h.release('read_quota',quota(NOW,{buckets:[],error:{code:'READ_FAILED'}}));
 assert.equal(h.get('quota-loading').hidden,true);
 assert.equal(h.get('status-hint').textContent,'Read failed');
 assert.ok(h.get('error').textContent);
 await h.click('refresh');
 assert.equal(h.get('quota-loading').hidden,false);
 assert.equal(h.get('error').textContent,'');
 await h.release('read_quota',quota());
 assert.equal(h.get('quota-loading').hidden,true);
});
test('invalid, old, future, error and demo caches fall back to loading without breaking live reads',async()=>{
 const entries=['{invalid',JSON.stringify(null),'x'.repeat(262145),JSON.stringify(quota(NOW-DAY-1)),JSON.stringify(quota(NOW+60001)),JSON.stringify(quota(NOW,{source:'demo'})),JSON.stringify(quota(NOW,{error:{code:'READ_FAILED'}})),JSON.stringify(quota(NOW,{buckets:[null]})),JSON.stringify(quota(NOW,{buckets:[{windows:[null]}]}))];
 for(const raw of entries){const h=await harness({storage:{'quota-rings-quota-v1':raw},hold:['read_quota']});assert.equal(h.get('quota-value').textContent,'—');assert.equal(h.get('quota-loading').hidden,false);await h.release('read_quota',quota());assert.equal(h.get('quota-value').textContent,'92');}
});
test('disabled browser storage does not block loading or successful reads',async()=>{
 const h=await harness({storageThrows:true,hold:['read_quota']});
 assert.equal(h.get('quota-loading').hidden,false);
 await h.release('read_quota',quota());
 assert.equal(h.get('quota-value').textContent,'92');
 assert.equal(h.get('quota-loading').hidden,true);
 assert.equal(h.get('error').textContent,'');
});
test('demo results never replace cached real quota or real predictions',async()=>{
 const h=await harness({signal:signal()});
 const quotaCache=h.storage.get('quota-rings-quota-v1'),signalCache=h.storage.get('quota-rings-signal-v1');
 await h.click('demo');
 assert.equal(h.storage.get('quota-rings-quota-v1'),quotaCache);
 assert.equal(h.storage.get('quota-rings-signal-v1'),signalCache);
 const next=await harness({storage:Object.fromEntries(h.storage),hold:['read_quota','read_reset_signal']});
 assert.equal(next.get('demo-banner').hidden,true);
 assert.match(next.get('status-hint').textContent,/Cached/);
});
test('prediction cache survives a failed first source read',async()=>{
 const cached=signal({earliestAt:iso(NOW+DAY),latestAt:iso(NOW+2*DAY),timeZone:'UTC',timeBasis:'explicit-source'}),raw=JSON.stringify(cached);
 const h=await harness({storage:{'quota-rings-signal-v1':raw},hold:['read_reset_signal']});
 const before=h.get('prediction-value').textContent;
 await h.release('read_reset_signal',signal({}, {signal:null,retrieval:'error',error:{code:'SOURCE_UNAVAILABLE'}}));
 assert.equal(h.get('prediction-value').textContent,before);
 assert.equal(h.storage.get('quota-rings-signal-v1'),raw);
 assert.match(h.get('prediction-update').textContent,/Cached.*refresh failed/);
});

test('future source time has a specific localized explanation while retaining cached predictions',async()=>{
 const cached=signal({earliestAt:iso(NOW+DAY),latestAt:iso(NOW+2*DAY),timeZone:'UTC',timeBasis:'explicit-source'});
 const failed=signal({}, {signal:null,retrieval:'error',selectedSourceId:'test',sources:[{id:'test',status:'error',errorCode:'SOURCE_FUTURE_TIMESTAMP'}]});
 for(const locale of ['en','zh-CN','zh-TW','ja','es','fr','de']){
  const h=await harness({hostLocale:locale,storage:{'quota-rings-signal-v1':JSON.stringify(cached)},hold:['read_reset_signal']});
  const value=h.get('prediction-value').textContent;await h.release('read_reset_signal',failed);
  assert.equal(h.get('prediction-value').textContent,value);
  assert.ok(h.get('prediction-update').textContent.includes(h.window.__test.dictionaries[locale].signalFutureTime));
  assert.equal(h.get('signal-error').textContent,h.window.__test.dictionaries[locale].signalFutureTime);
 }
});
