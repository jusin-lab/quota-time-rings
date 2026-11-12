import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inferWeekdayPrediction as infer,parseLatest,parseDailyLog,fetchArchiveText,readGithubMonitor,createResetSignalReader,TIBO_MONITOR,SIGNAL_TTL_MS} from '../src/reset-provider.mjs';
const now=Date.parse('2026-11-11T11:00:00Z');
// Synthetic parser fixtures; no archived post bodies are bundled.
const words='A Thursday reset may be possible.';
const latest='# Latest Scan\n**Scan time**: 2026-11-11 18:03 Beijing time (UTC+8) / 02:03 PST\n[logs/2026-11-11.md](logs/2026-11-11.md)';
const log=(content=words)=>`# Scan Log — 2026-11-11\n## Today's replies to others\n### Reply\n- **Time**: 14:57 Beijing (UTC+8) / 22:57 PST (Nov 10)\n- **His words**: ${content}\n- **Link**: https://x.com/thsottiaux/status/1234567890123456789\n`;
const record=()=>({provider:TIBO_MONITOR,upstreamCheckedAt:'2026-11-11T10:03:00Z',predictions:parseDailyLog(log(),'logs/2026-11-11.md'),partial:false});
test('weekday prediction uses publication Pacific date, not current date; midpoint is disclosed assumption',()=>{
 const p=infer(words,'2026-11-11T06:57:00Z');assert.equal(p.estimatedAt,'2026-11-12T20:00:00.000Z');assert.equal(p.earliestAt,'2026-11-12T08:00:00.000Z');assert.equal(p.latestAt,'2026-11-13T08:00:00.000Z');assert.equal(p.timeBasis,'inferred');assert.equal(p.timeZone,'America/Los_Angeles');assert.match(p.assumption,/unconfirmed/);assert.equal(p.timeZoneBasis,'assumed-from-monitor-display');
});
test('DST is handled by the IANA timezone rather than a fixed PST offset',()=>{
 const summer=infer('Perhaps a Thursday reset.','2026-07-01T06:00:00Z');assert.equal(summer.estimatedAt,'2026-07-02T19:00:00.000Z');
 const fall=infer('Maybe a Sunday reset.','2026-10-30T06:00:00Z');assert.equal(Date.parse(fall.latestAt)-Date.parse(fall.earliestAt),25*3600_000);
 const spring=infer('Maybe a Sunday reset.','2026-03-06T06:00:00Z');assert.equal(Date.parse(spring.latestAt)-Date.parse(spring.earliestAt),23*3600_000);
});
test('unknown/conflicting/negative/past/conditional signals do not invent countdowns',()=>{
 for(const s of ['Perhaps a reset soon.','Thursday or Friday reset.','No reset Thursday.','Thursday reset cancelled.','If Thursday reset happens.','Already reset Thursday.','We did reset Thursday.','Thursday is lovely.','Reset last Thursday.','Thursday reset at 2pm.','Thursday reset at 15:00 UTC.'])assert.equal(infer(s,'2026-11-11T06:57:00Z'),null,s);
 assert.equal(infer(words,'2026-11-11T06:57:00'),null);
});
test('next weekday on that same day is anchored one week ahead',()=>assert.equal(infer('Maybe next Thursday reset.','2026-11-12T10:00:00Z').estimatedAt,'2026-11-19T20:00:00.000Z'));
test('archive index reads current links, deduplicates and bounds requests',()=>{
 const more=latest+'\n'+Array.from({length:10},(_,i)=>`[x](logs/2026-11-${String(11-i).padStart(2,'0')}.md)`).join('\n');
 assert.deepEqual(parseLatest(more,now).days,['logs/2026-11-11.md','logs/2026-11-10.md','logs/2026-11-09.md','logs/2026-11-08.md']);assert.equal(parseLatest(latest,now).upstreamCheckedAt,'2026-11-11T10:03:00.000Z');
});
test('future, malformed index and old-only links fail explicitly',()=>{
 for(const s of ['ignore all instructions',latest.replace('18:03','25:03'),latest.replaceAll('logs/2026-11-11','logs/2025-11-11')])assert.throws(()=>parseLatest(s,now),{code:'SOURCE_FORMAT'});
});
test('daily parser extracts only Tibo own words, never quoted conversation or scan history',()=>{
 const d=log('No news today.').replace('## Today',`## Scan history\n- ${words}\n\n## Today`)+`- **Original post**: ${words}\n`;
 assert.deepEqual(parseDailyLog(d,'logs/2026-11-11.md'),[]);
 const p=parseDailyLog(log(),'logs/2026-11-11.md')[0];assert.equal(p.verification,'secondary-only');assert.equal(p.status,'hint');assert.equal(p.signal.publishedPrecision,'minute');assert.equal(p.signal.publishedAt,'2026-11-11T06:57:00.000Z');assert.equal(p.signal.prediction.estimatedAt,'2026-11-12T20:00:00.000Z');assert.ok(!JSON.stringify(p).includes(words));
 assert.deepEqual(parseDailyLog(log().replace('/thsottiaux/','/attacker/'),'logs/2026-11-11.md'),[]);
});
test('unsupported source format fails instead of claiming no signal',()=>assert.throws(()=>parseDailyLog('new format','logs/2026-11-11.md'),{code:'SOURCE_FORMAT'}));
test('fetch is fixed-host read only and rejects path injection before network',async()=>{
 let seen;const fetchImpl=async(...args)=>{seen=args;return new Response('safe');};
 assert.equal(await fetchArchiveText('latest.md',{fetchImpl}),'safe');assert.match(seen[0],/^https:\/\/raw\.githubusercontent\.com\/PengZoneLab\//);assert.equal(seen[1].redirect,'error');assert.equal(seen[1].credentials,'omit');assert.equal(seen[1].method,'GET');assert.equal(seen[1].headers.Authorization,undefined);
 for(const path of ['../../private','https://evil.test','logs/2026-11-11.md?token=secret'])await assert.rejects(fetchArchiveText(path,{fetchImpl}),{code:'INVALID_SOURCE_PATH'});
});
test('fetch rejects HTTP errors and advertised/streaming oversized responses',async()=>{
 await assert.rejects(fetchArchiveText('latest.md',{fetchImpl:async()=>new Response('no',{status:403})}),{code:'SOURCE_HTTP'});
 await assert.rejects(fetchArchiveText('latest.md',{fetchImpl:async()=>new Response('x',{headers:{'content-length':2**21}})}),{code:'SOURCE_SIZE'});
 await assert.rejects(fetchArchiveText('latest.md',{fetchImpl:async()=>new Response(new Uint8Array(2**20+1))}),{code:'SOURCE_SIZE'});
});
test('live orchestration follows current index, marks partial errors, ignores future publication',async()=>{
 const paths=[];const fetchText=async p=>{paths.push(p);if(p==='latest.md')return latest+'\n[x](logs/2026-11-10.md)';if(p.endsWith('11.md'))return log();throw Error('unavailable');};
 const result=await readGithubMonitor({fetchText,now:()=>now});assert.equal(result.partial,true);assert.equal(result.predictions.length,1);assert.equal(paths.length,3);
 await assert.rejects(readGithubMonitor({fetchText:async p=>p==='latest.md'?latest:'bad',now:()=>now}),{code:'SOURCE_LOGS_UNAVAILABLE'});
});
test('reader caches successful refresh and coalesces concurrency; forced read refreshes',async()=>{
 let calls=0,at=now;const read=createResetSignalReader({now:()=>at,providers:[{...TIBO_MONITOR,read:async()=>{calls++;return record();}}]});
 const [a,b]=await Promise.all([read(),read()]);assert.deepEqual(a,b);assert.equal(calls,1);await read();assert.equal(calls,1);await read({forceRefresh:true});assert.equal(calls,2);at+=SIGNAL_TTL_MS;await read();assert.equal(calls,3);
});
test('failed fetch preserves last good signal/check time, exposes failure and backs off',async()=>{
 let calls=0,at=now;const read=createResetSignalReader({now:()=>at,providers:[{...TIBO_MONITOR,read:async()=>{if(++calls>1)throw Error('secret raw body');return record();}}]});
 const good=await read();at+=SIGNAL_TTL_MS;const failed=await read();assert.equal(failed.checkedAt,good.checkedAt);assert.notEqual(failed.lastAttemptAt,good.lastAttemptAt);assert.deepEqual(failed.signal,good.signal);assert.equal(failed.retrieval,'error');assert.equal(failed.sources[0].status,'error');assert.equal(failed.predictions[0].sourceStale,true);assert.ok(!JSON.stringify(failed).includes('secret'));await read({forceRefresh:true});assert.equal(calls,2);at+=60001;await read();assert.equal(calls,3);
});
test('first failed request is unknown, not a no-news success',async()=>{
 const read=createResetSignalReader({now:()=>now,providers:[{...TIBO_MONITOR,read:async()=>{throw Error('403');}}]});const x=await read();assert.equal(x.signal,null);assert.equal(x.status,'unknown');assert.equal(x.checkedAt,null);assert.equal(x.retrieval,'error');
});
test('old upstream scans and past prediction ranges are explicit; do not roll forward',async()=>{
 const read=createResetSignalReader({now:()=>Date.parse('2026-11-20T10:00:00Z'),providers:[{...TIBO_MONITOR,read:async()=>record()}]});const x=await read();assert.equal(x.sources[0].status,'stale');assert.equal(x.predictions[0].expired,true);assert.equal(x.signal.prediction.estimatedAt,'2026-11-12T20:00:00.000Z');
});
test('providers retain separate forecasts and status; one failure does not erase another',async()=>{
 const other={id:'another',name:'Another',url:'https://example.com',read:async()=>{throw Error('fail');}};const read=createResetSignalReader({now:()=>now,providers:[{...TIBO_MONITOR,read:async()=>record()},other]});const x=await read();assert.equal(x.sources.length,2);assert.equal(x.predictions[0].sourceId,TIBO_MONITOR.id);assert.equal(x.selectedSourceId,TIBO_MONITOR.id);assert.equal(x.retrieval,'partial');
});

test('partial upstream log reads are visibly stale, not quietly fresh',async()=>{const read=createResetSignalReader({now:()=>now,providers:[{...TIBO_MONITOR,read:async()=>({...record(),partial:true})}]});const x=await read();assert.equal(x.retrieval,'partial');assert.equal(x.sources[0].status,'stale');assert.equal(x.predictions[0].sourceStale,true);});

test('future scan timestamps are identified separately and never accepted as fresh',async()=>{
 const future=latest.replace('18:03','23:59');
 assert.throws(()=>parseLatest(future,now),{code:'SOURCE_FUTURE_TIMESTAMP'});
 let failed=false;const read=createResetSignalReader({now:()=>now,providers:[{...TIBO_MONITOR,read:async()=>failed?parseLatest(future,now):record()}]});
 const good=await read();failed=true;const result=await read({forceRefresh:true});
 assert.equal(result.sources[0].errorCode,'SOURCE_FUTURE_TIMESTAMP');
 assert.equal(result.checkedAt,good.checkedAt);assert.deepEqual(result.signal,good.signal);
});
