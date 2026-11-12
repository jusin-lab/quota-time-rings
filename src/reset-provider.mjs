/** Read-only public reset-signal provider. Never receives or transmits account data. */
export const TIBO_MONITOR = Object.freeze({
  id: 'github-tibo-monitor', name: 'thsottiaux-Tibo-x-monitor',
  url: 'https://github.com/PengZoneLab/thsottiaux-Tibo-x-monitor',
  kind: 'independent-public-archive',
});
const RAW = 'https://raw.githubusercontent.com/PengZoneLab/thsottiaux-Tibo-x-monitor/master/';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ZONE = 'America/Los_Angeles';
export const SIGNAL_TTL_MS = 15 * 60_000;
const BACKOFF_MS = 60_000;
const UPSTREAM_STALE_MS = 6 * 3600_000;
const MAX_BYTES = 1024 * 1024;
const iso = n => new Date(n).toISOString();
const validMs = x => typeof x === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x));
function dateParts(ms, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(ms).map(x => [x.type,x.value]));
  return {year:+p.year,month:+p.month,day:+p.day,hour:+p.hour,minute:+p.minute,second:+p.second};
}
function inZone(y,m,d,h,zone) {
  const target = Date.UTC(y,m-1,d,h);
  let guess=target;
  for (let i=0;i<4;i++) { const p=dateParts(guess,zone); const actual=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second); const delta=target-actual; guess+=delta; if (!delta) return guess; }
  return guess;
}
/** Deterministic estimate, anchored to publication, never to the current clock. */
export function inferWeekdayPrediction(text, publishedAt) {
  if (typeof text !== 'string' || !validMs(publishedAt) || !/\breset(?:s|ting)?\b/i.test(text)) return null;
  // Do not convert denials, past events, conflicting weekdays or conditional examples into a promise.
  if (/\b(?:cancel(?:led|ed)?|won't|will not|not happening|no reset|already reset|was reset|did reset|reset happened|reset yesterday|last\s+(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)|if\b|hypothetical)\b/i.test(text)) return null;
  // An explicit hour/zone needs a dedicated parser; do not silently replace it with noon.
  if (/\b(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|UTC|GMT|PST|PDT|EST|EDT)\b/i.test(text)) return null;
  const matches=[...text.matchAll(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi)].map(m=>WEEKDAYS.find(x=>x.toLowerCase()===m[1].toLowerCase()));
  const names=[...new Set(matches)]; if (names.length!==1) return null;
  const weekday=names[0]; const p=dateParts(Date.parse(publishedAt),ZONE);
  let delta=(WEEKDAYS.indexOf(weekday)-new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay()+7)%7;
  if (new RegExp(`\\bnext\\s+${weekday}\\b`,'i').test(text) && delta===0) delta=7;
  const target=new Date(Date.UTC(p.year,p.month-1,p.day+delta));
  const y=target.getUTCFullYear(),m=target.getUTCMonth()+1,d=target.getUTCDate();
  const following=new Date(Date.UTC(y,m-1,d+1));
  const earliest=inZone(y,m,d,0,ZONE), latest=inZone(following.getUTCFullYear(),following.getUTCMonth()+1,following.getUTCDate(),0,ZONE);
  const estimate=inZone(y,m,d,12,ZONE);
  return {timeBasis:'inferred', estimatedAt:iso(estimate), earliestAt:iso(earliest), latestAt:iso(latest), timeZone:ZONE,
    timeZoneBasis:'assumed-from-monitor-display', assumptionKey:'weekdayPacificMidpoint', weekday,
    assumption:'Interpret the mentioned weekday using the monitor’s Pacific-time convention; noon is an estimate and the whole day is the range. Tibo’s own timezone is unconfirmed.'};
}
function parseBeijing(date,hour,minute) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || +hour>23 || +minute>59) return null;
  const s=`${date}T${hour.padStart(2,'0')}:${minute}:00+08:00`; const n=Date.parse(s);
  return Number.isFinite(n) && iso(n+8*3600_000).startsWith(date) ? iso(n) : null;
}
export function parseLatest(text, now=Date.now()) {
  if (typeof text!=='string' || !/^# Latest Scan/m.test(text)) throw Object.assign(new Error('Unrecognized archive index'),{code:'SOURCE_FORMAT'});
  const stamp=text.match(/\*\*Scan time\*\*:\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s+Beijing/i);
  const upstreamCheckedAt=stamp ? parseBeijing(stamp[1],stamp[2],stamp[3]) : null;
  if (!upstreamCheckedAt) throw Object.assign(new Error('Invalid archive timestamp'),{code:'SOURCE_FORMAT'});
  if (Date.parse(upstreamCheckedAt)>now+5*60_000) throw Object.assign(new Error('Archive scan time is ahead of the local clock'),{code:'SOURCE_FUTURE_TIMESTAMP'});
  const days=[...new Set([...text.matchAll(/\]\((logs\/\d{4}-\d{2}-\d{2}\.md)\)/g)].map(m=>m[1]))]
    .filter(p=> {const n=Date.parse(p.slice(5,15)+'T00:00:00+08:00'); return Number.isFinite(n)&&n<=now+24*3600_000&&now-n<=8*86400_000;})
    .sort().reverse().slice(0,4);
  if (!days.length) throw Object.assign(new Error('No recent archive log links'),{code:'SOURCE_FORMAT'});
  return {upstreamCheckedAt,days};
}
export function parseDailyLog(text,path) {
  const day=/^logs\/(\d{4}-\d{2}-\d{2})\.md$/.exec(path)?.[1];
  if (!day || !text.includes(`# Scan Log — ${day}`) || !/## Today's (?:original posts|replies)/.test(text)) throw Object.assign(new Error('Unrecognized daily archive'),{code:'SOURCE_FORMAT'});
  const body=text.slice(text.indexOf("## Today's")); const signals=[];
  for (const block of body.split(/^### /m).slice(1)) {
    const time=block.match(/^- \*\*Time\*\*:\s*(\d{1,2}):(\d{2})\s+Beijing/m);
    const words=block.match(/^- \*\*(?:His words|Content)\*\*:\s*(.+)$/m)?.[1]?.trim();
    const originalUrl=block.match(/^- \*\*Link\*\*:\s*(https:\/\/x\.com\/thsottiaux\/status\/\d+)\s*$/m)?.[1];
    if (!time || !words || words.length>4000 || !originalUrl || !/\breset(?:s|ting)?\b/i.test(words)) continue;
    const publishedAt=parseBeijing(day,time[1],time[2]); if (!publishedAt) continue;
    const prediction=inferWeekdayPrediction(words,publishedAt);
    signals.push({id:originalUrl.split('/').pop(),sourceId:TIBO_MONITOR.id,status:'hint',verification:'secondary-only',signal:{publishedAt,publishedPrecision:'minute',originalUrl,
      evidenceUrl:`${TIBO_MONITOR.url}/blob/master/${path}`, attribution:'Tibo (@thsottiaux), via an independent public GitHub archive',
      summary:{en:prediction?'A post mentions a weekday and a possible reset. The time is an estimate, not an official schedule.':'A reset-related post has no supported future weekday estimate.',
        'zh-CN':prediction?'发言提到星期与可能的额外重置；时间为推断，不是官方排期。':'有重置相关发言，尚无可计算的未来时间。'},
      prediction}});
  }
  return signals;
}
/** Fixed destination, no credentials/redirects, timeout and streamed response size limit. */
export async function fetchArchiveText(path,{fetchImpl=fetch,signal}={}) {
  if (!(path==='latest.md'||/^logs\/\d{4}-\d{2}-\d{2}\.md$/.test(path))) throw Object.assign(new Error('Invalid archive path'),{code:'INVALID_SOURCE_PATH'});
  const local=AbortSignal.timeout(8000); const combined=signal?AbortSignal.any([signal,local]):local;
  const response=await fetchImpl(RAW+path,{method:'GET',redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'text/plain'},signal:combined});
  if (!response.ok) throw Object.assign(new Error('Source request failed'),{code:'SOURCE_HTTP',status:response.status});
  const length=+(response.headers?.get('content-length')||0); if(length>MAX_BYTES) {await response.body?.cancel();throw Object.assign(new Error('Source too large'),{code:'SOURCE_SIZE'});}
  const reader=response.body?.getReader(); if(!reader) throw Object.assign(new Error('Missing source body'),{code:'SOURCE_FORMAT'});
  const chunks=[];let total=0;
  try { while(true) {const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES) {await reader.cancel();throw Object.assign(new Error('Source too large'),{code:'SOURCE_SIZE'});}chunks.push(value);} }
  finally {reader.releaseLock();}
  const data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(data);
}
export async function readGithubMonitor({fetchText=fetchArchiveText,now=Date.now}={}) {
  const started=now();const signal=AbortSignal.timeout(18_000);
  const latest=parseLatest(await fetchText('latest.md',{signal}),started);
  const results=await Promise.allSettled(latest.days.map(async path=>parseDailyLog(await fetchText(path,{signal}),path)));
  const success=results.filter(x=>x.status==='fulfilled');
  if (!success.length) throw Object.assign(new Error('No readable archive logs'),{code:'SOURCE_LOGS_UNAVAILABLE'});
  const unique=new Map(); for(const result of success) for(const item of result.value) if(Date.parse(item.signal.publishedAt)<=started+5*60_000) unique.set(item.id,item);
  const predictions=[...unique.values()].sort((a,b)=>Date.parse(b.signal.publishedAt)-Date.parse(a.signal.publishedAt));
  return {provider:TIBO_MONITOR,upstreamCheckedAt:latest.upstreamCheckedAt,predictions,partial:success.length!==results.length};
}
/** Registry makes additional providers independent: their identities and forecasts never get merged. */
export function createResetSignalReader({providers=[{...TIBO_MONITOR,read:readGithubMonitor}],now=Date.now,ttlMs=SIGNAL_TTL_MS,backoffMs=BACKOFF_MS}={}) {
  const cache=new Map();let inflight=null;
  const render=()=>{
    const at=now();const sources=[];const predictions=[];
    for(const p of providers) {const s=cache.get(p.id)||{};const old= s.data?.upstreamCheckedAt && at-Date.parse(s.data.upstreamCheckedAt)>UPSTREAM_STALE_MS;
      const stale=!!s.error || !!old || !!s.data?.partial || (s.checkedAt?at-Date.parse(s.checkedAt)>ttlMs:true);
      sources.push({id:p.id,name:p.name,url:p.url,status:s.error?'error':stale?'stale':'ok',checkedAt:s.checkedAt||null,lastAttemptAt:s.lastAttemptAt||null,upstreamCheckedAt:s.data?.upstreamCheckedAt||null,...(s.error?{errorCode:s.error}:{}),...(s.data?.partial?{partial:true}:{})});
      for(const item of s.data?.predictions||[]) predictions.push({...item,sourceId:p.id,sourceStale:stale,expired:!!item.signal?.prediction?.latestAt&&Date.parse(item.signal.prediction.latestAt)<=at});
    }
    predictions.sort((a,b)=>Date.parse(b.signal.publishedAt)-Date.parse(a.signal.publishedAt));
    const chosen=predictions[0]||null;const provider=providers.find(x=>x.id===chosen?.sourceId)||providers[0];const state=cache.get(provider?.id)||{};
    const failed=sources.filter(s=>s.status==='error').length;
    return {schemaVersion:1,source:'reset-signal',checkedAt:state.checkedAt||null,lastAttemptAt:state.lastAttemptAt||null,readAt:iso(at),
      status:chosen?.status||'unknown',verification:chosen?.verification||'unavailable',retrieval:failed===sources.length?'error':failed||sources.some(x=>x.partial)?'partial':'ok',staleAfterMs:ttlMs,
      signal:chosen?.signal||null,selectedSourceId:provider?.id||null,
      sourceProvider:provider?{id:provider.id,name:provider.name,url:provider.url,kind:provider.kind,upstreamCheckedAt:state.data?.upstreamCheckedAt||null}:null,sources,predictions};
  };
  return async ({forceRefresh=false}={})=>{
    if(inflight) return inflight;
    const due=providers.filter(p=>{const s=cache.get(p.id);return !s||(!s.error&&forceRefresh)||now()-Date.parse(s.lastAttemptAt)>= (s.error?backoffMs:ttlMs);});
    if(!due.length)return render();
    inflight=(async()=>{await Promise.all(due.map(async p=>{const previous=cache.get(p.id)||{};const lastAttemptAt=iso(now());try {const data=await p.read();cache.set(p.id,{data,checkedAt:iso(now()),lastAttemptAt});}catch(e){cache.set(p.id,{...previous,lastAttemptAt,error:/^SOURCE_[A-Z_]+$/.test(e?.code||'')?e.code:'SOURCE_UNAVAILABLE'});}}));return render();})();
    try{return await inflight;}finally{inflight=null;}
  };
}
